import 'server-only';
import {
  isStrongObservabilitySecret,
  parseObservabilityKeyRegistry,
} from '@/lib/observability/subject';

const DEFAULT_RETENTION_DAYS = 7;
const DEFAULT_SHARD_COUNT = 16;
const MIN_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 90;
const MIN_SHARDS = 4;
const MAX_SHARDS = 32;
const DEFAULT_EVIDENCE_RETENTION_DAYS = 30;
const MIN_EVIDENCE_RETENTION_DAYS = 30;
const MAX_EVIDENCE_RETENTION_DAYS = 730;

function boundedInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

export function observabilityEnabled(): boolean {
  return process.env.USER_OBSERVABILITY_V1_ENABLED === 'true';
}

export function observabilityRetentionDays(): number {
  return boundedInteger(
    process.env.OBSERVABILITY_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS,
    MIN_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
  );
}

export function observabilityShardCount(): number {
  return boundedInteger(
    process.env.OBSERVABILITY_DAILY_SHARDS,
    DEFAULT_SHARD_COUNT,
    MIN_SHARDS,
    MAX_SHARDS,
  );
}

export function observabilityCaseRetentionDays(): number {
  return boundedInteger(
    process.env.OBSERVABILITY_CASE_RETENTION_DAYS,
    DEFAULT_EVIDENCE_RETENTION_DAYS,
    MIN_EVIDENCE_RETENTION_DAYS,
    MAX_EVIDENCE_RETENTION_DAYS,
  );
}

export function observabilityAccessAuditRetentionDays(): number {
  return boundedInteger(
    process.env.OBSERVABILITY_ACCESS_AUDIT_RETENTION_DAYS,
    DEFAULT_EVIDENCE_RETENTION_DAYS,
    MIN_EVIDENCE_RETENTION_DAYS,
    MAX_EVIDENCE_RETENTION_DAYS,
  );
}

export function observabilityResetJobRetentionDays(): number {
  return boundedInteger(
    process.env.OBSERVABILITY_RESET_JOB_RETENTION_DAYS,
    DEFAULT_EVIDENCE_RETENTION_DAYS,
    MIN_EVIDENCE_RETENTION_DAYS,
    MAX_EVIDENCE_RETENTION_DAYS,
  );
}

export function observabilityPolicyApproved(): boolean {
  return process.env.OBSERVABILITY_RETENTION_POLICY_APPROVED === 'true';
}

export function observabilityNoticeVersion(): string {
  const value = String(process.env.OBSERVABILITY_NOTICE_VERSION || 'observability-privacy-v1');
  return /^[a-z0-9][a-z0-9._-]{2,63}$/i.test(value)
    ? value
    : 'observability-privacy-v1';
}

export function observabilityProductionReady(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const explicitRetention = Number(process.env.OBSERVABILITY_RETENTION_DAYS);
  const explicitShards = Number(process.env.OBSERVABILITY_DAILY_SHARDS);
  const explicitCaseRetention = Number(process.env.OBSERVABILITY_CASE_RETENTION_DAYS);
  const explicitAuditRetention = Number(process.env.OBSERVABILITY_ACCESS_AUDIT_RETENTION_DAYS);
  const explicitResetRetention = Number(process.env.OBSERVABILITY_RESET_JOB_RETENTION_DAYS);
  const policyVersion = String(process.env.OBSERVABILITY_RETENTION_POLICY_VERSION || '');
  const noticeVersion = String(process.env.OBSERVABILITY_NOTICE_VERSION || '');
  const cursorSecret = process.env.OBSERVABILITY_CURSOR_SECRET;
  let registry: ReturnType<typeof parseObservabilityKeyRegistry> | null = null;
  let retainedVersions: unknown = null;
  try {
    registry = parseObservabilityKeyRegistry({ requireStrongSecrets: true });
    retainedVersions = JSON.parse(
      String(process.env.OBSERVABILITY_RETAINED_KEY_VERSIONS_JSON || ''),
    );
  } catch {
    return false;
  }
  const retainedKeyVersions = Array.isArray(retainedVersions)
    && retainedVersions.length >= 1
    && retainedVersions.length <= 3
    && retainedVersions.every(
      version => typeof version === 'string' && registry?.keys.has(version),
    )
    && new Set(retainedVersions).size === retainedVersions.length
    && retainedVersions.includes(registry.activeVersion);
  const cursorIsIndependent = isStrongObservabilitySecret(cursorSecret)
    && ![...registry.keys.values()].includes(cursorSecret);
  return Number.isInteger(explicitRetention)
    && explicitRetention >= MIN_RETENTION_DAYS
    && explicitRetention <= MAX_RETENTION_DAYS
    && Number.isInteger(explicitShards)
    && explicitShards >= MIN_SHARDS
    && explicitShards <= MAX_SHARDS
    && Number.isInteger(explicitCaseRetention)
    && explicitCaseRetention >= MIN_EVIDENCE_RETENTION_DAYS
    && explicitCaseRetention <= MAX_EVIDENCE_RETENTION_DAYS
    && Number.isInteger(explicitAuditRetention)
    && explicitAuditRetention >= MIN_EVIDENCE_RETENTION_DAYS
    && explicitAuditRetention <= MAX_EVIDENCE_RETENTION_DAYS
    && Number.isInteger(explicitResetRetention)
    && explicitResetRetention >= MIN_EVIDENCE_RETENTION_DAYS
    && explicitResetRetention <= MAX_EVIDENCE_RETENTION_DAYS
    && /^[a-z0-9][a-z0-9._-]{2,63}$/i.test(policyVersion)
    && /^[a-z0-9][a-z0-9._-]{2,63}$/i.test(noticeVersion)
    && observabilityPolicyApproved()
    && process.env.ADMIN_MFA_ENFORCED === 'true'
    && process.env.FIREBASE_MFA_PROJECT_ENABLED === 'true'
    && retainedKeyVersions
    && cursorIsIndependent;
}

export function observabilitySurfaceAvailable(): boolean {
  return observabilityEnabled() && observabilityProductionReady();
}

export const OBSERVABILITY_MINIMUM_CELL_SIZE = 10;
export const OBSERVABILITY_MAX_BODY_BYTES = 32_768;
export const OBSERVABILITY_MAX_BATCH_SIZE = 20;
export const OBSERVABILITY_MAX_EVENT_BYTES = 8_192;
export const OBSERVABILITY_GRANT_MS = 24 * 60 * 60_000;
export const OBSERVABILITY_STEP_UP_MS = 15 * 60_000;
export const OBSERVABILITY_RECENT_AUTH_MS = 5 * 60_000;
