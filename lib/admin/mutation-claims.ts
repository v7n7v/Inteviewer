import 'server-only';
import type {
  DocumentData,
  DocumentReference,
  Firestore,
} from 'firebase-admin/firestore';

export const ADMIN_MUTATION_LEASE_MS = 2 * 60_000;
export const ADMIN_MUTATION_RETENTION_MS = 30 * 24 * 60 * 60_000;
export const ADMIN_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,160}$/;

export function adminMutationLeaseFields(
  executionId: string,
  now = Date.now(),
  attempts = 1,
) {
  return {
    status: 'running' as const,
    executionId,
    attempts,
    leaseUntil: new Date(now + ADMIN_MUTATION_LEASE_MS).toISOString(),
    leaseClaimedAt: new Date(now).toISOString(),
  };
}

export function adminMutationClaimIsRunning(
  value: DocumentData,
  now = Date.now(),
) {
  const leaseUntil = Date.parse(String(value.leaseUntil || ''));
  return value.status === 'running'
    && Number.isFinite(leaseUntil)
    && leaseUntil > now;
}

export function adminMutationRetentionDate(now = Date.now()) {
  return new Date(now + ADMIN_MUTATION_RETENTION_MS);
}

export async function completeAdminMutationClaim<T>(
  db: Firestore,
  claimRef: DocumentReference,
  executionId: string,
  result: T,
) {
  const completedAt = new Date().toISOString();
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(claimRef);
    const value = snapshot.data() || {};
    if (value.status === 'complete') return;
    if (value.status !== 'running' || value.executionId !== executionId) {
      throw new Error('ADMIN_MUTATION_LEASE_CHANGED');
    }
    transaction.update(claimRef, {
      status: 'complete',
      completedAt,
      leaseUntil: null,
      result,
    });
  });
}

export async function failAdminMutationClaim(
  db: Firestore,
  claimRef: DocumentReference,
  executionId: string,
  errorCode: string,
) {
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(claimRef);
    const value = snapshot.data() || {};
    if (
      !snapshot.exists
      || value.status !== 'running'
      || value.executionId !== executionId
    ) return;
    transaction.update(claimRef, {
      status: 'failed',
      failedAt: new Date().toISOString(),
      leaseUntil: null,
      errorCode,
    });
  });
}
