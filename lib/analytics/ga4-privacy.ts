'use client';

export const GA4_MEASUREMENT_ID = 'G-8HXZDQQ3YJ';
export const PRODUCT_ANALYTICS_CONSENT_EVENT = 'talent:analytics-consent-changed';
export const PRODUCT_ANALYTICS_REVOCATION_CHANNEL = 'talent-observability-consent-v1';
const PRODUCT_ANALYTICS_REVOCATION_PENDING_KEY = 'talent:analytics-revocation-pending';

export type ProductAnalyticsConsent = 'granted' | 'denied';

interface VerifiedAnalyticsConsent {
  uid: string;
  noticeVersion: string;
}

let verifiedAnalyticsConsent: VerifiedAnalyticsConsent | null = null;
let productAnalyticsRevocationPending = false;

export type SafeGa4Event =
  | 'sign_up'
  | 'login'
  | 'begin_checkout'
  | 'upgrade_viewed'
  | 'upgrade_plan_selected'
  | 'upgrade_interval_selected'
  | 'checkout_session_failed'
  | 'purchase'
  | 'tool_use'
  | 'resume_download'
  | 'job_search'
  | 'job_apply'
  | 'preferences_saved'
  | 'sona_resume_upload_started'
  | 'sona_resume_parsed'
  | 'sona_resume_upload_failed'
  | 'sona_resume_handoff_staged'
  | 'sona_resume_auth_presented'
  | 'sona_resume_auth_abandoned'
  | 'sona_resume_saved'
  | 'sona_target_prompt_submitted'
  | 'sona_packet_prompt_started'
  | 'email_digest_sent'
  | 'newsletter_subscribe'
  | 'digest_sent'
  | 'digest_click_prepare'
  | 'digest_unsubscribe'
  | 'social_signup'
  | 'auth_lifecycle';

type SafeParamValue = string | number | boolean;
export type SafeGa4Params = Record<string, SafeParamValue>;

const TIERS = ['free', 'pro', 'studio', 'god'] as const;
const INTERVALS = ['monthly', 'yearly', 'month', 'year'] as const;
const AUTH_METHODS = ['email', 'google', 'mfa'] as const;
const AUTH_RESULTS = ['success', 'error', 'redirecting', 'cancelled'] as const;
const HOST_CLASSES = ['production', 'firebase-hosting', 'localhost', 'other'] as const;
const CHECKOUT_SOURCES = ['upgrade_page', 'resume_upgrade_modal'] as const;
const CHECKOUT_FAILURES = ['network_or_unknown', 'server_rejected', 'missing_client_secret'] as const;
const TOOLS = [
  'resume_morph',
  'resume_check',
  'cover_letter',
  'writing_tools',
  'interview_prep',
  'job_search',
  'skill_bridge',
  'taco',
] as const;
const ASSISTANT_SOURCES = [
  'sona_agent',
  'landing_hero',
  'landing_handoff',
  'target_brief',
  'resume_upload',
  'sona_resume_upload',
] as const;
const SOURCE_TYPES = ['pdf', 'docx', 'txt', 'paste', 'existing_resume', 'other'] as const;
const WORK_MODES = ['hybrid', 'remote', 'onsite', 'any', 'unspecified'] as const;
const NEWSLETTER_SOURCES = [
  'public_capture',
  'job_search_weekly_picks',
  'landing',
  'landing_hero',
  'sona_picks',
  'other',
] as const;
const FREQUENCIES = ['weekly', 'daily', 'monthly'] as const;
const RESUME_FAILURES = [
  'file_too_large',
  'unsupported_type',
  'auth_required',
  'scanned_pdf',
  'parse_empty',
  'parse_failed',
  'handoff_failed',
] as const;
const AUTH_ERROR_BUCKETS = [
  'cancelled',
  'configuration',
  'credential',
  'network',
  'rate_limited',
  'user_action',
  'unknown',
] as const;

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback?: T[number],
): T[number] | undefined {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T[number];
  }
  return fallback;
}

function finiteNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

function countBand(value: unknown): string {
  const count = finiteNumber(value, 0, 1_000_000) ?? 0;
  if (count === 0) return '0';
  if (count <= 3) return '1_3';
  if (count <= 10) return '4_10';
  if (count <= 50) return '11_50';
  return '51_plus';
}

function characterBand(value: unknown): string {
  const count = finiteNumber(value, 0, 10_000_000) ?? 0;
  if (count === 0) return '0';
  if (count <= 1_000) return '1_1000';
  if (count <= 5_000) return '1001_5000';
  if (count <= 20_000) return '5001_20000';
  return '20001_plus';
}

