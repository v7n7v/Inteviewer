/**
 * Email Send Functions
 * All functions use the shared template system from email-templates.ts
 * and send via Resend.
 */
import { Resend } from 'resend';
import {
  EMAIL_FROM,
  buildUpgradeEmail,
  buildWelcomeEmail,
  buildSubscriptionConfirmedEmail,
  buildSubscriptionCancelledEmail,
  buildTrialEndingEmail,
  buildPlanChangeEmail,
  buildCustomEmail,
} from './email-templates';
import { getBillingPrice } from '@/lib/billing-prices';
import { type BillingInterval, type BillingPlan } from '@/lib/billing-price-types';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY not set');
    _resend = new Resend(key);
  }
  return _resend;
}

async function send(to: string, subject: string, html: string): Promise<boolean> {
  try {
    if (!to) return false;
    await getResend().emails.send({ from: EMAIL_FROM, to: [to], subject, html });
    return true;
  } catch (error) {
    console.error('[email] Send failed:', error);
    return false;
  }
}

/** Send account upgrade notification (admin-granted) */
export async function sendUpgradeEmail(toEmail: string, plan: string, months?: number): Promise<boolean> {
  const { subject, html } = buildUpgradeEmail(plan, months);
  return send(toEmail, subject, html);
}

/** Send welcome email after signup */
export async function sendWelcomeEmail(toEmail: string, name: string): Promise<boolean> {
  const { subject, html } = buildWelcomeEmail(name);
  return send(toEmail, subject, html);
}

/** Send subscription confirmation after Stripe checkout */
export async function sendSubscriptionEmail(toEmail: string, name: string, plan: string, interval: string, priceDisplay?: string): Promise<boolean> {
  let display = priceDisplay;
  if (!display && (plan === 'pro' || plan === 'studio') && (interval === 'month' || interval === 'year')) {
    const price = await getBillingPrice(plan as BillingPlan, interval as BillingInterval);
    display = price.unitAmount == null ? undefined : price.display;
  }
  const { subject, html } = buildSubscriptionConfirmedEmail(name, plan, interval, display);
  return send(toEmail, subject, html);
}

/** Send cancellation notice */
export async function sendCancellationEmail(toEmail: string, name: string, accessEndsAt?: string): Promise<boolean> {
  const { subject, html } = buildSubscriptionCancelledEmail(name, accessEndsAt);
  return send(toEmail, subject, html);
}

/** Send trial ending warning */
export async function sendTrialEndingEmail(toEmail: string, name: string, daysLeft: number): Promise<boolean> {
  const { subject, html } = buildTrialEndingEmail(name, daysLeft);
  return send(toEmail, subject, html);
}

/** Send plan change notification (upgrade/downgrade) */
export async function sendPlanChangeEmail(toEmail: string, name: string, oldPlan: string, newPlan: string): Promise<boolean> {
  const { subject, html } = buildPlanChangeEmail(name, oldPlan, newPlan);
  return send(toEmail, subject, html);
}

/** Send custom admin email using the branded shell */
export async function sendCustomEmail(
  toEmail: string,
  subject: string,
  bodyHtml: string,
  ctaLabel?: string,
  ctaUrl?: string
): Promise<boolean> {
  const built = buildCustomEmail(subject, bodyHtml, ctaLabel, ctaUrl);
  return send(toEmail, built.subject, built.html);
}
