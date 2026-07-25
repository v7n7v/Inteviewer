/**
 * GA4 Analytics — Conversion Event Tracking
 * Centralized event tracking for key business metrics.
 */

import { ASSISTANT_ANALYTICS_CONTEXT } from '@/lib/assistant/compatibility';
import { classifyAuthHostname, type AuthLifecycleResult, type AuthMethod } from '@/lib/auth-flow';
import {
  GA4_MEASUREMENT_ID,
  hasProductAnalyticsConsent,
  sanitizeGa4Event,
  type SafeGa4Event,
} from '@/lib/analytics/ga4-privacy';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

type ConversionEvent = SafeGa4Event;

interface EventParams {
  method?: string;
  tool?: string;
  tier?: string;
  value?: number;
  currency?: string;
  [key: string]: unknown;
}

function track(event: ConversionEvent, params?: EventParams) {
  if (
    typeof window === 'undefined'
    || !window.gtag
    || !hasProductAnalyticsConsent()
  ) return;
  const assistantContext = event.startsWith('sona_') ? ASSISTANT_ANALYTICS_CONTEXT : {};
  const safeParams = sanitizeGa4Event(event, {
    ...assistantContext,
    ...params,
  });
  window.gtag('event', event, {
    ...safeParams,
    send_to: GA4_MEASUREMENT_ID,
  });
}

