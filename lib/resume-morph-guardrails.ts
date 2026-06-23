import { createHash } from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  RESUME_MORPH_ACKNOWLEDGEMENTS,
  RESUME_MORPH_CONSENT_VERSION,
  RESUME_MORPH_DEFAULT_MAX,
  RESUME_MORPH_FULL_UNLOCK,
  type ResumeMorphConsentStatus,
} from '@/lib/resume-morph-safety';

export interface ResumeMorphAccess {
  requestedMorphPercentage: number;
  effectiveMorphPercentage: number;
  maxAllowedMorphPercentage: number;
  consentUsed: boolean;
  requiresMorphConsent: boolean;
  mode: 'manual' | 'automated';
}

export interface GuardrailBlockedChange {
  path: string;
  original: string;
  attempted: string;
  action: 'restored' | 'removed';
}

export interface ResumeMorphGuardrailReport {
  requestedMorphPercentage: number;
  effectiveMorphPercentage: number;
  maxAllowedMorphPercentage: number;
  consentUsed: boolean;
  protectedFields: string[];
  blockedChanges: GuardrailBlockedChange[];
  blockedChangeCount: number;
}

const PROTECTED_FIELDS = [
  'education',
  'certifications',
  'licenses',
  'contact',
  'identity',
  'experience.company',
  'experience.role',
  'experience.duration',
  'experience.location',
];

const TOP_LEVEL_PROTECTED_KEYS = [
  'name',
  'title',
  'email',
  'phone',
  'location',
  'linkedin',
  'website',
  'address',
  'city',
  'state',
  'country',
];

const EXPERIENCE_PROTECTED_GROUPS = [
  ['company', 'organization', 'employer'],
  ['role', 'title', 'position', 'jobTitle'],
  ['duration', 'dates', 'period', 'startDate', 'endDate'],
  ['location'],
];

function clampPercentage(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(10, Math.min(RESUME_MORPH_FULL_UNLOCK, Math.round(parsed)));
}

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function comparable(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  return JSON.stringify(value);
}

function printable(value: unknown) {
  const text = value === undefined ? 'undefined' : value === null ? 'null' : typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function isBlank(value: unknown) {
  return value === undefined || value === null || value === '';
}

function recordChange(
  changes: GuardrailBlockedChange[],
  path: string,
  original: unknown,
  attempted: unknown,
  action: 'restored' | 'removed' = 'restored'
) {
  if (comparable(original) === comparable(attempted)) return;
  if (changes.length >= 100) return;
  changes.push({
    path,
    original: printable(original),
    attempted: printable(attempted),
    action,
  });
}

function restoreTopLevelProtectedFields(original: any, target: any, changes: GuardrailBlockedChange[]) {
  for (const key of TOP_LEVEL_PROTECTED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(original || {}, key)) {
      recordChange(changes, key, original[key], target?.[key], 'restored');
      target[key] = clone(original[key]);
    } else if (!isBlank(target?.[key])) {
      recordChange(changes, key, undefined, target[key], 'removed');
      delete target[key];
    }
  }
}

function protectedExperienceKey(entry: any) {
  return [
    entry?.company || entry?.organization || entry?.employer || '',
    entry?.role || entry?.title || entry?.position || entry?.jobTitle || '',
    entry?.duration || entry?.dates || entry?.period || entry?.startDate || '',
    entry?.endDate || '',
  ].map((part) => String(part).toLowerCase().replace(/\s+/g, ' ').trim()).join('|');
}

function restoreAliasGroup(originalEntry: any, targetEntry: any, aliases: string[], path: string, changes: GuardrailBlockedChange[]) {
  const originalHasAny = aliases.some((key) => Object.prototype.hasOwnProperty.call(originalEntry || {}, key));

  for (const key of aliases) {
    const fieldPath = `${path}.${key}`;
    if (Object.prototype.hasOwnProperty.call(originalEntry || {}, key)) {
      recordChange(changes, fieldPath, originalEntry[key], targetEntry?.[key], 'restored');
      targetEntry[key] = clone(originalEntry[key]);
    } else if (originalHasAny && !isBlank(targetEntry?.[key])) {
      recordChange(changes, fieldPath, undefined, targetEntry[key], 'removed');
      delete targetEntry[key];
    }
  }
}

