/**
 * Email Send Functions
 * All functions use the shared template system from email-templates.ts
 * and send via Resend.
 */
import { Resend } from 'resend';
import { renderEmail } from './email/render';
import type { RenderedEmail } from './email/contracts';
import type { EmailCatalog, ImplementedEmailEventKey } from './email/catalog';
import type { z } from 'zod';
import { getBillingPrice } from '@/lib/billing-prices';
import { type BillingInterval, type BillingPlan } from '@/lib/billing-price-types';

export interface EmailSendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY not set');
    _resend = new Resend(key);
  }
  return _resend;
}

function providerErrorMessage(error: unknown): string {
  if (!error) return 'Unknown provider error';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export type EmailSendOptions = {
  idempotencyKey?: string;
  additionalTags?: Array<{ name: string; value: string }>;
};

export async function sendRenderedEmailResult(to: string, email: RenderedEmail, options: EmailSendOptions = {}): Promise<EmailSendResult> {
  try {
    if (!to) return { ok: false, error: 'Missing recipient email' };
    const result = await getResend().emails.send(
      {
        from: email.from,
        to: [to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: email.replyTo,
        headers: email.headers,
        tags: [...email.tags, ...(options.additionalTags || [])],
      },
      options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined,
    ) as {
      data?: { id?: string } | null;
      error?: unknown;
    };
    if (result.error) {
      const message = providerErrorMessage(result.error);
      console.error('[email] Send failed:', message);
      return { ok: false, error: message };
    }
    return { ok: true, id: result.data?.id };
  } catch (error) {
    console.error('[email] Send failed:', error);
    return { ok: false, error: providerErrorMessage(error) };
  }
}

/** Typed escape hatch for routes that already own a verified recipient and event payload. */
export async function sendEmailEventResult<TKey extends ImplementedEmailEventKey>(
  toEmail: string,
  event: TKey,
  payload: z.input<EmailCatalog[TKey]['schema']>,
  options?: EmailSendOptions,
): Promise<EmailSendResult> {
  const email = await renderEmail(event, payload);
  return sendRenderedEmailResult(toEmail, email, options);
}

/** Send account upgrade notification (admin-granted) */
export async function sendUpgradeEmailResult(toEmail: string, plan: string, months?: number): Promise<EmailSendResult> {
  const email = await renderEmail('account.access_changed', {
    planName: plan,
    accessSummary: months
      ? `Your upgraded access is available for ${months} month${months === 1 ? '' : 's'}.`
      : 'Your upgraded access is available now.',
  });
  return sendRenderedEmailResult(toEmail, email);
}

export async function sendUpgradeEmail(toEmail: string, plan: string, months?: number): Promise<boolean> {
  return (await sendUpgradeEmailResult(toEmail, plan, months)).ok;
}

/** Send welcome email after signup */
export async function sendWelcomeEmailResult(toEmail: string, name: string): Promise<EmailSendResult> {
  const email = await renderEmail('account.welcome', { recipientName: name || undefined });
  return sendRenderedEmailResult(toEmail, email);
}

export async function sendWelcomeEmail(toEmail: string, name: string): Promise<boolean> {
  return (await sendWelcomeEmailResult(toEmail, name)).ok;
}

/** Send subscription confirmation after Stripe checkout */
export async function sendSubscriptionEmailResult(toEmail: string, name: string, plan: string, interval: string, priceDisplay?: string, options?: EmailSendOptions): Promise<EmailSendResult> {
  let display = priceDisplay;
  if (!display && (plan === 'pro' || plan === 'studio') && (interval === 'month' || interval === 'year')) {
    const price = await getBillingPrice(plan as BillingPlan, interval as BillingInterval);
    display = price.unitAmount == null ? undefined : price.display;
  }
  const email = await renderEmail('billing.subscription_activated', {
    recipientName: name || undefined,
    planName: plan,
    interval: interval === 'month' || interval === 'year' ? interval : 'other',
    price: display,
  });
  return sendRenderedEmailResult(toEmail, email, options);
}

export async function sendSubscriptionEmail(toEmail: string, name: string, plan: string, interval: string, priceDisplay?: string): Promise<boolean> {
  return (await sendSubscriptionEmailResult(toEmail, name, plan, interval, priceDisplay)).ok;
}

/** Send cancellation notice */
export async function sendCancellationEmailResult(toEmail: string, name: string, accessEndsAt?: string, options?: EmailSendOptions): Promise<EmailSendResult> {
  const email = await renderEmail('billing.cancellation_scheduled', {
    recipientName: name || undefined,
    accessEndsAt,
  });
  return sendRenderedEmailResult(toEmail, email, options);
}

export async function sendCancellationEmail(toEmail: string, name: string, accessEndsAt?: string): Promise<boolean> {
  return (await sendCancellationEmailResult(toEmail, name, accessEndsAt)).ok;
}

/** Send trial ending warning */
export async function sendTrialEndingEmailResult(toEmail: string, name: string, daysLeft: number, options?: EmailSendOptions): Promise<EmailSendResult> {
  const email = await renderEmail('billing.trial_ending', {
    recipientName: name || undefined,
    daysLeft,
  });
  return sendRenderedEmailResult(toEmail, email, options);
}

export async function sendTrialEndingEmail(toEmail: string, name: string, daysLeft: number): Promise<boolean> {
  return (await sendTrialEndingEmailResult(toEmail, name, daysLeft)).ok;
}

/** Send plan change notification (upgrade/downgrade) */
export async function sendPlanChangeEmailResult(toEmail: string, name: string, oldPlan: string, newPlan: string, options?: EmailSendOptions): Promise<EmailSendResult> {
  const email = await renderEmail('billing.plan_changed', {
    recipientName: name || undefined,
    oldPlan,
    newPlan,
  });
  return sendRenderedEmailResult(toEmail, email, options);
}

export async function sendPlanChangeEmail(toEmail: string, name: string, oldPlan: string, newPlan: string): Promise<boolean> {
  return (await sendPlanChangeEmailResult(toEmail, name, oldPlan, newPlan)).ok;
}
