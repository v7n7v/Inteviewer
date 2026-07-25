import type { AdminEvidenceMeta, AdminEvidenceState } from '@/lib/admin/contracts';

const DEFAULT_FRESHNESS_MS = 5 * 60 * 1000;

export function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

export function adminEvidence(input: {
  state: AdminEvidenceState;
  source: string;
  complete: boolean;
  sampleLimit?: number | null;
  sampleCapped?: boolean;
  limitations?: string[];
  generatedAt?: string;
  freshnessMs?: number | null;
}): AdminEvidenceMeta {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const timestamp = Date.parse(generatedAt);
  const freshnessMs = input.freshnessMs === undefined ? DEFAULT_FRESHNESS_MS : input.freshnessMs;
  return {
    generatedAt,
    state: input.state,
    freshUntil: freshnessMs == null || !Number.isFinite(timestamp)
      ? null
      : new Date(timestamp + Math.max(0, freshnessMs)).toISOString(),
    source: input.source,
    complete: input.complete,
    sampleLimit: input.sampleLimit ?? null,
    sampleCapped: Boolean(input.sampleCapped),
    limitations: [...new Set(input.limitations || [])].slice(0, 20),
  };
}

export function evidenceState(input: {
  ready?: boolean;
  configured?: boolean;
  unavailable?: boolean;
  degraded?: boolean;
}): AdminEvidenceState {
  if (input.unavailable) return 'unknown';
  if (input.ready) return 'ready';
  if (input.degraded || input.configured) return 'degraded';
  return 'blocked';
}

export function evidenceAgeSeconds(checkedAt: unknown, now = Date.now()) {
  if (typeof checkedAt !== 'string') return null;
  const timestamp = Date.parse(checkedAt);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.round((now - timestamp) / 1000));
}

export function operationalSecretConfigured(value: string | undefined, prefix?: string) {
  const normalized = value?.trim() || '';
  if (!normalized) return false;
  if (prefix && !normalized.startsWith(prefix)) return false;
  return !/(?:your[_-]?|replace[_-]?|change[_-]?me|placeholder|example|todo|\$\{)/i.test(normalized);
}
