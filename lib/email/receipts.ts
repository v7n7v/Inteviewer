import { createHash } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';

export type EmailReceiptStatus = 'accepted' | 'delivered' | 'delayed' | 'failed';

export interface NormalizedEmailReceipt {
  messageId: string;
  providerMessageId: string;
  providerEvent: string;
  status: EmailReceiptStatus;
  occurredAt: string;
  error: string | null;
  pauseOptionalEmail: boolean;
  recipients: string[];
}

export function normalizeResendEmailReceipt(payload: unknown): NormalizedEmailReceipt | null {
  if (!payload || typeof payload !== 'object') return null;
  const event = payload as Record<string, unknown>;
  const type = boundedString(event.type, 80);
  const data = event.data && typeof event.data === 'object'
    ? event.data as Record<string, unknown>
    : null;
  if (!type || !data) return null;

  const status = receiptStatus(type);
  const tags = normalizeTags(data.tags);
  const messageId = boundedString(tags.message, 80);
  const providerMessageId = boundedString(data.email_id, 120);
  const occurredAt = safeEventTime(event.created_at);
  const recipients = Array.isArray(data.to)
    ? [...new Set(data.to.map((value) => boundedString(value, 320)?.toLowerCase()).filter(Boolean))] as string[]
    : [];
  if (
    !status
    || !messageId
    || !/^em_[a-f0-9]{40}$/.test(messageId)
    || !providerMessageId
    || !occurredAt
    || recipients.length === 0
  ) return null;

  return {
    messageId,
    providerMessageId,
    providerEvent: type,
    status,
    occurredAt,
    error: receiptError(type, data),
    pauseOptionalEmail: type === 'email.bounced' || type === 'email.suppressed' || type === 'email.complained',
    recipients,
  };
}

export async function applyEmailDeliveryReceipt(
  db: Firestore,
  svixId: string,
  receipt: NormalizedEmailReceipt,
) {
  const eventId = createHash('sha256').update(svixId).digest('hex');
  const eventRef = db.collection('email_webhook_events').doc(eventId);
  const messageRef = db.collection('email_outbox').doc(receipt.messageId);

  return db.runTransaction(async (transaction) => {
    const [eventSnapshot, messageSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(messageRef),
    ]);
    if (eventSnapshot.exists) return { outcome: 'duplicate' as const };

    const eventRecord = {
      version: 1,
      provider: 'resend',
      svixIdHash: eventId,
      messageId: receipt.messageId,
      providerMessageId: receipt.providerMessageId,
      providerEvent: receipt.providerEvent,
      status: receipt.status,
      eventAt: receipt.occurredAt,
      receivedAt: new Date().toISOString(),
    };
    if (!messageSnapshot.exists) {
      transaction.set(eventRef, { ...eventRecord, outcome: 'unmatched' });
      return { outcome: 'unmatched' as const };
    }

    const message = messageSnapshot.data() || {};
    if (message.providerMessageId && message.providerMessageId !== receipt.providerMessageId) {
      transaction.set(eventRef, { ...eventRecord, outcome: 'message_mismatch' });
      return { outcome: 'message_mismatch' as const };
    }
    if (!message.recipientHash || !receipt.recipients.some((email) => hashRecipient(email) === message.recipientHash)) {
      transaction.set(eventRef, { ...eventRecord, outcome: 'recipient_mismatch' });
      return { outcome: 'recipient_mismatch' as const };
    }
    if (!shouldApplyReceipt(message.lastReceiptAt, receipt.occurredAt, message.status, receipt.status)) {
      transaction.set(eventRef, { ...eventRecord, outcome: 'out_of_order' });
      return { outcome: 'out_of_order' as const };
    }

    transaction.set(messageRef, {
      status: receipt.status,
      providerMessageId: receipt.providerMessageId,
      lastProviderEvent: receipt.providerEvent,
      lastReceiptAt: receipt.occurredAt,
      updatedAt: receipt.occurredAt,
      lastError: receipt.error,
    }, { merge: true });

    const recipient = message.recipient && typeof message.recipient === 'object'
      ? message.recipient as Record<string, unknown>
      : null;
    if (receipt.pauseOptionalEmail && recipient?.kind === 'user' && typeof recipient.uid === 'string') {
      const settings = db.collection('users').doc(recipient.uid).collection('settings');
      transaction.set(settings.doc('communicationPreferences'), {
        optionalEmailPaused: true,
        optionalEmailPausedAt: receipt.occurredAt,
        optionalEmailPausedReason: receipt.error || 'Optional email was paused after a provider rejection or complaint.',
        updatedAt: receipt.occurredAt,
      }, { merge: true });
      transaction.set(settings.doc('jobPreferences'), {
        emailNotifications: false,
        emailDeliveryPausedAt: receipt.occurredAt,
        emailDeliveryPausedReason: receipt.error || 'Email delivery was paused after a provider rejection or complaint.',
      }, { merge: true });
    }
    if (receipt.pauseOptionalEmail) {
      transaction.set(db.collection('email_suppressions').doc(String(message.recipientHash)), {
        recipientHash: message.recipientHash,
        provider: 'resend',
        providerEvent: receipt.providerEvent,
        reason: receipt.error || 'Email delivery was suppressed after a terminal provider event.',
        suppressedAt: receipt.occurredAt,
        updatedAt: receipt.occurredAt,
      }, { merge: true });
    }

    transaction.set(eventRef, { ...eventRecord, outcome: 'applied' });
    return { outcome: 'applied' as const, status: receipt.status };
  });
}

