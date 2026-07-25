import { createHash, randomUUID } from 'crypto';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { getOptionalEmailPermission } from '@/lib/communication-preferences';
import { sendRenderedEmailResult } from '@/lib/email';
import { emailCatalog, type ImplementedEmailEventKey } from './catalog';
import { renderEmail } from './render';
import { buildEmailUnsubscribeUrl } from './unsubscribe';

export type EmailOutboxStatus = 'queued' | 'retry' | 'leased' | 'accepted' | 'delivered' | 'delayed' | 'failed' | 'skipped' | 'dead';
export type EmailOutboxRecipient =
  | { kind: 'user'; uid: string }
  | { kind: 'contact'; submissionId: string }
  | { kind: 'operations' };

export interface EnqueueEmailInput {
  event: ImplementedEmailEventKey;
  recipient: EmailOutboxRecipient;
  payload: unknown;
  dedupeKey: string;
  availableAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

interface EmailOutboxDocument {
  messageId: string;
  event: ImplementedEmailEventKey;
  stream: string;
  templateVersion: string;
  preferenceKey: string | null;
  recipient: EmailOutboxRecipient;
  payload: Record<string, unknown>;
  metadata: Record<string, string | number | boolean | null>;
  status: EmailOutboxStatus;
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  createdAt: string;
  updatedAt: string;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  providerMessageId: string | null;
  recipientHash: string | null;
  lastError: string | null;
}

const OUTBOX_COLLECTION = 'email_outbox';
const MAX_ATTEMPTS = 8;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 4 * 60 * 60_000, 12 * 60 * 60_000, 24 * 60 * 60_000] as const;
const SENSITIVE_PAYLOAD_KEY = /password|oob|action.?code|recovery.?code|token|secret|html/i;
const SENSITIVE_OUTBOX_EVENTS = new Set<ImplementedEmailEventKey>([
  'account.deactivation_requested',
  'account.deletion_requested',
  'account.export_ready',
]);

export function createEmailMessageId(input: Pick<EnqueueEmailInput, 'event' | 'recipient' | 'dedupeKey'>): string {
  const recipientKey = input.recipient.kind === 'user'
    ? `user:${input.recipient.uid}`
    : input.recipient.kind === 'contact'
      ? `contact:${input.recipient.submissionId}`
      : 'operations';
  const digest = createHash('sha256')
    .update(['email-outbox-v1', input.event, recipientKey, input.dedupeKey].join('\u001f'))
    .digest('hex');
  return `em_${digest.slice(0, 40)}`;
}

export function nextEmailRetryAt(attemptCount: number, now = Date.now()): string | null {
  const delay = RETRY_DELAYS_MS[attemptCount - 1];
  return delay === undefined ? null : new Date(now + delay).toISOString();
}

export function assertSafeOutboxPayload(event: ImplementedEmailEventKey, payload: unknown): Record<string, unknown> {
  if (event.startsWith('security.') || SENSITIVE_OUTBOX_EVENTS.has(event)) {
    throw new Error('Security action email must be rendered and sent without persisting its payload');
  }
  const definition = emailCatalog[event];
  inspectPayload(payload, '$');
  const parsed = definition.schema.parse(payload);
  const json = JSON.stringify(parsed);
  if (Buffer.byteLength(json, 'utf8') > 16_384) throw new Error('Email outbox payload exceeds 16 KB');
  inspectPayload(parsed, '$');
  return parsed as Record<string, unknown>;
}

export async function enqueueEmail(input: EnqueueEmailInput): Promise<{ messageId: string; created: boolean }> {
  const definition = emailCatalog[input.event];
  if (definition.stream === 'marketing') throw new Error('Marketing email cannot be enqueued');
  const payload = assertSafeOutboxPayload(input.event, input.payload);
  const messageId = createEmailMessageId(input);
  const db = getAdminDb();
  const docRef = db.collection(OUTBOX_COLLECTION).doc(messageId);
  const now = new Date().toISOString();

  const created = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(docRef);
    if (existing.exists) return false;
    const document: EmailOutboxDocument = {
      messageId,
      event: input.event,
      stream: definition.stream,
      templateVersion: definition.templateVersion,
      preferenceKey: definition.preferenceKey,
      recipient: input.recipient,
      payload,
      metadata: sanitizeMetadata(input.metadata),
      status: 'queued',
      attemptCount: 0,
      maxAttempts: MAX_ATTEMPTS,
      availableAt: normalizeAvailableAt(input.availableAt, now),
      createdAt: now,
      updatedAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
      providerMessageId: null,
      recipientHash: null,
      lastError: null,
    };
    transaction.create(docRef, document);
    return true;
  });

  return { messageId, created };
}

export async function dispatchEmailOutboxBatch(limit = 20): Promise<{
  recovered: number;
  leased: number;
  accepted: number;
  retried: number;
  skipped: number;
  dead: number;
}> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const leaseOwner = randomUUID();
  const recovered = await recoverExpiredEmailLeases(safeLimit * 2);
  const messages = await leaseMessages(leaseOwner, safeLimit);
  const summary = { recovered, leased: messages.length, accepted: 0, retried: 0, skipped: 0, dead: 0 };

  for (const message of messages) {
    const outcome = await dispatchLeasedMessage(message, leaseOwner);
    summary[outcome] += 1;
  }
  return summary;
}

