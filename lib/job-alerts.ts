export type JobAlertsFrequency = 'daily' | 'weekly' | 'biweekly';
export type JobAlertsTier = 'free' | 'pro' | 'studio' | 'god';

export const JOB_ALERT_FREQUENCIES: JobAlertsFrequency[] = ['daily', 'weekly', 'biweekly'];

export function isPaidJobAlertsTier(tier?: string | null) {
  return tier === 'pro' || tier === 'studio' || tier === 'god';
}

export function isMaxJobAlertsTier(tier?: string | null) {
  return tier === 'studio' || tier === 'god';
}

export function normalizeJobAlertsFrequency(
  value: unknown,
  tier: string | null | undefined = 'free'
): JobAlertsFrequency {
  const freq = JOB_ALERT_FREQUENCIES.includes(value as JobAlertsFrequency)
    ? value as JobAlertsFrequency
    : 'weekly';

  if (freq === 'daily' && !isPaidJobAlertsTier(tier)) return 'weekly';
  return freq;
}

export function getJobAlertSendLimit(tier?: string | null) {
  if (isMaxJobAlertsTier(tier)) return 15;
  if (tier === 'pro') return 10;
  return 5;
}

export function getJobAlertFrequencyLabel(freq: JobAlertsFrequency, tier?: string | null) {
  if (freq === 'daily' && tier === 'pro') return '3x/week';
  if (freq === 'daily') return 'Daily';
  if (freq === 'biweekly') return 'Biweekly';
  return 'Weekly';
}

export function normalizeJobAlertKey(job: { title?: string; company?: string; location?: string; url?: string }) {
  const clean = (value = '') => value.toLowerCase().replace(/https?:\/\//, '').replace(/[^a-z0-9]+/g, ' ').trim();
  return [clean(job.company), clean(job.title), clean(job.location || ''), clean(job.url || '').slice(0, 90)]
    .filter(Boolean)
    .join('|');
}

function daysSince(dateString: string | undefined, now: Date) {
  if (!dateString) return Infinity;
  const time = new Date(dateString).getTime();
  if (Number.isNaN(time)) return Infinity;
  return (now.getTime() - time) / 86_400_000;
}

function sameUtcDay(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

export function shouldSendJobAlertDigest({
  enabled,
  emailNotifications,
  frequency,
  tier,
  lastSentAt,
  now = new Date(),
}: {
  enabled: boolean;
  emailNotifications: boolean;
  frequency: JobAlertsFrequency;
  tier: JobAlertsTier | string;
  lastSentAt?: string;
  now?: Date;
}): { send: boolean; reason?: string } {
  if (!enabled) return { send: false, reason: 'skip:no-optin' };
  if (!emailNotifications) return { send: false, reason: 'skip:notif-off' };

  const lastSent = lastSentAt ? new Date(lastSentAt) : null;
  if (lastSent && !Number.isNaN(lastSent.getTime()) && sameUtcDay(lastSent, now)) {
    return { send: false, reason: 'skip:sent-today' };
  }

  const day = now.getUTCDay();
  const normalized = normalizeJobAlertsFrequency(frequency, tier);

  if (normalized === 'daily') {
    if (tier === 'pro') {
      return [1, 3, 5].includes(day)
        ? { send: true }
        : { send: false, reason: 'skip:pro-frequency-window' };
    }
    if (isMaxJobAlertsTier(tier)) return { send: true };
    return { send: false, reason: 'skip:tier-frequency' };
  }

  if (normalized === 'weekly') {
    return day === 1 ? { send: true } : { send: false, reason: 'skip:weekly-window' };
  }

  if (day !== 1) return { send: false, reason: 'skip:biweekly-window' };
  if (daysSince(lastSentAt, now) < 13) return { send: false, reason: 'skip:biweekly-cadence' };
  return { send: true };
}

export function withSonaPicksUtm(url: string, content: string) {
  try {
    const next = new URL(url, 'https://talentconsulting.io');
    next.searchParams.set('utm_source', 'sona_picks');
    next.searchParams.set('utm_medium', 'email');
    next.searchParams.set('utm_campaign', 'crafted_jobs');
    next.searchParams.set('utm_content', content);
    return next.toString();
  } catch {
    return url;
  }
}
