import type { Auth, UserRecord } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import {
  calculateVerifiedMrr,
  type RecurringBillingRecord,
} from '@/lib/billing-metrics';
import {
  SONA_ECONOMICS_COLLECTION,
  summarizeSonaEconomicsEvents,
  type SonaEconomicsEvent,
} from '@/lib/assistant/economics';
import { adminEvidence } from '@/lib/admin/evidence';

export const ADMIN_AUTH_USER_SAMPLE_LIMIT = 1_000;
export const ADMIN_SUBSCRIPTION_SAMPLE_LIMIT = 2_000;
export const ADMIN_FEATURE_USAGE_SAMPLE_LIMIT = 1_000;
export const ADMIN_ECONOMICS_SAMPLE_LIMIT = 1_000;

const FEATURE_KEYS = [
  'morphs',
  'gauntlets',
  'flashcards',
  'jdGenerations',
  'coverLetters',
  'resumeChecks',
  'linkedinProfiles',
  'writingTools',
  'galleryTools',
] as const;

function safeCount(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function dateKey(value: string | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

function trendDays(days: number, now = Date.now()) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now - (days - index - 1) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return { date, count: 0 };
  });
}

export async function readBoundedUserAggregates(auth: Auth, now = Date.now()) {
  const result = await auth.listUsers(ADMIN_AUTH_USER_SAMPLE_LIMIT);
  const users = result.users as UserRecord[];
  const sampleCapped = Boolean(result.pageToken);
  const signupTrend = trendDays(14, now);
  const trendByDate = new Map(signupTrend.map(item => [item.date, item]));
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  let activeToday = 0;
  let activeWeek = 0;
  let disabled = 0;

  users.forEach(user => {
    if (user.disabled) disabled += 1;
    const created = dateKey(user.metadata.creationTime);
    if (created) {
      const trend = trendByDate.get(created);
      if (trend) trend.count += 1;
    }
    const lastSignIn = Date.parse(user.metadata.lastSignInTime || '');
    if (!Number.isFinite(lastSignIn)) return;
    if (lastSignIn >= sevenDaysAgo) activeWeek += 1;
    if (lastSignIn >= oneDayAgo) activeToday += 1;
  });

  return {
    sampledUsers: users.length,
    totalUsers: sampleCapped ? null : users.length,
    disabled: sampleCapped ? null : disabled,
    activeToday: sampleCapped ? null : activeToday,
    activeWeek: sampleCapped ? null : activeWeek,
    signupTrend,
    sampleCapped,
    evidence: adminEvidence({
      state: sampleCapped ? 'degraded' : 'ready',
      source: 'Firebase Authentication bounded user listing',
      complete: !sampleCapped,
      sampleLimit: ADMIN_AUTH_USER_SAMPLE_LIMIT,
      sampleCapped,
      limitations: sampleCapped
        ? ['User totals and activity are withheld because the bounded authentication sample was capped.']
        : [],
    }),
  };
}

export async function readVerifiedSubscriptionAggregates(db: Firestore) {
  const snapshot = await db
    .collectionGroup('subscription')
    .where('status', '==', 'active')
    .limit(ADMIN_SUBSCRIPTION_SAMPLE_LIMIT + 1)
    .get();
  const sampleCapped = snapshot.docs.length > ADMIN_SUBSCRIPTION_SAMPLE_LIMIT;
  const docs = snapshot.docs
    .slice(0, ADMIN_SUBSCRIPTION_SAMPLE_LIMIT)
    .filter(doc => {
      const path = doc.ref.path.split('/');
      return path.length === 4
        && path[0] === 'users'
        && path[2] === 'subscription'
        && path[3] === 'current';
    });
  const records = docs.map(doc => doc.data() as RecurringBillingRecord);
  const verifiedMrr = calculateVerifiedMrr(records);
  const uniqueActiveUsers = new Set(
    docs
      .map(doc => doc.ref.parent.parent?.id || null)
      .filter((uid): uid is string => Boolean(uid)),
  );
  const tierCounts = records.reduce((counts, record) => {
    if (record.plan === 'pro') counts.pro += 1;
    if (record.plan === 'studio') counts.studio += 1;
    return counts;
  }, { pro: 0, studio: 0 });
  const complete = !sampleCapped && verifiedMrr.complete;

  return {
    records,
    verifiedMrr,
    uniqueActivePaidUsers: uniqueActiveUsers.size,
    tierCounts,
    sampleCapped,
    evidence: adminEvidence({
      state: complete ? 'ready' : 'degraded',
      source: 'Firestore server-owned active subscription evidence',
      complete,
      sampleLimit: ADMIN_SUBSCRIPTION_SAMPLE_LIMIT,
      sampleCapped,
      limitations: [
        ...(sampleCapped ? ['Active subscription evidence exceeded the bounded read limit.'] : []),
        ...(!verifiedMrr.complete ? ['Some active subscriptions lack complete recurring price evidence.'] : []),
      ],
    }),
  };
}