function restoreExperience(original: any, target: any, changes: GuardrailBlockedChange[]) {
  const originalExperience = Array.isArray(original?.experience) ? original.experience : [];
  const targetExperience = Array.isArray(target?.experience) ? target.experience : [];

  if (targetExperience.length > originalExperience.length) {
    recordChange(changes, 'experience', `${originalExperience.length} entries`, `${targetExperience.length} entries`, 'removed');
  } else if (targetExperience.length < originalExperience.length) {
    recordChange(changes, 'experience', `${originalExperience.length} entries`, `${targetExperience.length} entries`, 'restored');
  }

  const targetEntries = originalExperience.map((originalEntry: any, index: number) => (
    targetExperience[index] ? targetExperience[index] : clone(originalEntry)
  ));

  type ExperienceSource = { entry: any; index: number; key: string; used: boolean };

  const available: ExperienceSource[] = originalExperience.map((entry: any, index: number) => ({
    entry,
    index,
    key: protectedExperienceKey(entry),
    used: false,
  }));

  const guardedExperience = targetEntries.slice(0, originalExperience.length).map((targetEntry: any, index: number) => {
    const targetKey = protectedExperienceKey(targetEntry);
    const exactMatch = targetKey
      ? available.find((item: ExperienceSource) => !item.used && item.key && item.key === targetKey)
      : undefined;
    const source = exactMatch || available.find((item: ExperienceSource) => !item.used && item.index === index) || available[index];
    if (source) source.used = true;

    const guardedEntry = clone(targetEntry || {});
    const originalEntry = source?.entry || originalExperience[index] || {};

    for (const aliases of EXPERIENCE_PROTECTED_GROUPS) {
      restoreAliasGroup(originalEntry, guardedEntry, aliases, `experience.${index}`, changes);
    }

    return guardedEntry;
  });

  target.experience = guardedExperience;
}

function restoreExactArray(original: any, target: any, key: string, changes: GuardrailBlockedChange[]) {
  const originalValue = Array.isArray(original?.[key]) ? original[key] : [];
  const targetValue = Array.isArray(target?.[key]) ? target[key] : [];
  recordChange(changes, key, originalValue, targetValue, originalValue.length ? 'restored' : 'removed');
  target[key] = clone(originalValue);
}

export function resolveResumeMorphAccess(input: {
  requestedMorphPercentage?: number;
  hasFullConsent: boolean;
  mode: 'manual' | 'automated';
}): ResumeMorphAccess {
  const requestedMorphPercentage = clampPercentage(input.requestedMorphPercentage ?? 50);
  const maxAllowedMorphPercentage = input.hasFullConsent ? RESUME_MORPH_FULL_UNLOCK : RESUME_MORPH_DEFAULT_MAX;
  const requiresMorphConsent = input.mode === 'manual'
    && requestedMorphPercentage > RESUME_MORPH_DEFAULT_MAX
    && !input.hasFullConsent;
  const effectiveMorphPercentage = input.mode === 'automated' || !requiresMorphConsent
    ? Math.min(requestedMorphPercentage, maxAllowedMorphPercentage)
    : RESUME_MORPH_DEFAULT_MAX;

  return {
    requestedMorphPercentage,
    effectiveMorphPercentage,
    maxAllowedMorphPercentage,
    consentUsed: input.hasFullConsent && requestedMorphPercentage > RESUME_MORPH_DEFAULT_MAX,
    requiresMorphConsent,
    mode: input.mode,
  };
}

export function applyResumeMorphGuardrails(
  originalResume: any,
  morphedResume: any,
  access: ResumeMorphAccess
): { resume: any; report: ResumeMorphGuardrailReport } {
  const original = clone(originalResume || {});
  const guarded = clone(morphedResume || {});
  const blockedChanges: GuardrailBlockedChange[] = [];

  restoreTopLevelProtectedFields(original, guarded, blockedChanges);
  restoreExactArray(original, guarded, 'education', blockedChanges);
  restoreExactArray(original, guarded, 'certifications', blockedChanges);
  restoreExactArray(original, guarded, 'licenses', blockedChanges);
  restoreExactArray(original, guarded, 'professionalLicenses', blockedChanges);
  restoreExperience(original, guarded, blockedChanges);

  return {
    resume: guarded,
    report: {
      requestedMorphPercentage: access.requestedMorphPercentage,
      effectiveMorphPercentage: access.effectiveMorphPercentage,
      maxAllowedMorphPercentage: access.maxAllowedMorphPercentage,
      consentUsed: access.consentUsed,
      protectedFields: PROTECTED_FIELDS,
      blockedChanges,
      blockedChangeCount: blockedChanges.length,
    },
  };
}

export function hashResumeMorphAcknowledgements() {
  return createHash('sha256')
    .update(`${RESUME_MORPH_CONSENT_VERSION}:${RESUME_MORPH_ACKNOWLEDGEMENTS.join('|')}`)
    .digest('hex');
}

export async function getResumeMorphConsentForUser(uid: string): Promise<ResumeMorphConsentStatus> {
  if (!uid || uid.startsWith('anon:')) {
    return {
      unlocked100: false,
      acceptedAt: null,
      consentVersion: RESUME_MORPH_CONSENT_VERSION,
    };
  }

  const snap = await getAdminDb()
    .collection('users')
    .doc(uid)
    .collection('settings')
    .doc('resumeMorphSafety')
    .get();
  const data = snap.exists ? snap.data() || {} : {};
  const unlocked100 = data.unlocked100 === true
    && data.consentVersion === RESUME_MORPH_CONSENT_VERSION
    && !data.disabledAt;

  return {
    unlocked100,
    acceptedAt: typeof data.acceptedAt === 'string' ? data.acceptedAt : null,
    consentVersion: typeof data.consentVersion === 'string' ? data.consentVersion : RESUME_MORPH_CONSENT_VERSION,
    disabledAt: typeof data.disabledAt === 'string' ? data.disabledAt : null,
  };
}