export async function recoverExpiredEmailLeases(limit = 100): Promise<number> {
  const db = getAdminDb();
  const snapshots = await db.collection(OUTBOX_COLLECTION)
    .where('status', '==', 'leased')
    .limit(Math.max(1, Math.min(200, Math.floor(limit))))
    .get();
  let recovered = 0;
  for (const snapshot of snapshots.docs) {
    const didRecover = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(snapshot.ref);
      const data = current.data() as EmailOutboxDocument | undefined;
      if (!data || data.status !== 'leased' || !data.leaseExpiresAt) return false;
      if (new Date(data.leaseExpiresAt).getTime() > Date.now()) return false;
      const now = new Date().toISOString();
      transaction.update(snapshot.ref, {
        status: 'retry',
        availableAt: now,
        updatedAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: 'Previous delivery lease expired before completion',
      });
      return true;
    });
    if (didRecover) recovered += 1;
  }
  return recovered;
}

async function leaseMessages(leaseOwner: string, limit: number): Promise<EmailOutboxDocument[]> {
  const db = getAdminDb();
  const collection = db.collection(OUTBOX_COLLECTION);
  const [queued, retrying] = await Promise.all([
    collection.where('status', '==', 'queued').limit(limit * 2).get(),
    collection.where('status', '==', 'retry').limit(limit * 2).get(),
  ]);
  const now = new Date();
  const candidates = [...queued.docs, ...retrying.docs]
    .map((snapshot) => ({ ref: snapshot.ref, data: snapshot.data() as EmailOutboxDocument }))
    .filter(({ data }) => new Date(data.availableAt).getTime() <= now.getTime())
    .sort((a, b) => a.data.availableAt.localeCompare(b.data.availableAt))
    .slice(0, limit);
  const leased: EmailOutboxDocument[] = [];

  for (const candidate of candidates) {
    const claimed = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(candidate.ref);
      const data = current.data() as EmailOutboxDocument | undefined;
      if (!data || (data.status !== 'queued' && data.status !== 'retry')) return null;
      if (new Date(data.availableAt).getTime() > Date.now()) return null;
      const attemptCount = data.attemptCount + 1;
      const updated: Partial<EmailOutboxDocument> = {
        status: 'leased',
        attemptCount,
        leaseOwner,
        leaseExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      transaction.update(candidate.ref, updated);
      return { ...data, ...updated } as EmailOutboxDocument;
    });
    if (claimed) leased.push(claimed);
  }
  return leased;
}

async function dispatchLeasedMessage(
  message: EmailOutboxDocument,
  leaseOwner: string,
): Promise<'accepted' | 'retried' | 'skipped' | 'dead'> {
  try {
    if (message.preferenceKey && message.recipient.kind === 'user') {
      const permission = await getOptionalEmailPermission(message.recipient.uid, message.preferenceKey as never);
      if (!permission.allowed) {
        await completeLease(message.messageId, leaseOwner, 'skipped', { lastError: safeError(permission.reason) });
        return 'skipped';
      }
    }

    const to = await resolveRecipient(message.recipient);
    if (await isRecipientSuppressed(to)) {
      await completeLease(message.messageId, leaseOwner, 'skipped', { lastError: 'Recipient is suppressed after a terminal provider event' });
      return 'skipped';
    }
    const dispatchPayload = addDispatchOnlyLinks(message);
    const rendered = await renderEmail(message.event, dispatchPayload as never);
    const result = await sendRenderedEmailResult(to, rendered, {
      idempotencyKey: `tc-${message.messageId}`,
      additionalTags: [{ name: 'message', value: message.messageId }],
    });
    if (!result.ok) throw new Error(result.error || 'Provider rejected the message');
    await completeLease(message.messageId, leaseOwner, 'accepted', {
      providerMessageId: result.id || null,
      recipientHash: hashRecipient(to),
      lastError: null,
    });
    return 'accepted';
  } catch (error) {
    const retryAt = nextEmailRetryAt(message.attemptCount);
    if (message.attemptCount >= message.maxAttempts || !retryAt) {
      await completeLease(message.messageId, leaseOwner, 'dead', { lastError: safeError(error) });
      if (message.stream !== 'internal') {
        await enqueueEmail({
          event: 'internal.email_delivery_failed',
          recipient: { kind: 'operations' },
          dedupeKey: `dead-letter:${message.messageId}`,
          payload: {
            referenceId: message.messageId,
            summary: `A ${message.stream} email exhausted ${message.attemptCount} delivery attempts and entered the dead-letter state.`,
            severity: 'critical',
            occurredAt: new Date().toISOString(),
            details: [
              { label: 'Event', value: message.event },
              { label: 'Attempts', value: String(message.attemptCount) },
            ],
          },
          metadata: { sourceMessageId: message.messageId },
        }).catch(() => {});
      }
      return 'dead';
    }
    await completeLease(message.messageId, leaseOwner, 'retry', {
      availableAt: retryAt,
      lastError: safeError(error),
    });
    return 'retried';
  }
}