function authErrorBucket(value: unknown): typeof AUTH_ERROR_BUCKETS[number] {
  if (typeof value !== 'string') return 'unknown';
  const code = value.toLowerCase();
  if (code.includes('cancel') || code.includes('popup-closed')) return 'cancelled';
  if (code.includes('network') || code.includes('timeout')) return 'network';
  if (code.includes('too-many') || code.includes('rate')) return 'rate_limited';
  if (code.includes('config') || code.includes('domain') || code.includes('api-key')) return 'configuration';
  if (code.includes('credential') || code.includes('password') || code.includes('token')) return 'credential';
  if (code.includes('mfa') || code.includes('verification') || code.includes('user')) return 'user_action';
  return 'unknown';
}

function normalizedNewsletterSource(value: unknown): typeof NEWSLETTER_SOURCES[number] {
  return enumValue(value, NEWSLETTER_SOURCES, 'other')!;
}

function normalizedSourceType(value: unknown): typeof SOURCE_TYPES[number] {
  if (typeof value !== 'string') return 'other';
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (normalized.includes('pdf')) return 'pdf';
  if (normalized.includes('docx') || normalized.includes('word')) return 'docx';
  if (normalized.includes('txt') || normalized.includes('text')) return 'txt';
  if (normalized.includes('paste')) return 'paste';
  if (normalized.includes('existing')) return 'existing_resume';
  return 'other';
}

export function readProductAnalyticsConsent(): ProductAnalyticsConsent {
  return verifiedAnalyticsConsent ? 'granted' : 'denied';
}

export function hasProductAnalyticsConsent(): boolean {
  return verifiedAnalyticsConsent !== null;
}

export function hasPendingProductAnalyticsRevocation(): boolean {
  if (productAnalyticsRevocationPending) return true;
  if (typeof window === 'undefined') return false;
  try {
    productAnalyticsRevocationPending = window.localStorage.getItem(
      PRODUCT_ANALYTICS_REVOCATION_PENDING_KEY,
    ) === '1';
  } catch {
    // Storage denial cannot create analytics authority.
  }
  return productAnalyticsRevocationPending;
}

function emitConsentChanged(consent: ProductAnalyticsConsent) {
  if (
    typeof window !== 'undefined'
    && typeof window.dispatchEvent === 'function'
    && typeof CustomEvent !== 'undefined'
  ) {
    window.dispatchEvent(new CustomEvent(PRODUCT_ANALYTICS_CONSENT_EVENT, { detail: consent }));
  }
}

export function applyVerifiedProductAnalyticsConsent(input: {
  consent: ProductAnalyticsConsent;
  uid: string;
  noticeVersion: string;
  collectionEnabled: boolean;
}): void {
  verifiedAnalyticsConsent = !hasPendingProductAnalyticsRevocation()
    && input.consent === 'granted'
    && input.collectionEnabled
    && typeof input.uid === 'string'
    && input.uid.length > 0
    && input.uid.length <= 256
    && /^[a-z0-9][a-z0-9._-]{2,63}$/i.test(input.noticeVersion)
    ? { uid: input.uid, noticeVersion: input.noticeVersion }
    : null;
  emitConsentChanged(verifiedAnalyticsConsent ? 'granted' : 'denied');
}

export function broadcastProductAnalyticsRevocation(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(PRODUCT_ANALYTICS_REVOCATION_CHANNEL);
  channel.postMessage({ type: 'product_analytics_revoked' });
  channel.close();
}

export function markProductAnalyticsRevocationPending(
  options: { broadcast?: boolean } = {},
): void {
  productAnalyticsRevocationPending = true;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PRODUCT_ANALYTICS_REVOCATION_PENDING_KEY, '1');
    } catch {
      // The in-memory deny still applies for this page lifecycle.
    }
  }
  clearVerifiedProductAnalyticsConsent();
  if (options.broadcast) broadcastProductAnalyticsRevocation();
}

export function clearProductAnalyticsRevocationPending(): void {
  productAnalyticsRevocationPending = false;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PRODUCT_ANALYTICS_REVOCATION_PENDING_KEY);
  } catch {
    // A storage failure leaves no analytics grant behind.
  }
}

export function clearVerifiedProductAnalyticsConsent(
  options: { broadcast?: boolean } = {},
): void {
  verifiedAnalyticsConsent = null;
  emitConsentChanged('denied');
  if (options.broadcast) broadcastProductAnalyticsRevocation();
}

