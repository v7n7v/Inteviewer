import 'server-only';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import type { AdminObservabilityResponse, ObservabilityCell } from '@/lib/admin/contracts';
import {
  claimAdminAggregateRefresh,
  publishAdminAggregateGeneration,
  releaseAdminAggregateRefresh,
} from '@/lib/admin/aggregate-cache';
import {
  OBSERVABILITY_MINIMUM_CELL_SIZE,
  observabilityPolicyApproved,
  observabilityRetentionDays,
  observabilitySurfaceAvailable,
} from '@/lib/observability/config';

export const OBSERVABILITY_AGGREGATE_CACHE_KEY = 'observability_v1';
export const OBSERVABILITY_AGGREGATE_LEASE_KEY = 'observability_materialization_lease_v1';
export const OBSERVABILITY_AGGREGATE_MAX_WINDOW_DAYS = 30;
const CACHE_TTL_MS = 15 * 60_000;
const MATERIALIZATION_LEASE_MS = 3 * 60_000;
const GET_ALL_CHUNK_SIZE = 200;
const AGGREGATE_READ_SHARDS = 32;

const countMapSchema = z.record(z.string().min(1).max(64), z.number().int().nonnegative());
const observabilityAggregateSchema = z.object({
  generatedAt: z.string().datetime(),
  meta: z.object({
    requestId: z.string().min(1),
    generatedAt: z.string().datetime(),
    staleAfterMs: z.number().int().nonnegative(),
    partial: z.boolean(),
    truncated: z.boolean(),
  }).strict(),
  enabled: z.boolean(),
  state: z.enum(['disabled', 'ready', 'sparse', 'partial', 'stale', 'unavailable']),
  observationWindow: z.object({
    startsAt: z.string().datetime().nullable(),
    endsAt: z.string().datetime().nullable(),
    windowDays: z.number().int().positive(),
  }).strict(),
  observedActivity: z.number().int().nonnegative().nullable(),
  byCategory: z.record(z.string(), z.number().int().nonnegative().nullable()),
  byTool: z.record(z.string(), z.number().int().nonnegative().nullable()),
  byOutcome: z.record(z.string(), z.number().int().nonnegative().nullable()),
  consentCoverage: z.null(),
  completeness: z.object({
    complete: z.boolean(),
    expectedShards: z.number().int().nonnegative(),
    readShards: z.number().int().nonnegative(),
    suppressedCells: z.number().int().nonnegative(),
    partialReasons: z.array(z.string()),
  }).strict(),
  definitions: z.object({
    observedActivity: z.string().min(1),
    suppressedCell: z.string().min(1),
    consentCoverage: z.string().min(1),
  }).strict(),
  retention: z.object({
    configuredDays: z.number().int().positive().nullable(),
    policyApproved: z.boolean(),
  }).strict(),
  limitations: z.array(z.string()),
}).strict();

export function isAdminObservabilityResponse(
  value: unknown,
): value is AdminObservabilityResponse {
  return observabilityAggregateSchema.safeParse(value).success;
}

function isoDayAt(now: Date, daysAgo: number): string {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysAgo,
  )).toISOString().slice(0, 10);
}

function addCount(target: Record<string, number>, key: string, value: unknown) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) return;
  target[key] = (target[key] || 0) + count;
}

function mergeCountMap(target: Record<string, number>, value: unknown) {
  const parsed = countMapSchema.safeParse(value);
  if (!parsed.success) return;
  for (const [key, count] of Object.entries(parsed.data)) addCount(target, key, count);
}

export function suppressObservabilityCounts(
  values: Record<string, number>,
  minimum = OBSERVABILITY_MINIMUM_CELL_SIZE,
): { values: Record<string, ObservabilityCell>; suppressedCells: number } {
  const entries = Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right));
  const suppressedKeys = new Set(
    entries
      .filter(([, count]) => count < minimum)
      .map(([key]) => key),
  );
  if (suppressedKeys.size === 1 && entries.length > 1) {
    const complement = entries
      .filter(([key]) => !suppressedKeys.has(key))
      .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))[0];
    if (complement) suppressedKeys.add(complement[0]);
  }
  const suppressed = Object.fromEntries(
    entries.map(([key, count]) => [
      key,
      suppressedKeys.has(key) ? null : Math.floor(count / minimum) * minimum,
    ]),
  );
  return { values: suppressed, suppressedCells: suppressedKeys.size };
}