export function shouldApplyReceipt(
  previousEventAt: unknown,
  nextEventAt: string,
  previousStatus: unknown,
  nextStatus: EmailReceiptStatus,
): boolean {
  const previousTimestamp = typeof previousEventAt === 'string' ? new Date(previousEventAt).getTime() : 0;
  const nextTimestamp = new Date(nextEventAt).getTime();
  if (!Number.isFinite(nextTimestamp)) return false;
  if (!Number.isFinite(previousTimestamp) || previousTimestamp <= 0 || nextTimestamp > previousTimestamp) return true;
  if (nextTimestamp < previousTimestamp) return false;
  const priority: Record<string, number> = { leased: 0, accepted: 1, delayed: 2, delivered: 3, failed: 4 };
  return (priority[nextStatus] || 0) > (priority[String(previousStatus)] || 0);
}

function normalizeTags(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return Object.fromEntries(value.flatMap((tag) => {
      if (!tag || typeof tag !== 'object') return [];
      const data = tag as Record<string, unknown>;
      return typeof data.name === 'string' ? [[data.name, data.value]] : [];
    }));
  }
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function receiptStatus(type: string): EmailReceiptStatus | null {
  if (type === 'email.sent') return 'accepted';
  if (type === 'email.delivered') return 'delivered';
  if (type === 'email.delivery_delayed') return 'delayed';
  if (['email.bounced', 'email.failed', 'email.suppressed', 'email.complained'].includes(type)) return 'failed';
  return null;
}

function receiptError(type: string, data: Record<string, unknown>): string | null {
  if (type === 'email.delivery_delayed') return 'The recipient email server temporarily delayed delivery.';
  if (type === 'email.bounced') return nestedMessage(data.bounce) || 'The recipient email server rejected the message.';
  if (type === 'email.failed') return nestedMessage(data.failed, 'reason') || 'The email provider could not send the message.';
  if (type === 'email.suppressed') return nestedMessage(data.suppressed) || 'The email provider suppressed the message.';
  if (type === 'email.complained') return 'The recipient reported this email as spam. Optional email has been paused.';
  return null;
}

function nestedMessage(value: unknown, key = 'message'): string | null {
  return value && typeof value === 'object' ? boundedString((value as Record<string, unknown>)[key], 180) : null;
}

function safeEventTime(value: unknown): string | null {
  const raw = boundedString(value, 80);
  if (!raw) return null;
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function boundedString(value: unknown, max = 180): string | null {
  return typeof value === 'string' && value.trim()
    ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)
    : null;
}

function hashRecipient(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}
