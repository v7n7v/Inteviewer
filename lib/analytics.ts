/**
 * GA4 Analytics — Conversion Event Tracking
 * Centralized event tracking for key business metrics.
 */

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

type ConversionEvent =
  | 'sign_up'
  | 'login'
  | 'begin_checkout'
  | 'purchase'
  | 'tool_use'
  | 'resume_download'
  | 'job_search'
  | 'job_apply'
  | 'preferences_saved'
  | 'email_digest_sent';

interface EventParams {
  method?: string;
  tool?: string;
  tier?: string;
  value?: number;
  currency?: string;
  [key: string]: any;
}

function track(event: ConversionEvent, params?: EventParams) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', event, {
    ...params,
    send_to: 'G-8HXZDQQ3YJ',
  });
}

export const analytics = {
  /** User signed up (email or Google) */
  signUp(method: 'email' | 'google') {
    track('sign_up', { method });
  },

  /** User logged in */
  login(method: 'email' | 'google' | 'mfa') {
    track('login', { method });
  },

  /** User clicked upgrade / started checkout */
  beginCheckout(tier: string, value: number) {
    track('begin_checkout', { tier, value, currency: 'USD' });
  },

  /** Stripe checkout completed */
  purchase(tier: string, value: number) {
    track('purchase', { tier, value, currency: 'USD', transaction_id: `sub_${Date.now()}` });
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
  jobSearch(query: string, resultCount: number) {
    track('job_search', { search_term: query, results: resultCount });
  },

  /** User clicked "Apply Now" on a job */
  jobApply(company: string, title: string) {
    track('job_apply', { company, job_title: title });
  },

  /** Job preferences saved */
  preferencesSaved(roleCount: number, cityCount: number) {
    track('preferences_saved', { roles: roleCount, cities: cityCount });
  },

  /** Weekly digest email sent */
  emailDigestSent(jobCount: number) {
    track('email_digest_sent', { job_count: jobCount });
  },
};