export const analytics = {
  /** Authentication outcome without email, user ID, token, or raw hostname. */
  authLifecycle(method: AuthMethod, result: AuthLifecycleResult, errorCode?: string) {
    track('auth_lifecycle', {
      method,
      result,
      hostname_class: classifyAuthHostname(
        typeof window === 'undefined' ? null : window.location.hostname,
      ),
      ...(errorCode ? { error_code: errorCode } : {}),
      event_category: 'authentication',
    });
  },

  /** User signed up (email or Google) */
  signUp(method: 'email' | 'google') {
    track('sign_up', { method });
  },

  /** User logged in */
  login(method: 'email' | 'google' | 'mfa') {
    track('login', { method });
  },

  /** User clicked upgrade / started checkout */
  beginCheckout(
    tier: string,
    value?: number,
    context: { source?: string; interval?: string; currency?: string } = {},
  ) {
    const currency = context.currency?.trim().toUpperCase();
    track('begin_checkout', {
      tier,
      ...(Number.isFinite(value) ? { value } : {}),
      ...(currency ? { currency } : {}),
      ...(context.source ? { source: context.source } : {}),
      ...(context.interval ? { interval: context.interval } : {}),
    });
  },

  upgradeViewed(source: string, tier: string, interval: string) {
    track('upgrade_viewed', { source, tier, interval, event_category: 'conversion' });
  },

  upgradePlanSelected(source: string, tier: string, interval: string) {
    track('upgrade_plan_selected', { source, tier, interval, event_category: 'conversion' });
  },

  upgradeIntervalSelected(source: string, tier: string, interval: string) {
    track('upgrade_interval_selected', { source, tier, interval, event_category: 'conversion' });
  },

  checkoutSessionFailed(source: string, tier: string, interval: string, reason: string) {
    track('checkout_session_failed', { source, tier, interval, reason, event_category: 'conversion' });
  },

  /** Stripe checkout completed */
  purchase(tier: string, value: number) {
    track('purchase', { tier, value, currency: 'USD' });
  },

  /** User used a core tool */
  toolUse(tool: string) {
    track('tool_use', { tool, event_category: 'engagement' });
  },

  /** Resume downloaded (PDF/Word) */
  resumeDownload(format: 'pdf' | 'word') {
    track('resume_download', { format, event_category: 'engagement' });
  },

  /** Job search executed */
  jobSearch(_query: string, resultCount: number) {
    track('job_search', { results: resultCount });
  },

  /** User clicked "Apply Now" on a job */
  jobApply(_company: string, _title: string) {
    track('job_apply');
  },

  /** Job preferences saved */
  preferencesSaved(roleCount: number, cityCount: number) {
    track('preferences_saved', { roles: roleCount, cities: cityCount });
  },

  assistantResumeUploadStarted(source = 'sona_agent') {
    track('sona_resume_upload_started', { source, event_category: 'activation' });
  },

  assistantResumeParsed(sourceType: string, characterCount: number) {
    track('sona_resume_parsed', { source_type: sourceType, character_count: characterCount, event_category: 'activation' });
  },

  assistantResumeUploadFailed(source: string, reason: string) {
    const allowedReasons = new Set([
      'file_too_large',
      'unsupported_type',
      'auth_required',
      'scanned_pdf',
      'parse_empty',
      'parse_failed',
      'handoff_failed',
    ]);
    track('sona_resume_upload_failed', {
      source,
      reason: allowedReasons.has(reason) ? reason : 'parse_failed',
      event_category: 'activation',
    });
  },

  assistantResumeHandoffStaged() {
    track('sona_resume_handoff_staged', { source: 'landing_hero', event_category: 'activation' });
  },

  assistantResumeAuthPresented(mode: 'login' | 'signup') {
    track('sona_resume_auth_presented', { source: 'landing_hero', method: mode, event_category: 'activation' });
  },

  assistantResumeAuthAbandoned(mode: 'login' | 'signup') {
    track('sona_resume_auth_abandoned', { source: 'landing_hero', method: mode, event_category: 'activation' });
  },

  assistantResumeSaved(_versionId: string) {
    track('sona_resume_saved', { event_category: 'activation' });
  },

  assistantTargetPromptSubmitted(hasResume: boolean, workMode?: string) {
    track('sona_target_prompt_submitted', { has_resume: hasResume, work_mode: workMode || 'unspecified', event_category: 'activation' });
  },

  assistantPacketPromptStarted(source = 'sona_agent') {
    track('sona_packet_prompt_started', { source, event_category: 'activation' });
  },

  // Compatibility methods retain the historical API while new code uses neutral names.
  sonaResumeUploadStarted(source = 'sona_agent') { return analytics.assistantResumeUploadStarted(source); },
  sonaResumeParsed(sourceType: string, characterCount: number) { return analytics.assistantResumeParsed(sourceType, characterCount); },
  sonaResumeUploadFailed(source: string, reason: string) { return analytics.assistantResumeUploadFailed(source, reason); },
  sonaResumeHandoffStaged() { return analytics.assistantResumeHandoffStaged(); },
  sonaResumeAuthPresented(mode: 'login' | 'signup') { return analytics.assistantResumeAuthPresented(mode); },
  sonaResumeAuthAbandoned(mode: 'login' | 'signup') { return analytics.assistantResumeAuthAbandoned(mode); },
  sonaResumeSaved(versionId: string) { return analytics.assistantResumeSaved(versionId); },
  sonaTargetPromptSubmitted(hasResume: boolean, workMode?: string) { return analytics.assistantTargetPromptSubmitted(hasResume, workMode); },
  sonaPacketPromptStarted(source = 'sona_agent') { return analytics.assistantPacketPromptStarted(source); },

  /** Weekly digest email sent */
  emailDigestSent(jobCount: number) {
    track('email_digest_sent', { job_count: jobCount });
  },

  newsletterSubscribe(source: string, frequency: string) {
    track('newsletter_subscribe', { source, frequency, event_category: 'growth' });
  },

  digestSent(jobCount: number, frequency?: string) {
    track('digest_sent', { job_count: jobCount, frequency, event_category: 'growth' });
  },

  digestClickPrepare(source = 'email') {
    track('digest_click_prepare', { source, event_category: 'growth' });
  },

  digestUnsubscribe(source = 'email') {
    track('digest_unsubscribe', { source, event_category: 'growth' });
  },

  socialSignup(source: string) {
    track('social_signup', { source, event_category: 'growth' });
  },
};
