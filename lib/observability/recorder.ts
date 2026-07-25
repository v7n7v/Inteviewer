import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  OBSERVABILITY_SCHEMA_VERSION,
  validateObservabilityEvent,
  type ObservabilityEventInput,
} from '@/lib/observability/contracts';
import {
  observabilityRetentionDays,
  observabilityShardCount,
  observabilitySurfaceAvailable,
} from '@/lib/observability/config';
import {
  deriveRetainedObservabilitySubjects,
  parseObservabilityKeyRegistry,
  type ObservabilityKeyRegistry,
  type ObservabilitySubjectKey,
} from '@/lib/observability/subject';
import {
  normalizeObservabilityConsent,
  observabilityConsentRef,
  observabilityControlRef,
} from '@/lib/observability/consent';

export interface RecordObservabilityBatchInput {
  db: Firestore;
  uid: string;
  events: readonly ObservabilityEventInput[];
  author: 'client' | 'server';
  productAnalyticsConsent: boolean;
  now?: Date;
  registry?: ObservabilityKeyRegistry;
  shardCount?: number;
  retentionDays?: number;
  enabled?: boolean;
}

export interface RecordObservabilityBatchResult {
  accepted: number;
  duplicate: number;
  rejected: number;
  disabled: number;
  rejectionCodes: Partial<Record<
    'schema_invalid'
      | 'forbidden_data'
      | 'event_too_large'
      | 'purpose_not_authorized'
      | 'operation_conflict',
    number
  >>;
}

interface PreparedEvent {
  event: ObservabilityEventInput;
  fingerprint: string;
  traceId: string;
  activeSubject: ObservabilitySubjectKey;
  candidateIds: Array<ObservabilitySubjectKey & { eventId: string }>;
}

function incrementCode(
  result: RecordObservabilityBatchResult,
  code: keyof RecordObservabilityBatchResult['rejectionCodes'],
) {
  result.rejected += 1;
  result.rejectionCodes[code] = (result.rejectionCodes[code] || 0) + 1;
}

function deterministicEventId(
  subjectKey: string,
  producer: string,
  operationId: string,
): string {
  return createHash('sha256')
    .update([
      'talentconsulting',
      'observability',
      `v${OBSERVABILITY_SCHEMA_VERSION}`,
      subjectKey,
      producer,
      operationId,
    ].join(':'))
    .digest('hex');
}

function deterministicShard(eventId: string, shardCount: number): string {
  const prefix = Number.parseInt(eventId.slice(0, 8), 16);
  return String(prefix % shardCount).padStart(2, '0');
}

function incrementMap(events: readonly PreparedEvent[]) {
  const eventCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const outcomeCounts: Record<string, number> = {};
  const toolCounts: Record<string, number> = {};
  for (const prepared of events) {
    const event = prepared.event;
    eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1;
    categoryCounts[event.category] = (categoryCounts[event.category] || 0) + 1;
    outcomeCounts[event.outcome] = (outcomeCounts[event.outcome] || 0) + 1;
    if ('tool' in event) toolCounts[event.tool] = (toolCounts[event.tool] || 0) + 1;
  }
  const increments = (counts: Record<string, number>) => Object.fromEntries(
    Object.entries(counts).map(([key, count]) => [key, FieldValue.increment(count)]),
  );
  return {
    total: FieldValue.increment(events.length),
    byEvent: increments(eventCounts),
    byCategory: increments(categoryCounts),
    byOutcome: increments(outcomeCounts),
    byTool: increments(toolCounts),
  };
}

function groupByShard(events: readonly PreparedEvent[], shardCount: number) {
  const groups = new Map<string, PreparedEvent[]>();
  for (const event of events) {
    const eventId = event.candidateIds.find(
      candidate => candidate.keyVersion === event.activeSubject.keyVersion,
    )!.eventId;
    const shardId = deterministicShard(eventId, shardCount);
    groups.set(shardId, [...(groups.get(shardId) || []), event]);
  }
  return groups;
}