export async function materializeObservabilityAggregate(
  db: Firestore,
  now = new Date(),
): Promise<{ published: boolean; preserved: boolean; partial: boolean }> {
  if (!observabilitySurfaceAvailable()) {
    return { published: false, preserved: true, partial: false };
  }
  const executionId = await claimAdminAggregateRefresh(
    db,
    OBSERVABILITY_AGGREGATE_LEASE_KEY,
    MATERIALIZATION_LEASE_MS,
  );
  if (!executionId) {
    return { published: false, preserved: true, partial: false };
  }
  try {
  const windowDays = Math.min(
    OBSERVABILITY_AGGREGATE_MAX_WINDOW_DAYS,
    observabilityRetentionDays(),
  );
  const days = Array.from(
    { length: windowDays },
    (_, index) => isoDayAt(now, index),
  ).reverse();
  const refs = days.flatMap(day => Array.from({ length: AGGREGATE_READ_SHARDS }, (_, shard) => (
    db
      .collection('user_observability_daily')
      .doc(day)
      .collection('shards')
      .doc(String(shard).padStart(2, '0'))
  )));

  const chunks: FirebaseFirestore.DocumentReference[][] = [];
  for (let index = 0; index < refs.length; index += GET_ALL_CHUNK_SIZE) {
    chunks.push(refs.slice(index, index + GET_ALL_CHUNK_SIZE));
  }
  const reads = await Promise.allSettled(chunks.map(chunk => db.getAll(...chunk)));
  const partial = reads.some(read => read.status === 'rejected');
  const snapshots = reads.flatMap(read => read.status === 'fulfilled' ? read.value : []);
  const total = { value: 0 };
  const byCategory: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  for (const snapshot of snapshots) {
    if (!snapshot.exists) continue;
    const counts = snapshot.data()?.counts;
    const countValue = Number(counts?.total);
    if (Number.isInteger(countValue) && countValue >= 0) total.value += countValue;
    mergeCountMap(byCategory, counts?.byCategory);
    mergeCountMap(byTool, counts?.byTool);
    mergeCountMap(byOutcome, counts?.byOutcome);
  }

  const cacheRef = db.collection('admin_aggregate_cache').doc(OBSERVABILITY_AGGREGATE_CACHE_KEY);
  if (partial || total.value === 0) {
    const previous = await cacheRef.get();
    if (previous.exists && isAdminObservabilityResponse(previous.data()?.payload)) {
      await publishAdminAggregateGeneration(
        db,
        OBSERVABILITY_AGGREGATE_LEASE_KEY,
        executionId,
        [],
      );
      return { published: false, preserved: true, partial };
    }
  }

  const categories = suppressObservabilityCounts(byCategory);
  const tools = suppressObservabilityCounts(byTool);
  const outcomes = suppressObservabilityCounts(byOutcome);
  const suppressedCells = categories.suppressedCells
    + tools.suppressedCells
    + outcomes.suppressedCells;
  const observedActivity = total.value < OBSERVABILITY_MINIMUM_CELL_SIZE
    || suppressedCells > 0
    ? null
    : Math.floor(total.value / OBSERVABILITY_MINIMUM_CELL_SIZE)
      * OBSERVABILITY_MINIMUM_CELL_SIZE;
  const totalSuppression = suppressedCells
    + (observedActivity === null && total.value > 0 ? 1 : 0);
  const generatedAt = now.toISOString();
  const expectedShards = refs.length;
  const readShards = snapshots.length;
  const payload: AdminObservabilityResponse = {
    generatedAt,
    meta: {
      requestId: crypto.randomUUID(),
      generatedAt,
      staleAfterMs: CACHE_TTL_MS,
      partial,
      truncated: false,
    },
    enabled: true,
    state: partial
      ? 'partial'
      : total.value < OBSERVABILITY_MINIMUM_CELL_SIZE
        ? 'sparse'
        : 'ready',
    observationWindow: {
      startsAt: `${days[0]}T00:00:00.000Z`,
      endsAt: `${days.at(-1)}T23:59:59.999Z`,
      windowDays,
    },
    observedActivity,
    byCategory: categories.values,
    byTool: tools.values,
    byOutcome: outcomes.values,
    consentCoverage: null,
    completeness: {
      complete: !partial,
      expectedShards,
      readShards,
      suppressedCells: totalSuppression,
      partialReasons: partial ? ['One or more bounded shard reads were unavailable.'] : [],
    },
    definitions: {
      observedActivity: `Accepted allowlisted events rounded down to ${OBSERVABILITY_MINIMUM_CELL_SIZE}-event bands; not unique users or complete usage.`,
      suppressedCell: `Counts below ${OBSERVABILITY_MINIMUM_CELL_SIZE}, complementary cells, and inferable totals are hidden; visible counts are rounded down to ${OBSERVABILITY_MINIMUM_CELL_SIZE}-event bands.`,
      consentCoverage: 'Unavailable in milestone 1; no user-population scan is performed.',
    },
    retention: {
      configuredDays: observabilityRetentionDays(),
      policyApproved: observabilityPolicyApproved(),
    },
    limitations: [
      'Aggregate, privacy-suppressed evidence only; no identities or user content are included.',
      'Only opted-in product analytics and narrowly enumerated server reliability events are observed.',
      'Missing events, disabled ingestion, and telemetry delivery failures make this evidence incomplete.',
    ],
  };
  const published = await publishAdminAggregateGeneration(
    db,
    OBSERVABILITY_AGGREGATE_LEASE_KEY,
    executionId,
    [{ key: OBSERVABILITY_AGGREGATE_CACHE_KEY, payload, ttlMs: CACHE_TTL_MS }],
  );
  if (!published) throw new Error('OBSERVABILITY_AGGREGATE_LEASE_SUPERSEDED');
  return { published: true, preserved: false, partial };
  } catch (error) {
    await releaseAdminAggregateRefresh(
      db,
      OBSERVABILITY_AGGREGATE_LEASE_KEY,
      executionId,
    ).catch(() => undefined);
    throw error;
  }
}

export async function readObservabilityAggregate(
  db: Firestore,
): Promise<{ payload: AdminObservabilityResponse | null; fresh: boolean }> {
  const snapshot = await db
    .collection('admin_aggregate_cache')
    .doc(OBSERVABILITY_AGGREGATE_CACHE_KEY)
    .get();
  const payload = isAdminObservabilityResponse(snapshot.data()?.payload)
    ? snapshot.data()!.payload as AdminObservabilityResponse
    : null;
  const expiresAt = Date.parse(String(snapshot.data()?.expiresAt || ''));
  return {
    payload,
    fresh: Boolean(payload) && Number.isFinite(expiresAt) && expiresAt > Date.now(),
  };
}
