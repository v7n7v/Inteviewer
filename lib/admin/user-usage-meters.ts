/**
 * Usage-against-caps for the admin user detail panel.
 *
 * Pure, and in lib/ rather than in the route, for one reason: it is the piece most able
 * to put a wrong number in front of an operator, and a route handler cannot be unit
 * tested in this repo without bundling half of Next. `scripts/admin-user-meters.test.js`
 * executes every branch below.
 *
 * The rule this exists to protect is the same one commit 5dec162 was written for -
 * an unmeasured value is not a measured zero. Here that means `cap: null` (unmetered on
 * this plan) must never be rendered as a cap of 0, which would read as "limit reached".
 */
import { FREE_CAPS, VOICE_MINUTE_CAPS, WRITING_WORD_CAPS, type UsageFeature } from '@/lib/usage-tracker';

export type MeterUnit = 'count' | 'minutes' | 'words';

export interface UsageMeter {
  key: string;
  label: string;
  used: number;
  /** null means unmetered for this plan. Not zero. */
  cap: number | null;
  unit: MeterUnit;
}

/** The plan the meters are measured against. Same normalisation the response uses. */
export function planOf(subscriptionData: Record<string, unknown>): 'free' | 'pro' | 'studio' {
  return subscriptionData.plan === 'pro' || subscriptionData.plan === 'studio'
    ? subscriptionData.plan
    : 'free';
}

/**
 * Usage against the caps that actually apply to this user.
 *
 * `cap: null` means unmetered for their plan, and the UI must render that as "no limit"
 * rather than as a limit of zero - the same null-is-not-zero rule the aggregate
 * materialiser follows. Paid tiers have no lifetime caps at all, so every counter comes
 * back uncapped for them; that is correct, not a missing value.
 */
export function usageMeters(
  lifetime: Record<string, unknown> | undefined,
  voice: Record<string, unknown> | undefined,
  writing: Record<string, unknown> | undefined,
  agent: Record<string, unknown> | undefined,
  plan: 'free' | 'pro' | 'studio',
): UsageMeter[] {
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  /* ALL TWELVE, not a curated six.
     The first pass surfaced only the six that felt important, and a test asking about
     `flashcards` failed. That was the right failure: an operator answering "why is this
     user stuck" needs to see whichever cap they actually hit, and picking six in advance
     decides that for them. It is the same single document read either way. Order follows
     the product journey rather than the interface declaration. */
  const LIFETIME: { key: UsageFeature; label: string }[] = [
    { key: 'resumeParses', label: 'Resume uploads' },
    { key: 'morphs', label: 'Resume tailoring' },
    { key: 'resumeChecks', label: 'Resume checks' },
    { key: 'resumeAssists', label: 'Resume assists' },
    { key: 'coverLetters', label: 'Cover letters' },
    { key: 'linkedinProfiles', label: 'LinkedIn rewrites' },
    { key: 'jdGenerations', label: 'Job descriptions' },
    { key: 'writingTools', label: 'Writing tools' },
    { key: 'galleryTools', label: 'Gallery tools' },
    { key: 'gauntlets', label: 'Interview sessions' },
    { key: 'flashcards', label: 'Flashcard sets' },
    { key: 'vaultExports', label: 'Packet exports' },
  ];

  const meters: UsageMeter[] = LIFETIME.map(({ key, label }) => ({
    key,
    label,
    used: num(lifetime?.[key]),
    // Lifetime caps are a free-tier construct. Paid plans are uncapped on these counters.
    cap: plan === 'free' ? FREE_CAPS[key] : null,
    unit: 'count' as const,
  }));

  meters.push({
    key: 'voiceMonthly',
    label: 'Voice this month',
    used: Math.round(num(voice?.usedSeconds) / 60),
    cap: VOICE_MINUTE_CAPS[plan],
    unit: 'minutes',
  });
  meters.push({
    key: 'writingMonthly',
    label: 'Humanizer this month',
    used: num(writing?.usedWords),
    cap: WRITING_WORD_CAPS[plan],
    unit: 'words',
  });
  meters.push({
    key: 'agentLifetime',
    label: 'Taco sessions',
    used: num(agent?.lifetimeCount),
    // 2 lifetime on free, weekly on pro, unlimited above - only the free number is a
    // lifetime cap, so the others are reported uncapped rather than mislabelled.
    cap: plan === 'free' ? 2 : null,
    unit: 'count',
  });

  return meters;
}