function addDispatchOnlyLinks(message: EmailOutboxDocument): Record<string, unknown> {
  if (!message.preferenceKey || message.recipient.kind !== 'user') return message.payload;
  return {
    ...message.payload,
    preferenceUrl: 'https://talentconsulting.io/suite/settings',
    unsubscribeUrl: buildEmailUnsubscribeUrl(message.recipient.uid, message.preferenceKey as Parameters<typeof buildEmailUnsubscribeUrl>[1]),
  };
}

export async function inspectEmailOutboxBacklog(threshold = 100): Promise<number> {
  const safeThreshold = Math.max(10, Math.min(500, Math.floor(threshold)));
  const db = getAdminDb();
  const [queued, retrying] = await Promise.all([
    db.collection(OUTBOX_COLLECTION).where('status', '==', 'queued').limit(safeThreshold + 1).get(),
    db.collection(OUTBOX_COLLECTION).where('status', '==', 'retry').limit(safeThreshold + 1).get(),
  ]);
  const backlog = queued.size + retrying.size;
  if (backlog > safeThreshold) {
    const hourBucket = new Date().toISOString().slice(0, 13);
    await enqueueEmail({
      event: 'internal.email_queue_backlog',
      recipient: { kind: 'operations' },
      dedupeKey: `backlog:${hourBucket}`,
      payload: {
        referenceId: `email-backlog-${hourBucket}`,
        summary: `The email outbox has at least ${backlog} queued or retrying messages, above the ${safeThreshold} message threshold.`,
        severity: 'critical',
        occurredAt: new Date().toISOString(),
        details: [
          { label: 'Queued sample', value: String(queued.size) },
          { label: 'Retrying sample', value: String(retrying.size) },
          { label: 'Threshold', value: String(safeThreshold) },
        ],
      },
      metadata: { backlog, threshold: safeThreshold },
    });
  }
  return backlog;
}

async function resolveRecipient(recipient: EmailOutboxRecipient): Promise<string> {
  if (recipient.kind === 'operations') {
    const configured = process.env.EMAIL_OPS_DESTINATION?.trim();
    if (!configured) throw new Error('EMAIL_OPS_DESTINATION is not configured');
    return configured;
  }
  if (recipient.kind === 'contact') {
    const snapshot = await getAdminDb().collection('contact_submissions').doc(recipient.submissionId).get();
    const email = snapshot.data()?.email;
    if (typeof email !== 'string' || !email.trim()) throw new Error('Contact submission does not have a deliverable email address');
    return email;
  }
  const user = await getAdminAuth().getUser(recipient.uid);
  if (!user.email) throw new Error('User does not have a deliverable email address');
  return user.email;
}

async function isRecipientSuppressed(email: string): Promise<boolean> {
  const snapshot = await getAdminDb().collection('email_suppressions').doc(hashRecipient(email)).get();
  return snapshot.exists;
}

async function completeLease(
  messageId: string,
  leaseOwner: string,
  status: Exclude<EmailOutboxStatus, 'queued' | 'leased' | 'delivered' | 'delayed' | 'failed'>,
  update: Partial<EmailOutboxDocument>,
): Promise<void> {
  const db = getAdminDb();
  const docRef = db.collection(OUTBOX_COLLECTION).doc(messageId);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(docRef);
    const data = current.data() as EmailOutboxDocument | undefined;
    if (!data || data.status !== 'leased' || data.leaseOwner !== leaseOwner) return;
    transaction.update(docRef, {
      ...update,
      status,
      updatedAt: new Date().toISOString(),
      leaseOwner: null,
      leaseExpiresAt: null,
    });
  });
}

function inspectPayload(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectPayload(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_PAYLOAD_KEY.test(key)) throw new Error(`Sensitive email payload field cannot be persisted: ${path}.${key}`);
    inspectPayload(nested, `${path}.${key}`);
  }
}

function sanitizeMetadata(value: EnqueueEmailInput['metadata']): Record<string, string | number | boolean | null> {
  if (!value) return {};
  const entries = Object.entries(value).slice(0, 20).map(([key, item]) => {
    if (SENSITIVE_PAYLOAD_KEY.test(key)) throw new Error('Sensitive email metadata cannot be persisted');
    const safeKey = key.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
    const safeValue = typeof item === 'string' ? item.replace(/[\r\n\t]+/g, ' ').slice(0, 300) : item;
    return [safeKey, safeValue] as const;
  });
  return Object.fromEntries(entries);
}

function normalizeAvailableAt(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new Error('Invalid email outbox availableAt timestamp');
  return new Date(timestamp).toISOString();
}

function safeError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value || 'Email delivery failed');
  return message.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
}

function hashRecipient(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
