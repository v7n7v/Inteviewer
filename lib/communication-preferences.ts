import { z } from 'zod';
import { getAdminDb } from './firebase-admin';
import { getJobAlertEmailConsent } from './job-notification-delivery';
import type { EmailPreferenceKey } from './email/contracts';

export const COMMUNICATION_PREFERENCES_VERSION = '2026-07-19';
export const COMMUNICATION_PREFERENCES_DOCUMENT = 'communicationPreferences';

export const communicationPreferencePatchSchema = z.object({
  studyReminders: z.boolean().optional(),
  applicationUpdates: z.boolean().optional(),
  interviewReminders: z.boolean().optional(),
  offerUpdates: z.boolean().optional(),
  weeklyRecap: z.boolean().optional(),
  marketing: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one preference is required');

export type CommunicationPreferencePatch = z.infer<typeof communicationPreferencePatchSchema>;

export interface CommunicationPreferences {
  version: string;
  revision: number;
  jobDigest: boolean;
  studyReminders: boolean;
  applicationUpdates: boolean;
  interviewReminders: boolean;
  offerUpdates: boolean;
  weeklyRecap: boolean;
  marketing: boolean;
  optionalEmailPaused: boolean;
  optionalEmailPausedAt: string | null;
  optionalEmailPausedReason: string | null;
  updatedAt: string | null;
}

const optionalPreferenceKeys = [
  'studyReminders',
  'applicationUpdates',
  'interviewReminders',
  'offerUpdates',
  'weeklyRecap',
  'marketing',
] as const;

export function normalizeCommunicationPreferences(
  value: Record<string, unknown> | null | undefined,
  jobDigest = false,
): CommunicationPreferences {
  const data = value || {};
  return {
    version: typeof data.version === 'string' ? data.version : COMMUNICATION_PREFERENCES_VERSION,
    revision: typeof data.revision === 'number' && Number.isSafeInteger(data.revision) ? Math.max(0, data.revision) : 0,
    jobDigest,
    studyReminders: data.studyReminders === true,
    applicationUpdates: data.applicationUpdates === true,
    interviewReminders: data.interviewReminders === true,
    offerUpdates: data.offerUpdates === true,
    weeklyRecap: data.weeklyRecap === true,
    // Marketing remains hard-disabled until the separately approved launch gate is opened.
    marketing: process.env.EMAIL_MARKETING_ENABLED === 'true' && data.marketing === true,
    optionalEmailPaused: data.optionalEmailPaused === true,
    optionalEmailPausedAt: optionalString(data.optionalEmailPausedAt),
    optionalEmailPausedReason: optionalString(data.optionalEmailPausedReason),
    updatedAt: optionalString(data.updatedAt),
  };
}

export async function readCommunicationPreferences(uid: string): Promise<CommunicationPreferences> {
  const db = getAdminDb();
  const settings = db.collection('users').doc(uid).collection('settings');
  const [communicationSnap, jobsSnap] = await Promise.all([
    settings.doc(COMMUNICATION_PREFERENCES_DOCUMENT).get(),
    settings.doc('jobPreferences').get(),
  ]);
  const jobDigest = getJobAlertEmailConsent(jobsSnap.data()).granted;
  return normalizeCommunicationPreferences(communicationSnap.data(), jobDigest);
}

export async function getOptionalEmailPermission(
  uid: string,
  preferenceKey: EmailPreferenceKey,
): Promise<{ allowed: boolean; reason: string | null; preferences: CommunicationPreferences }> {
  const preferences = await readCommunicationPreferences(uid);
  if (preferences.optionalEmailPaused) {
    return { allowed: false, reason: preferences.optionalEmailPausedReason || 'Optional email is paused', preferences };
  }
  if (preferenceKey === 'jobDigest') {
    return { allowed: preferences.jobDigest, reason: preferences.jobDigest ? null : 'Career Picks email is not enabled', preferences };
  }
  if (!optionalPreferenceKeys.includes(preferenceKey as (typeof optionalPreferenceKeys)[number])) {
    return { allowed: false, reason: 'Unknown optional email preference', preferences };
  }
  const allowed = preferences[preferenceKey as (typeof optionalPreferenceKeys)[number]];
  return { allowed, reason: allowed ? null : `${preferenceKey} email is not enabled`, preferences };
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 300) : null;
}
