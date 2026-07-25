import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import type { AdminObservabilityResponse } from '@/lib/admin/contracts';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  observabilityEnabled,
  observabilityRetentionDays,
  observabilitySurfaceAvailable,
} from '@/lib/observability/config';
import { readObservabilityAggregate } from '@/lib/observability/aggregate';
import {
  observabilityError,
  observabilityJson,
} from '@/lib/observability/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function disabledResponse(): AdminObservabilityResponse {
  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    meta: {
      requestId: crypto.randomUUID(),
      generatedAt,
      staleAfterMs: 60_000,
      partial: false,
      truncated: false,
    },
    enabled: false,
    state: 'disabled',
    observationWindow: {
      startsAt: null,
      endsAt: null,
      windowDays: Math.min(30, observabilityRetentionDays()),
    },
    observedActivity: null,
    byCategory: {},
    byTool: {},
    byOutcome: {},
    consentCoverage: null,
    completeness: {
      complete: false,
      expectedShards: 0,
      readShards: 0,
      suppressedCells: 0,
      partialReasons: ['Observability is disabled by the server-controlled feature flag.'],
    },
    definitions: {
      observedActivity: 'Accepted allowlisted events; not unique users or complete usage.',
      suppressedCell: 'Counts below 10 are hidden.',
      consentCoverage: 'Unavailable in milestone 1.',
    },
    retention: {
      configuredDays: observabilityEnabled() ? observabilityRetentionDays() : null,
      policyApproved: process.env.OBSERVABILITY_RETENTION_POLICY_APPROVED === 'true',
    },
    limitations: [
      'No observability ingestion, aggregate materialization, or diagnostic reads are active.',
    ],
  };
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'analytics.read');
  if (guard.error) return guard.error;
  if (!observabilitySurfaceAvailable()) return observabilityJson(disabledResponse());
  try {
    const cached = await readObservabilityAggregate(getAdminDb());
    if (!cached.payload) {
      return observabilityError(
        503,
        'admin_observability_snapshot_unavailable',
        'The scheduled observability snapshot is not available; no live event scan was triggered.',
      );
    }
    const payload = cached.fresh
      ? cached.payload
      : {
          ...cached.payload,
          state: 'stale' as const,
          meta: { ...cached.payload.meta, partial: true },
          completeness: {
            ...cached.payload.completeness,
            complete: false,
            partialReasons: [
              ...cached.payload.completeness.partialReasons,
              'The last complete snapshot is stale.',
            ],
          },
        };
    return observabilityJson(payload);
  } catch {
    return observabilityError(
      503,
      'admin_observability_unavailable',
      'Observability evidence is temporarily unavailable.',
    );
  }
}