export async function readBoundedFeatureUsage(db: Firestore) {
  const snapshot = await db
    .collectionGroup('usage')
    .limit(ADMIN_FEATURE_USAGE_SAMPLE_LIMIT + 1)
    .get();
  const sampleCapped = snapshot.docs.length > ADMIN_FEATURE_USAGE_SAMPLE_LIMIT;
  const usage = Object.fromEntries(FEATURE_KEYS.map(key => [key, 0])) as Record<string, number>;
  snapshot.docs.slice(0, ADMIN_FEATURE_USAGE_SAMPLE_LIMIT).forEach(doc => {
    const data = doc.data();
    FEATURE_KEYS.forEach(key => {
      usage[key] += safeCount(data[key]);
    });
  });
  return {
    usage,
    sampleCapped,
    evidence: adminEvidence({
      state: sampleCapped ? 'degraded' : 'ready',
      source: 'Firestore bounded usage-document aggregation',
      complete: !sampleCapped,
      sampleLimit: ADMIN_FEATURE_USAGE_SAMPLE_LIMIT,
      sampleCapped,
      limitations: sampleCapped
        ? ['Feature totals describe the bounded sample and must not be extrapolated.']
        : [],
    }),
  };
}

export async function readBoundedTacoEconomics(
  db: Firestore,
  windowDays: number,
  now = Date.now(),
) {
  const since = new Date(now - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const snapshot = await db
    .collection(SONA_ECONOMICS_COLLECTION)
    .where('occurredAt', '>=', since)
    .orderBy('occurredAt', 'desc')
    .limit(ADMIN_ECONOMICS_SAMPLE_LIMIT + 1)
    .get();
  const sampleCapped = snapshot.docs.length > ADMIN_ECONOMICS_SAMPLE_LIMIT;
  const events = snapshot.docs
    .slice(0, ADMIN_ECONOMICS_SAMPLE_LIMIT)
    .map(doc => doc.data() as SonaEconomicsEvent);
  const summary = summarizeSonaEconomicsEvents(events, {
    windowDays,
    sampleLimit: ADMIN_ECONOMICS_SAMPLE_LIMIT,
    accountSampleCapped: sampleCapped,
  });
  return {
    summary,
    sampleCapped,
    evidence: adminEvidence({
      state: sampleCapped ? 'degraded' : 'ready',
      source: 'Firestore Taco workload economics events',
      complete: !sampleCapped,
      sampleLimit: ADMIN_ECONOMICS_SAMPLE_LIMIT,
      sampleCapped,
      limitations: [
        'Provider cost is directional workload evidence, not invoiced infrastructure spend or total cost of service.',
        ...(sampleCapped ? ['The economics event window exceeded the bounded read limit.'] : []),
      ],
    }),
  };
}

export async function readCollectionCount(db: Firestore, collection: string) {
  const snapshot = await db.collection(collection).count().get();
  return snapshot.data().count;
}

export async function readFilteredCollectionCount(
  db: Firestore,
  collection: string,
  field: string,
  value: string,
) {
  const snapshot = await db.collection(collection).where(field, '==', value).count().get();
  return snapshot.data().count;
}
