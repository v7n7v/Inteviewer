import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  observabilityConsentRef,
  observabilityControlRef,
  normalizeObservabilityConsent,
} from '@/lib/observability/consent';
import { deriveRetainedObservabilitySubjects } from '@/lib/observability/subject';
import { observabilityResetJobRetentionDays } from '@/lib/observability/config';

export const observabilityResetRequestSchema = z.object({
  confirmationText: z.literal('RESET OBSERVABILITY DATA'),
  idempotencyKey: z.string().min(12).max(128).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

function resetJobId(uid: string, idempotencyKey: string): string {
  return createHash('sha256')
    .update(`talentconsulting:observability:reset:v1:${uid}:${idempotencyKey}`)
    .digest('hex');
}

function timestampMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Number((value as { toMillis: () => number }).toMillis());
  }
  return Number.NaN;
}

export function observabilityResetJobIsRetained(
  value: FirebaseFirestore.DocumentData | undefined,
  now = new Date(),
): boolean {
  const expiresAtMs = timestampMillis(value?.expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs > now.getTime();
}

export async function requestObservabilityReset(
  db: Firestore,
  uid: string,
  input: z.infer<typeof observabilityResetRequestSchema>,
  now = new Date(),
): Promise<{ jobId: string; status: 'queued' | 'running' | 'complete'; duplicate: boolean }> {
  const subjects = deriveRetainedObservabilitySubjects(uid);
  const jobId = resetJobId(uid, input.idempotencyKey);
  const jobRef = db.collection('observability_reset_jobs').doc(jobId);
  const consentRef = observabilityConsentRef(db, uid);
  const controlRef = observabilityControlRef(db, uid);
  const pointerRef = db
    .collection('users')
    .doc(uid)
    .collection('observabilityReset')
    .doc('current');
  const grantsQuery = db
    .collection('users')
    .doc(uid)
    .collection('diagnosticGrants')
    .limit(100);
  const nowIso = now.toISOString();

  return db.runTransaction(async transaction => {
    const [jobSnapshot, consentSnapshot, pointerSnapshot] = await Promise.all([
      transaction.get(jobRef),
      transaction.get(consentRef),
      transaction.get(pointerRef),
    ]);
    if (jobSnapshot.exists) {
      const data = jobSnapshot.data();
      if (data?.targetUid !== uid) throw new Error('OBSERVABILITY_RESET_CONFLICT');
      if (!observabilityResetJobIsRetained(data, now)) {
        throw new Error('OBSERVABILITY_RESET_EXPIRED');
      }
      const status = data?.status === 'complete' || data?.status === 'running'
        ? data.status
        : 'queued';
      return { jobId, status, duplicate: true };
    }
    const activeJobId = pointerSnapshot.data()?.jobId;
    if (typeof activeJobId === 'string' && /^[a-f0-9]{64}$/.test(activeJobId)) {
      const activeSnapshot = await transaction.get(
        db.collection('observability_reset_jobs').doc(activeJobId),
      );
      const activeData = activeSnapshot.data();
      if (
        activeSnapshot.exists
        && activeData?.targetUid === uid
        && observabilityResetJobIsRetained(activeData, now)
        && (activeData?.status === 'queued' || activeData?.status === 'running')
      ) {
        return {
          jobId: activeJobId,
          status: activeData.status,
          duplicate: true,
        };
      }
    }
    const grantsSnapshot = await transaction.get(grantsQuery);
    const currentConsent = normalizeObservabilityConsent(
      consentSnapshot.exists ? consentSnapshot.data() : null,
    );
    transaction.create(jobRef, {
      version: 1,
      targetUid: uid,
      subjectKeys: subjects.map(subject => subject.subjectKey),
      keyVersions: subjects.map(subject => subject.keyVersion),
      status: 'queued',
      attempts: 0,
      deletedEvents: 0,
      cutoffAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: null,
      expiresAt: Timestamp.fromMillis(
        now.getTime() + observabilityResetJobRetentionDays() * 24 * 60 * 60_000,
      ),
    });
    transaction.set(pointerRef, {
      version: 1,
      jobId,
      status: 'queued',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    transaction.set(consentRef, {
      version: 1,
      revision: currentConsent.revision + 1,
      productAnalytics: false,
      noticeVersion: currentConsent.noticeVersion,
      purpose: 'product_analytics',
      source: 'observability_reset',
      decisionAt: nowIso,
      withdrawnAt: nowIso,
      updatedAt: nowIso,
    });
    transaction.set(controlRef, {
      version: 1,
      resetCutoffAt: nowIso,
      resetRevision: FieldValue.increment(1),
      updatedAt: nowIso,
    }, { merge: true });
    for (const grant of grantsSnapshot.docs) {
      transaction.set(grant.ref, {
        state: 'revoked',
        revokedAt: nowIso,
        expiresAt: Timestamp.fromMillis(now.getTime()),
        updatedAt: nowIso,
      }, { merge: true });
      transaction.set(db.collection('diagnostic_support_cases').doc(grant.id), {
        grantState: 'revoked',
        grantExpiresAt: Timestamp.fromMillis(now.getTime()),
        updatedAt: nowIso,
      }, { merge: true });
    }
    return { jobId, status: 'queued' as const, duplicate: false };
  });
}

export async function processObservabilityResetJob(
  db: Firestore,
  jobId: string,
  batchSize = 100,
  now = new Date(),
): Promise<{ status: 'running' | 'complete'; deletedThisPass: number }> {
  if (!/^[a-f0-9]{64}$/.test(jobId)) throw new Error('OBSERVABILITY_RESET_JOB_INVALID');
  const boundedBatchSize = Math.min(Math.max(Math.floor(batchSize), 1), 200);
  const jobRef = db.collection('observability_reset_jobs').doc(jobId);
  const leaseId = randomUUID();
  const leaseExpiresAt = Timestamp.fromMillis(now.getTime() + 60_000);
  const claim = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(jobRef);
    const data = snapshot.data();
    if (!snapshot.exists || !Array.isArray(data?.subjectKeys) || typeof data?.targetUid !== 'string') {
      throw new Error('OBSERVABILITY_RESET_JOB_NOT_FOUND');
    }
    if (!observabilityResetJobIsRetained(data, now)) {
      throw new Error('OBSERVABILITY_RESET_EXPIRED');
    }
    if (data.status === 'complete') return { state: 'complete' as const, job: data };
    const existingLease = timestampMillis(data.leaseExpiresAt);
    if (
      typeof data.leaseId === 'string'
      && data.leaseId
      && Number.isFinite(existingLease)
      && existingLease > now.getTime()
    ) {
      return { state: 'busy' as const, job: data };
    }
    transaction.set(jobRef, {
      status: 'running',
      leaseId,
      leaseExpiresAt,
      attempts: FieldValue.increment(1),
      updatedAt: now.toISOString(),
    }, { merge: true });
    return { state: 'claimed' as const, job: data };
  });
  if (claim.state === 'complete') return { status: 'complete', deletedThisPass: 0 };
  if (claim.state === 'busy') return { status: 'running', deletedThisPass: 0 };
  const job = claim.job;
  const subjectKeys = job.subjectKeys.filter(
    (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{40,64}$/.test(value),
  ).slice(0, 3);
  const cutoffAt = typeof job.cutoffAt === 'string' && Number.isFinite(Date.parse(job.cutoffAt))
    ? job.cutoffAt
    : null;
  if (subjectKeys.length === 0 || !cutoffAt) {
    throw new Error('OBSERVABILITY_RESET_JOB_INVALID');
  }
  const eventQuery = db
    .collection('user_observability_events')
    .where('subjectKey', 'in', subjectKeys)
    .where('occurredAt', '<=', cutoffAt)
    .orderBy('occurredAt', 'asc')
    .limit(boundedBatchSize);
  const grantQuery = db
    .collection('users')
    .doc(job.targetUid)
    .collection('diagnosticGrants')
    .where('updatedAt', '<=', cutoffAt)
    .orderBy('updatedAt', 'asc')
    .limit(100);
  const pointerRef = db
    .collection('users')
    .doc(job.targetUid)
    .collection('observabilityReset')
    .doc('current');
  const nowIso = now.toISOString();
  return db.runTransaction(async transaction => {
    const current = await transaction.get(jobRef);
    if (current.data()?.leaseId !== leaseId) {
      throw new Error('OBSERVABILITY_RESET_LEASE_SUPERSEDED');
    }
    const [events, grants] = await Promise.all([
      transaction.get(eventQuery),
      transaction.get(grantQuery),
    ]);
    if (!events.empty || !grants.empty) {
      for (const event of events.docs) transaction.delete(event.ref);
      for (const grant of grants.docs) {
        transaction.set(db.collection('diagnostic_support_cases').doc(grant.id), {
          grantState: 'revoked',
          grantExpiresAt: Timestamp.fromMillis(now.getTime()),
          updatedAt: nowIso,
        }, { merge: true });
        transaction.delete(grant.ref);
      }
      transaction.set(jobRef, {
        status: 'running',
        deletedEvents: FieldValue.increment(events.size),
        leaseId: null,
        leaseExpiresAt: null,
        updatedAt: nowIso,
      }, { merge: true });
      transaction.set(pointerRef, {
        status: 'running',
        updatedAt: nowIso,
      }, { merge: true });
      return {
        status: 'running' as const,
        deletedThisPass: events.size + grants.size,
      };
    }

    for (const subjectKey of subjectKeys) {
      transaction.delete(db.collection('user_observability_summaries').doc(subjectKey));
    }
    transaction.set(jobRef, {
      status: 'complete',
      subjectKeys: [],
      leaseId: null,
      leaseExpiresAt: null,
      completedAt: nowIso,
      updatedAt: nowIso,
    }, { merge: true });
    transaction.delete(pointerRef);
    return { status: 'complete' as const, deletedThisPass: 0 };
  });
}

export async function processQueuedObservabilityResetJobs(
  db: Firestore,
  options: {
    jobLimit?: number;
    batchSize?: number;
    passLimit?: number;
    now?: Date;
  } = {},
): Promise<{
  inspected: number;
  completed: number;
  running: number;
  failed: number;
  overdue: number;
}> {
  const jobLimit = Math.min(Math.max(Math.floor(options.jobLimit || 10), 1), 10);
  const passLimit = Math.min(Math.max(Math.floor(options.passLimit || 200), 1), 200);
  const now = options.now || new Date();
  const snapshot = await db
    .collection('observability_reset_jobs')
    .where('status', 'in', ['queued', 'running'])
    .where('expiresAt', '>', Timestamp.fromDate(now))
    .orderBy('expiresAt', 'asc')
    .limit(jobLimit)
    .get();
  const completedIds = new Set<string>();
  const failedIds = new Set<string>();
  const stalledIds = new Set<string>();
  let active = [...snapshot.docs];
  let passes = 0;
  while (active.length > 0 && passes < passLimit) {
    const round = active.slice(0, passLimit - passes);
    const untouched = active.slice(round.length);
    passes += round.length;
    const results = await Promise.all(round.map(async document => {
      try {
        const result = await processObservabilityResetJob(
          db,
          document.id,
          options.batchSize || 200,
          now,
        );
        return { document, result, failed: false as const };
      } catch {
        return { document, result: null, failed: true as const };
      }
    }));
    const nextRound = [...untouched];
    for (const item of results) {
      if (item.failed) failedIds.add(item.document.id);
      else if (item.result.status === 'complete') completedIds.add(item.document.id);
      else if (item.result.deletedThisPass > 0) nextRound.push(item.document);
      else stalledIds.add(item.document.id);
    }
    active = nextRound;
  }
  const runningIds = new Set([
    ...active.map(document => document.id),
    ...stalledIds,
  ]);
  return {
    inspected: snapshot.size,
    completed: completedIds.size,
    running: runningIds.size,
    failed: failedIds.size,
    overdue: snapshot.docs.filter(document => {
      const createdAt = Date.parse(String(document.data().createdAt || ''));
      return Number.isFinite(createdAt)
        && now.getTime() - createdAt > 24 * 60 * 60_000;
    }).length,
  };
}