export function sanitizeGa4Event(
  event: SafeGa4Event,
  input: Record<string, unknown> = {},
): SafeGa4Params {
  const category = (value: string): SafeGa4Params => ({ event_category: value });

  switch (event) {
    case 'sign_up':
    case 'login':
      return {
        method: enumValue(input.method, AUTH_METHODS, 'email')!,
      };
    case 'auth_lifecycle':
      return {
        method: enumValue(input.method, AUTH_METHODS, 'email')!,
        result: enumValue(input.result, AUTH_RESULTS, 'error')!,
        hostname_class: enumValue(input.hostname_class, HOST_CLASSES, 'other')!,
        error_bucket: authErrorBucket(input.error_code),
        ...category('authentication'),
      };
    case 'begin_checkout': {
      const value = finiteNumber(input.value, 0, 100_000);
      return {
        tier: enumValue(input.tier, TIERS, 'free')!,
        ...(value === undefined ? {} : { value }),
        ...(input.currency === 'USD' ? { currency: 'USD' } : {}),
        source: enumValue(input.source, CHECKOUT_SOURCES, 'upgrade_page')!,
        interval: enumValue(input.interval, INTERVALS, 'monthly')!,
      };
    }
    case 'upgrade_viewed':
    case 'upgrade_plan_selected':
    case 'upgrade_interval_selected':
      return {
        source: enumValue(input.source, CHECKOUT_SOURCES, 'upgrade_page')!,
        tier: enumValue(input.tier, TIERS, 'free')!,
        interval: enumValue(input.interval, INTERVALS, 'monthly')!,
        ...category('conversion'),
      };
    case 'checkout_session_failed':
      return {
        source: enumValue(input.source, CHECKOUT_SOURCES, 'upgrade_page')!,
        tier: enumValue(input.tier, TIERS, 'free')!,
        interval: enumValue(input.interval, INTERVALS, 'monthly')!,
        reason: enumValue(input.reason, CHECKOUT_FAILURES, 'network_or_unknown')!,
        ...category('conversion'),
      };
    case 'purchase': {
      const value = finiteNumber(input.value, 0, 100_000) ?? 0;
      return {
        tier: enumValue(input.tier, TIERS, 'free')!,
        value,
        currency: 'USD',
      };
    }
    case 'tool_use':
      return {
        tool: enumValue(input.tool, TOOLS, 'taco')!,
        ...category('engagement'),
      };
    case 'resume_download':
      return {
        format: input.format === 'word' ? 'word' : 'pdf',
        ...category('engagement'),
      };
    case 'job_search':
      return {
        result_count_band: countBand(input.results),
        ...category('engagement'),
      };
    case 'job_apply':
      return category('engagement');
    case 'preferences_saved':
      return {
        role_count_band: countBand(input.roles),
        city_count_band: countBand(input.cities),
        ...category('engagement'),
      };
    case 'sona_resume_upload_started':
    case 'sona_packet_prompt_started':
      return {
        source: enumValue(input.source, ASSISTANT_SOURCES, 'sona_agent')!,
        ...category('activation'),
      };
    case 'sona_resume_parsed':
      return {
        source_type: normalizedSourceType(input.source_type),
        character_count_band: characterBand(input.character_count),
        ...category('activation'),
      };
    case 'sona_resume_upload_failed':
      return {
        source: enumValue(input.source, ASSISTANT_SOURCES, 'sona_agent')!,
        reason: enumValue(input.reason, RESUME_FAILURES, 'parse_failed')!,
        ...category('activation'),
      };
    case 'sona_resume_handoff_staged':
      return {
        source: 'landing_hero',
        ...category('activation'),
      };
    case 'sona_resume_auth_presented':
    case 'sona_resume_auth_abandoned':
      return {
        source: 'landing_hero',
        method: input.method === 'signup' ? 'signup' : 'login',
        ...category('activation'),
      };
    case 'sona_resume_saved':
      return category('activation');
    case 'sona_target_prompt_submitted':
      return {
        has_resume: input.has_resume === true,
        work_mode: enumValue(input.work_mode, WORK_MODES, 'unspecified')!,
        ...category('activation'),
      };
    case 'email_digest_sent':
    case 'digest_sent':
      return {
        job_count_band: countBand(input.job_count),
        ...(event === 'digest_sent'
          ? { frequency: enumValue(input.frequency, FREQUENCIES, 'weekly')! }
          : {}),
      };
    case 'newsletter_subscribe':
      return {
        source: normalizedNewsletterSource(input.source),
        frequency: enumValue(input.frequency, FREQUENCIES, 'weekly')!,
        ...category('growth'),
      };
    case 'digest_click_prepare':
    case 'digest_unsubscribe':
      return {
        source: normalizedNewsletterSource(input.source),
        ...category('growth'),
      };
    case 'social_signup':
      return {
        source: enumValue(input.source, ['google', 'linkedin', 'facebook', 'direct', 'other'] as const, 'other')!,
        ...category('growth'),
      };
  }
}
