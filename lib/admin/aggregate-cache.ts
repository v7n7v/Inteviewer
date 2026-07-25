import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

interface AggregateCacheDocument<T> {
  payload?: T;
  generatedAt?: string;
  expiresAt?: string;
  refreshLeaseUntil?: string;
  refreshExecutionId?: string;
  generationId?: string;
}

export interface AdminAggregateSnapshotWrite<T = unknown> {
  key: string;
  payload: T;
  ttlMs: number;
}

export async function readAdminAggregateCache<T>(
  db: Firestore,
  key: string,
  validate?: (value: unknown) => value is T,
): Promise<{ payload: T | null; fresh: boolean }> {
  const snapshot = await db.collection('admin_aggregate_cache').doc(key).get();
  if (!snapshot.exists) return { payload: null, fresh: false };
  const value = snapshot.data() as AggregateCacheDocument<T>;
  const payload = value.payload && (!validate || validate(value.payload))
    ? value.payload
    : null;
  const expiresAt = new Date(String(value.expiresAt || '')).getTime();
  return {
    payload,
    fresh: Boolean(payload) && Number.isFinite(expiresAt) && expiresAt > Date.now(),
  };
}

export async function claimAdminAggregateRefresh(
  db: Firestore,
  key: string,
  leaseMs = 60_000,
): Promise<string | null> {
  const ref = db.collection('admin_aggregate_cache').doc(key);
  const executionId = randomUUID();
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const leaseUntil = new Date(String(snapshot.data()?.refreshLeaseUntil || '')).getTime();
    if (Number.isFinite(leaseUntil) && leaseUntil > Date.now()) return null;
    transaction.set(ref, {
      refreshExecutionId: executionId,
      refreshLeaseUntil: new Date(Date.now() + leaseMs).toISOString(),
      refreshClaimedAt: new Date().toISOString(),
    }, { merge: true });
    return executionId;
  });
}

/**
 * Publishes the full snapshot generation and completes its lease in one
 * Firestore transaction. The execution id is a fencing token: a worker that
 * outlives its lease cannot overwrite a successor's generation.
 */
export async function publishAdminAggregateGeneration(
  db: Firestore,
  leaseKey: string,
  executionId: string,
  snapshots: readonly AdminAggregateSnapshotWrite[],
): Promise<boolean> {
  const leaseRef = db.collection('admin_aggregate_cache').doc(leaseKey);
  const completedAt = new Date().toISOString();
  const completedAtMs = Date.parse(completedAt);
  return db.runTransaction(async transaction => {
    const lease = await transaction.get(leaseRef);
    if (lease.data()?.refreshExecutionId !== executionId) return false;
    for (const snapshot of snapshots) {
      transaction.set(
        db.collection('admin_aggregate_cache').doc(snapshot.key),
        {
          payload: snapshot.payload,
          generationId: executionId,
          generatedAt: completedAt,
          expiresAt: new Date(completedAtMs + snapshot.ttlMs).toISOString(),
          updatedAt: completedAt,
        },
        { merge: true },
      );
    }
    transaction.set(leaseRef, {
      activeGenerationId: executionId,
      refreshExecutionId: null,
      refreshLeaseUntil: null,
      refreshCompletedAt: completedAt,
      refreshFailedAt: null,
    }, { merge: true });
    return true;
  });
}

export async function releaseAdminAggregateRefresh(
  db: Firestore,
  key: string,
  executionId: string,
): Promise<boolean> {
  const ref = db.collection('admin_aggregate_cache').doc(key);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.data()?.refreshExecutionId !== executionId) return false;
    transaction.set(ref, {
      refreshExecutionId: null,
      refreshLeaseUntil: null,
      refreshFailedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  });
}
