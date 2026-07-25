import { ASSISTANT_BRAND_VERSION } from './brand';

/** Historical identifiers remain readable so brand work cannot fragment billing evidence or provenance. */
export const LEGACY_ASSISTANT_IDENTIFIERS = {
  analyticsPrefix: 'sona_',
  careerPicksSource: 'sona_picks',
  briefType: 'sona_brief',
  uploadOrigin: 'sona_upload',
  dailyUsageDocument: 'sona_daily',
  economicsCollections: ['sona_economics_accounts', 'sona_economics_events', 'sona_economics_payments'],
} as const;

export const ASSISTANT_ANALYTICS_CONTEXT = {
  assistant_brand: 'taco',
  assistant_brand_version: ASSISTANT_BRAND_VERSION,
} as const;

export function resolveAssistantPreflightSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.TACO_PREFLIGHT_SECRET || env.SONA_PREFLIGHT_SECRET || '';
}

export function isLegacyAssistantSource(value: unknown): value is string {
  return typeof value === 'string' && (value.startsWith('sona_') || value === 'legacy_sona');
}
