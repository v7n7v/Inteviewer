import type { z } from 'zod';

export const EMAIL_STREAMS = ['transactional', 'product', 'internal', 'marketing'] as const;
export type EmailStream = (typeof EMAIL_STREAMS)[number];

export const EMAIL_SENDERS = ['security', 'account', 'billing', 'taco', 'support', 'operations', 'marketing'] as const;
export type EmailSenderKey = (typeof EMAIL_SENDERS)[number];

export type EmailPersona = {
  kind: 'taco';
  presentation?: 'hero' | 'byline';
  role?: string;
  message?: string;
};

export type EmailSocialLink = {
  platform: 'x' | 'bluesky' | 'reddit';
  label: string;
  url: string;
};

export const EMAIL_PREFERENCE_KEYS = [
  'jobDigest',
  'studyReminders',
  'applicationUpdates',
  'interviewReminders',
  'offerUpdates',
  'weeklyRecap',
  'marketing',
] as const;
export type EmailPreferenceKey = (typeof EMAIL_PREFERENCE_KEYS)[number];

export const EMAIL_EVENT_KEYS = [
  'security.email_verification_requested',
  'security.password_reset_requested',
  'security.password_changed',
  'security.email_change_requested',
  'security.email_changed',
  'security.email_recovery_requested',
  'security.new_sign_in',
  'security.mfa_enabled',
  'security.mfa_disabled',
  'security.recovery_codes_generated',
  'security.admin_invitation',
  'security.sessions_revoked',
  'security.account_locked',
  'account.welcome',
  'account.preferences_updated',
  'account.deactivation_requested',
  'account.deactivated',
  'account.reactivated',
  'account.deletion_requested',
  'account.deleted',
  'account.export_ready',
  'account.material_policy_notice',
  'account.access_changed',
  'billing.subscription_activated',
  'billing.trial_started',
  'billing.trial_ending',
  'billing.renewal_upcoming',
  'billing.renewal_succeeded',
  'billing.invoice_available',
  'billing.payment_succeeded',
  'billing.payment_failed',
  'billing.payment_action_required',
  'billing.plan_changed',
  'billing.interval_changed',
  'billing.cancellation_scheduled',
  'billing.cancellation_reversed',
  'billing.subscription_ended',
  'billing.payment_method_expiring',
  'billing.payment_method_updated',
  'billing.price_change_notice',
  'billing.refund_requested',
  'billing.refund_succeeded',
  'billing.refund_failed',
  'billing.dispute_received',
  'billing.dispute_won',
  'billing.dispute_lost',
  'support.feedback_received',
  'support.case_opened',
  'support.case_updated',
  'support.case_resolved',
  'support.case_reopened',
  'support.billing_review_opened',
  'support.maintenance_scheduled',
  'support.incident_opened',
  'support.incident_updated',
  'support.incident_resolved',
  'product.career_picks',
  'product.taco_digest',
  'product.study_reminder',
  'product.application_update',
  'product.interview_reminder',
  'product.offer_update',
  'product.workflow_result',
  'product.weekly_recap',
  'internal.refund_escalation',
  'internal.dispute_escalation',
  'internal.stripe_reconciliation_failed',
  'internal.email_delivery_failed',
  'internal.email_queue_backlog',
  'internal.email_complaint_received',
  'internal.support_request_received',
  'internal.security_anomaly',
  'marketing.product_announcement',
  'marketing.educational_newsletter',
] as const;
export type EmailEventKey = (typeof EMAIL_EVENT_KEYS)[number];

export interface StructuredEmailContent {
  subject: string;
  preheader: string;
  category: string;
  title: string;
  greeting?: string;
  paragraphs: readonly string[];
  details?: readonly { label: string; value: string }[];
  items?: readonly string[];
  callout?: {
    title?: string;
    body: string;
    tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  };
  action?: { label: string; url: string };
  secondaryAction?: { label: string; url: string };
  persona?: EmailPersona;
  showSocialFooter?: boolean;
  socialLinks?: readonly EmailSocialLink[];
  footerNote?: string;
  preferenceUrl?: string;
  unsubscribeUrl?: string;
  mailingAddress?: string;
}

export interface EmailTemplateDefinition<TSchema extends z.ZodType = z.ZodType> {
  event: EmailEventKey;
  stream: EmailStream;
  sender: EmailSenderKey;
  preferenceKey: EmailPreferenceKey | null;
  templateVersion: string;
  schema: TSchema;
  build: (payload: z.output<TSchema>) => StructuredEmailContent;
}

export interface RenderedEmail {
  event: EmailEventKey;
  stream: EmailStream;
  sender: EmailSenderKey;
  preferenceKey: EmailPreferenceKey | null;
  templateVersion: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
  from: string;
  replyTo?: string;
  headers: Record<string, string>;
  tags: Array<{ name: string; value: string }>;
}