export async function recordObservabilityBatch(
  input: RecordObservabilityBatchInput,
): Promise<RecordObservabilityBatchResult> {
  const result: RecordObservabilityBatchResult = {
    accepted: 0,
    duplicate: 0,
    rejected: 0,
    disabled: 0,
    rejectionCodes: {},
  };
  const enabled = input.enabled ?? observabilitySurfaceAvailable();
  if (!enabled) {
    result.disabled = input.events.length;
    return result;
  }

  const registry = input.registry ?? parseObservabilityKeyRegistry();
  const subjects = deriveRetainedObservabilitySubjects(input.uid, registry);
  const activeSubject = subjects.find(subject => subject.keyVersion === registry.activeVersion);
  if (!activeSubject) throw new Error('OBSERVABILITY_HMAC_CONFIGURATION_INVALID');

  const preparedByActiveId = new Map<string, PreparedEvent>();
  for (const rawEvent of input.events) {
    const validation = validateObservabilityEvent(rawEvent);
    if (!validation.ok) {
      incrementCode(result, validation.code);
      continue;
    }
    const event = validation.value;
    const purposeAllowed = event.purpose === 'product_analytics'
      ? input.productAnalyticsConsent
      : input.author === 'server';
    if (!purposeAllowed || (input.author === 'client' && event.purpose !== 'product_analytics')) {
      incrementCode(result, 'purpose_not_authorized');
      continue;
    }
    const candidateIds = subjects.map(subject => ({
      ...subject,
      eventId: deterministicEventId(subject.subjectKey, event.producer, event.operationId),
    }));
    const activeId = candidateIds.find(
      candidate => candidate.keyVersion === activeSubject.keyVersion,
    )!.eventId;
    const existing = preparedByActiveId.get(activeId);
    if (existing) {
      if (existing.fingerprint === validation.fingerprint) result.duplicate += 1;
      else incrementCode(result, 'operation_conflict');
      continue;
    }
    preparedByActiveId.set(activeId, {
      event,
      fingerprint: validation.fingerprint,
      traceId: randomUUID(),
      activeSubject,
      candidateIds,
    });
  }
  const prepared = [...preparedByActiveId.values()];
  if (prepared.length === 0) return result;

  const db = input.db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const day = nowIso.slice(0, 10);
  const requestedRetentionDays = input.retentionDays ?? observabilityRetentionDays();
  const retentionDays = Number.isInteger(requestedRetentionDays)
    ? Math.min(Math.max(requestedRetentionDays, 7), 90)
    : observabilityRetentionDays();
  const expiresAt = Timestamp.fromMillis(now.getTime() + retentionDays * 24 * 60 * 60_000);
  const requestedShardCount = input.shardCount ?? observabilityShardCount();
  const shardCount = Number.isInteger(requestedShardCount)
    ? Math.min(Math.max(requestedShardCount, 4), 32)
    : observabilityShardCount();

  const transactionResult = await db.runTransaction(async transaction => {
    const controlSnapshot = await transaction.get(observabilityControlRef(db, input.uid));
    const resetCutoffAt = controlSnapshot.data()?.resetCutoffAt;
    const resetCutoffMs = typeof resetCutoffAt === 'string'
      ? Date.parse(resetCutoffAt)
      : Number.NaN;
    const eventWindowStillAuthorized = !Number.isFinite(resetCutoffMs)
      || now.getTime() > resetCutoffMs;
    const requiresConsentRecheck = prepared.some(
      item => item.event.purpose === 'product_analytics',
    );
    const consentSnapshot = requiresConsentRecheck
      ? await transaction.get(observabilityConsentRef(db, input.uid))
      : null;
    const productAnalyticsStillAuthorized = !requiresConsentRecheck
      || normalizeObservabilityConsent(
        consentSnapshot?.exists ? consentSnapshot.data() : null,
      ).productAnalytics;
    const snapshots = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    for (const item of prepared) {
      for (const candidate of item.candidateIds) {
        const ref = db.collection('user_observability_events').doc(candidate.eventId);
        snapshots.set(candidate.eventId, await transaction.get(ref));
      }
    }

    const accepted: PreparedEvent[] = [];
    let duplicateCount = 0;
    let conflictCount = 0;
    let consentDeniedCount = 0;
    for (const item of prepared) {
      if (
        !eventWindowStillAuthorized
        || (
          item.event.purpose === 'product_analytics'
          && !productAnalyticsStillAuthorized
        )
      ) {
        consentDeniedCount += 1;
        continue;
      }
      let duplicate = false;
      let conflict = false;
      for (const candidate of item.candidateIds) {
        const snapshot = snapshots.get(candidate.eventId);
        if (!snapshot?.exists) continue;
        if (snapshot.data()?.requestFingerprint === item.fingerprint) duplicate = true;
        else conflict = true;
      }
      if (conflict) {
        conflictCount += 1;
        continue;
      }
      if (duplicate) {
        duplicateCount += 1;
        continue;
      }
      accepted.push(item);
    }

    const summaryRef = db
      .collection('user_observability_summaries')
      .doc(activeSubject.subjectKey);
    const summarySnapshot = accepted.length > 0
      ? await transaction.get(summaryRef)
      : null;

    for (const item of accepted) {
      const activeId = item.candidateIds.find(
        candidate => candidate.keyVersion === item.activeSubject.keyVersion,
      )!.eventId;
      const event = item.event;
      transaction.create(db.collection('user_observability_events').doc(activeId), {
        schemaVersion: OBSERVABILITY_SCHEMA_VERSION,
        subjectKey: item.activeSubject.subjectKey,
        keyVersion: item.activeSubject.keyVersion,
        requestFingerprint: item.fingerprint,
        traceId: item.traceId,
        purpose: event.purpose,
        producer: event.producer,
        eventName: event.eventName,
        category: event.category,
        action: event.action,
        outcome: event.outcome,
        plan: event.plan,
        ...('tool' in event ? { tool: event.tool } : {}),
        ...('latencyBand' in event ? { latencyBand: event.latencyBand } : {}),
        ...('sizeBand' in event ? { sizeBand: event.sizeBand } : {}),
        ...('quotaBand' in event ? { quotaBand: event.quotaBand } : {}),
        ...('errorCode' in event ? { errorCode: event.errorCode } : {}),
        occurredAt: nowIso,
        observedDay: day,
        expiresAt,
        retentionDays,
      });
    }

    if (accepted.length > 0) {
      const previousFirstObservedAt = summarySnapshot?.data()?.firstObservedAt;
      transaction.set(summaryRef, {
        schemaVersion: OBSERVABILITY_SCHEMA_VERSION,
        subjectKey: activeSubject.subjectKey,
        keyVersion: activeSubject.keyVersion,
        counts: incrementMap(accepted),
        firstObservedAt: typeof previousFirstObservedAt === 'string'
          ? previousFirstObservedAt
          : nowIso,
        lastObservedAt: nowIso,
        expiresAt,
        retentionDays,
      }, { merge: true });

      for (const [shardId, shardEvents] of groupByShard(accepted, shardCount)) {
        const shardRef = db
          .collection('user_observability_daily')
          .doc(day)
          .collection('shards')
          .doc(shardId);
        transaction.set(shardRef, {
          schemaVersion: OBSERVABILITY_SCHEMA_VERSION,
          day,
          shardId,
          shardCount,
          counts: incrementMap(shardEvents),
          updatedAt: nowIso,
          expiresAt,
          retentionDays,
        }, { merge: true });
      }
    }
    return {
      accepted: accepted.length,
      duplicate: duplicateCount,
      conflicts: conflictCount,
      consentDenied: consentDeniedCount,
    };
  });
  result.accepted = transactionResult.accepted;
  result.duplicate += transactionResult.duplicate;
  if (transactionResult.conflicts > 0) {
    result.rejected += transactionResult.conflicts;
    result.rejectionCodes.operation_conflict = (
      result.rejectionCodes.operation_conflict || 0
    ) + transactionResult.conflicts;
  }
  if (transactionResult.consentDenied > 0) {
    result.rejected += transactionResult.consentDenied;
    result.rejectionCodes.purpose_not_authorized = (
      result.rejectionCodes.purpose_not_authorized || 0
    ) + transactionResult.consentDenied;
  }
  return result;
}

/**
 * Product routes may use this wrapper after their primary action succeeds.
 * It intentionally never throws and never logs the event payload or subject.
 */
export async function recordObservabilitySafely(
  input: RecordObservabilityBatchInput,
): Promise<RecordObservabilityBatchResult | null> {
  try {
    return await recordObservabilityBatch(input);
  } catch {
    return null;
  }
}
