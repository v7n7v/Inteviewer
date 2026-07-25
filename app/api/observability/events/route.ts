import { NextRequest } from 'next/server';
import { checkObservabilityRateLimitStrict } from '@/lib/observability/rate-limit';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  isClientAuthoredEvent,
  validateObservabilityBatch,
} from '@/lib/observability/contracts';
import {
  OBSERVABILITY_MAX_BODY_BYTES,
  observabilitySurfaceAvailable,
} from '@/lib/observability/config';
import { readObservabilityConsent } from '@/lib/observability/consent';
import {
  observabilityError,
  observabilityJson,
  readBoundedJson,
  requireObservabilityUser,
} from '@/lib/observability/http';
import { recordObservabilityBatch } from '@/lib/observability/recorder';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireObservabilityUser(request);
  if (auth.error) return auth.error;

  const body = await readBoundedJson(request, OBSERVABILITY_MAX_BODY_BYTES);
  if (!body.ok) {
    return observabilityError(
      body.code === 'body_too_large' ? 413 : 400,
      body.code,
      body.code === 'body_too_large' ? 'The event batch is too large.' : 'The event batch is invalid.',
    );
  }
  const parsed = validateObservabilityBatch(body.value);
  if (!parsed.ok || parsed.events.some(event => !isClientAuthoredEvent(event))) {
    return observabilityError(400, 'observability_batch_rejected', 'The event batch is invalid.');
  }
  if (!observabilitySurfaceAvailable()) {
    return observabilityJson({
      accepted: 0,
      duplicate: 0,
      rejected: 0,
      disabled: parsed.events.length,
    });
  }

  const limiter = await checkObservabilityRateLimitStrict('ingest', auth.token.uid, 60, 60_000);
  if (limiter.unavailable) {
    return observabilityError(
      503,
      'observability_rate_limit_unavailable',
      'Event collection is temporarily unavailable.',
    );
  }
  if (!limiter.allowed) {
    return observabilityError(429, 'observability_rate_limited', 'Too many event batches.');
  }

  try {
    const db = getAdminDb();
    const consent = await readObservabilityConsent(db, auth.token.uid);
    const result = await recordObservabilityBatch({
      db,
      uid: auth.token.uid,
      events: parsed.events,
      author: 'client',
      productAnalyticsConsent: consent.productAnalytics,
    });
    return observabilityJson(result);
  } catch {
    return observabilityError(
      503,
      'observability_ingestion_unavailable',
      'Event collection is temporarily unavailable.',
    );
  }
}
