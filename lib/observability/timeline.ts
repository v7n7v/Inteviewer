import 'server-only';
import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import {
  opaqueObservabilityReference,
  signObservabilityCursor,
  verifyObservabilityCursor,
  type ObservabilityCursorPosition,
} from '@/lib/observability/cursor';
import { deriveRetainedObservabilitySubjects } from '@/lib/observability/subject';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export interface ObservabilityTimelineEvent {
  eventRef: string;
  traceRef: string | null;
  occurredAt: string;
  purpose: 'service_reliability' | 'product_analytics';
  eventName: string;
  category: string;
  action: string;
  outcome: string;
  plan: string;
  tool: string | null;
  latencyBand: string | null;
  sizeBand: string | null;
  quotaBand: string | null;
  errorCode: string | null;
}

interface TimelineCandidate {
  keyVersion: string;
  documentId: string;
  event: ObservabilityTimelineEvent;
}

function timestampMillis(value: unknown): number {
  if (
    value
    && typeof value === 'object'
    && typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return Number((value as { toMillis: () => number }).toMillis());
  }
  return Number.NaN;
}

function safeText(value: unknown, maximum = 64): string {
  return typeof value === 'string' ? value.slice(0, maximum) : '';
}

function optionalText(value: unknown, maximum = 64): string | null {
  return typeof value === 'string' ? value.slice(0, maximum) : null;
}

function boundedLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(value!), 1), MAX_LIMIT);
}

export async function readObservabilityTimeline(
  db: Firestore,
  input: {
    uid: string;
    cursorContext: string;
    caseId: string;
    limit?: number;
    cursor?: string | null;
    now?: Date;
  },
): Promise<{
  events: ObservabilityTimelineEvent[];
  nextCursor: string | null;
  truncated: boolean;
}> {
  const now = input.now ?? new Date();
  const limit = boundedLimit(input.limit);
  const subjects = deriveRetainedObservabilitySubjects(input.uid);
  const verifiedCursor = input.cursor
    ? verifyObservabilityCursor(input.cursor, input.cursorContext, now)
    : { ok: true as const, positions: [] };
  if (!verifiedCursor.ok) throw new Error('OBSERVABILITY_CURSOR_INVALID');
  const positionByVersion = new Map(
    verifiedCursor.positions.map(position => [position.keyVersion, position]),
  );
  const candidates: TimelineCandidate[] = [];
  const versionMayHaveMore = new Map<string, boolean>();
  const emptyStreamContinuationPositions = new Map<string, ObservabilityCursorPosition>();
  for (const subject of subjects) {
    const position = positionByVersion.get(subject.keyVersion);
    let scanPosition = position;
    let scans = 0;
    let subjectCandidates = 0;
    const scanLimit = Math.min(200, Math.max(50, limit * 2));
    while (scans < 5 && subjectCandidates <= limit) {
      let query: FirebaseFirestore.Query = db
        .collection('user_observability_events')
        .where('subjectKey', '==', subject.subjectKey)
        .where('occurredAt', '<=', position?.occurredAt || now.toISOString())
        .orderBy('occurredAt', 'desc')
        .orderBy(FieldPath.documentId(), 'desc');
      if (scanPosition) query = query.startAfter(scanPosition.occurredAt, scanPosition.documentId);
      const snapshot = await query.limit(scanLimit).get();
      scans += 1;
      for (const document of snapshot.docs) {
        const data = document.data();
        const occurredAt = safeText(data.occurredAt);
        scanPosition = {
          keyVersion: subject.keyVersion,
          occurredAt,
          documentId: document.id,
        };
        const expiresAtMs = timestampMillis(data.expiresAt);
        if (
          !occurredAt
          || Date.parse(occurredAt) > now.getTime()
          || !Number.isFinite(expiresAtMs)
          || expiresAtMs <= now.getTime()
        ) {
          continue;
        }
        if (data.purpose !== 'service_reliability' && data.purpose !== 'product_analytics') continue;
        subjectCandidates += 1;
        candidates.push({
          keyVersion: subject.keyVersion,
          documentId: document.id,
          event: {
            eventRef: opaqueObservabilityReference(input.caseId, document.id),
            traceRef: typeof data.traceId === 'string'
              ? opaqueObservabilityReference(`${input.caseId}:trace`, data.traceId)
              : null,
            occurredAt,
            purpose: data.purpose,
            eventName: safeText(data.eventName),
            category: safeText(data.category),
            action: safeText(data.action),
            outcome: safeText(data.outcome),
            plan: safeText(data.plan),
            tool: optionalText(data.tool),
            latencyBand: optionalText(data.latencyBand),
            sizeBand: optionalText(data.sizeBand),
            quotaBand: optionalText(data.quotaBand),
            errorCode: optionalText(data.errorCode),
          },
        });
      }
      const mayHaveMore = snapshot.size === scanLimit;
      versionMayHaveMore.set(subject.keyVersion, mayHaveMore);
      if (!mayHaveMore) break;
    }
    if (
      subjectCandidates === 0
      && versionMayHaveMore.get(subject.keyVersion)
      && scanPosition
    ) {
      emptyStreamContinuationPositions.set(subject.keyVersion, scanPosition);
    }
  }
  candidates.sort((left, right) => (
    right.event.occurredAt.localeCompare(left.event.occurredAt)
    || right.documentId.localeCompare(left.documentId)
  ));
  const page = candidates.slice(0, limit);
  const truncated = candidates.length > limit
    || [...versionMayHaveMore.values()].some(Boolean);
  const nextPositions = new Map(positionByVersion);
  for (const [version, position] of emptyStreamContinuationPositions) {
    nextPositions.set(version, position);
  }
  for (const candidate of page) {
    nextPositions.set(candidate.keyVersion, {
      keyVersion: candidate.keyVersion,
      occurredAt: candidate.event.occurredAt,
      documentId: candidate.documentId,
    });
  }
  const nextCursor = truncated && nextPositions.size > 0
    ? signObservabilityCursor({
        context: input.cursorContext,
        positions: [...nextPositions.values()] as ObservabilityCursorPosition[],
        expiresAt: new Date(now.getTime() + 15 * 60_000),
      })
    : null;
  return {
    events: page.map(candidate => candidate.event),
    nextCursor,
    truncated,
  };
}
