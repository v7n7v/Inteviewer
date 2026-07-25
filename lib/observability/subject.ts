import 'server-only';
import { createHmac } from 'node:crypto';

const VERSION_PATTERN = /^[a-z0-9][a-z0-9_-]{0,15}$/i;
const MAX_KEY_VERSIONS = 3;
const MIN_SECRET_LENGTH = 32;
const PRODUCTION_MIN_SECRET_LENGTH = 48;
const PLACEHOLDER_SECRET_PATTERN =
  /(?:change[_ -]?me|replace|placeholder|example|todo|password|secret123|managed[_ -]?random|at[_ -]?least[_ -]?\d+)/i;

export interface ObservabilitySubjectKey {
  keyVersion: string;
  subjectKey: string;
}

export interface ObservabilityKeyRegistry {
  activeVersion: string;
  keys: ReadonlyMap<string, string>;
}

export function isStrongObservabilitySecret(value: unknown): value is string {
  if (
    typeof value !== 'string'
    || value.length < PRODUCTION_MIN_SECRET_LENGTH
    || Buffer.byteLength(value, 'utf8') > 256
    || PLACEHOLDER_SECRET_PATTERN.test(value)
  ) {
    return false;
  }
  const distinctCharacters = new Set(value).size;
  const repeatedUnit = /^(.{1,8})\1+$/.test(value);
  return distinctCharacters >= 12 && !repeatedUnit;
}

export function parseObservabilityKeyRegistry(input: {
  keysJson?: string;
  activeVersion?: string;
  requireStrongSecrets?: boolean;
} = {}): ObservabilityKeyRegistry {
  const keysJson = input.keysJson ?? process.env.OBSERVABILITY_HMAC_KEYS_JSON;
  const activeVersion = input.activeVersion ?? process.env.OBSERVABILITY_HMAC_ACTIVE_VERSION;
  if (!keysJson || !activeVersion || !VERSION_PATTERN.test(activeVersion)) {
    throw new Error('OBSERVABILITY_HMAC_CONFIGURATION_INVALID');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(keysJson);
  } catch {
    throw new Error('OBSERVABILITY_HMAC_CONFIGURATION_INVALID');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('OBSERVABILITY_HMAC_CONFIGURATION_INVALID');
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length < 1 || entries.length > MAX_KEY_VERSIONS) {
    throw new Error('OBSERVABILITY_HMAC_CONFIGURATION_INVALID');
  }
  const keys = new Map<string, string>();
  const requireStrongSecrets = input.requireStrongSecrets ?? process.env.NODE_ENV === 'production';
  for (const [version, secret] of entries) {
    if (
      !VERSION_PATTERN.test(version)
      || typeof secret !== 'string'
      || secret.length < MIN_SECRET_LENGTH
      || Buffer.byteLength(secret, 'utf8') > 256
      || (requireStrongSecrets && !isStrongObservabilitySecret(secret))
    ) {
      throw new Error('OBSERVABILITY_HMAC_CONFIGURATION_INVALID');
    }
    keys.set(version, secret);
  }
  if (!keys.has(activeVersion)) throw new Error('OBSERVABILITY_HMAC_CONFIGURATION_INVALID');
  if (new Set(keys.values()).size !== keys.size) {
    throw new Error('OBSERVABILITY_HMAC_CONFIGURATION_INVALID');
  }
  return { activeVersion, keys };
}

export function deriveObservabilitySubjectKey(
  firebaseUid: string,
  version: string,
  secret: string,
): ObservabilitySubjectKey {
  if (!firebaseUid || firebaseUid.length > 256 || !VERSION_PATTERN.test(version)) {
    throw new Error('OBSERVABILITY_SUBJECT_INVALID');
  }
  return {
    keyVersion: version,
    subjectKey: createHmac('sha256', secret)
      .update(`talentconsulting:observability:subject:v1:${firebaseUid}`)
      .digest('base64url'),
  };
}

export function deriveActiveObservabilitySubject(
  firebaseUid: string,
  registry = parseObservabilityKeyRegistry(),
): ObservabilitySubjectKey {
  const secret = registry.keys.get(registry.activeVersion);
  if (!secret) throw new Error('OBSERVABILITY_HMAC_CONFIGURATION_INVALID');
  return deriveObservabilitySubjectKey(firebaseUid, registry.activeVersion, secret);
}

export function deriveRetainedObservabilitySubjects(
  firebaseUid: string,
  registry = parseObservabilityKeyRegistry(),
): ObservabilitySubjectKey[] {
  return [...registry.keys.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([version, secret]) => deriveObservabilitySubjectKey(firebaseUid, version, secret));
}

export function observabilityRateLimitKey(
  purpose: string,
  firebaseUid: string,
  registry = parseObservabilityKeyRegistry(),
): string {
  if (!/^[a-z0-9][a-z0-9_-]{1,47}$/i.test(purpose)) {
    throw new Error('OBSERVABILITY_RATE_LIMIT_PURPOSE_INVALID');
  }
  const secret = registry.keys.get(registry.activeVersion);
  if (!secret) throw new Error('OBSERVABILITY_HMAC_CONFIGURATION_INVALID');
  const opaqueSubject = createHmac('sha256', secret)
    .update(`talentconsulting:observability:rate-limit:v1:${purpose}:${firebaseUid}`)
    .digest('base64url')
    .slice(0, 32);
  return `observability-${purpose}:${registry.activeVersion}:${opaqueSubject}`;
}
