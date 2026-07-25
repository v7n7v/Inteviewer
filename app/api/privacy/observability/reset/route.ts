import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkObservabilityRateLimitStrict } from '@/lib/observability/rate-limit';
import {
  observabilityError,
  observabilityJson,
  readBoundedJson,
  requireObservabilityUser,
} from '@/lib/observability/http';
import {
  observabilityResetJobIsRetained,
  observabilityResetRequestSchema,
  requestObservabilityReset,
} from '@/lib/observability/reset';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireObservabilityUser(request);
  if (auth.error) return auth.error;
  const limiter = await checkObservabilityRateLimitStrict(
    'reset-status',
    auth.token.uid,
    60,
    60 * 60_000,
  );
  if (limiter.unavailable) {
    return observabilityError(503, 'observability_rate_limit_unavailable', 'Reset status is temporarily unavailable.');
  }
  if (!limiter.allowed) {
    return observabilityError(429, 'observability_rate_limited', 'Too many reset status requests.');
  }
  const jobId = new URL(request.url).searchParams.get('jobId') || '';
  if (!/^[a-f0-9]{64}$/.test(jobId)) {
    return observabilityError(400, 'observability_reset_job_invalid', 'The reset reference is invalid.');
  }
  try {
    const snapshot = await getAdminDb().collection('observability_reset_jobs').doc(jobId).get();
    const data = snapshot.data();
    if (
      !snapshot.exists
      || data?.targetUid !== auth.token.uid
      || !observabilityResetJobIsRetained(data)
    ) {
      return observabilityError(404, 'observability_reset_job_not_found', 'Reset request not found.');
    }
    return observabilityJson({
      jobId,
      status: data.status === 'complete' || data.status === 'running' ? data.status : 'queued',
      deletedEvents: Number.isInteger(data.deletedEvents) ? data.deletedEvents : 0,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
      completedAt: typeof data.completedAt === 'string' ? data.completedAt : null,
      scope: 'observability_only',
      accountDeletionRequested: false,
      limitations: [
        'De-identified, rounded daily aggregates are not subtracted.',
        'Mandatory diagnostic access receipts and support-case evidence remain until their disclosed retention expiry.',
      ],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'OBSERVABILITY_RESET_EXPIRED') {
      return observabilityError(
        410,
        'observability_reset_expired',
        'The previous reset reference has expired. Start a new reset request.',
      );
    }
    return observabilityError(
      503,
      'observability_reset_unavailable',
      'The observability reset status is temporarily unavailable.',
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireObservabilityUser(request);
  if (auth.error) return auth.error;
  const limiter = await checkObservabilityRateLimitStrict(
    'reset-create',
    auth.token.uid,
    3,
    24 * 60 * 60_000,
  );
  if (limiter.unavailable) {
    return observabilityError(503, 'observability_rate_limit_unavailable', 'Reset requests are temporarily unavailable.');
  }
  if (!limiter.allowed) {
    return observabilityError(429, 'observability_rate_limited', 'Too many reset requests.');
  }
  const body = await readBoundedJson(request, 2_048);
  const parsed = observabilityResetRequestSchema.safeParse(body.ok ? body.value : null);
  if (!parsed.success) {
    return observabilityError(
      400,
      'observability_reset_invalid',
      'The observability reset request is invalid.',
    );
  }
  try {
    const result = await requestObservabilityReset(
      getAdminDb(),
      auth.token.uid,
      parsed.data,
    );
    return observabilityJson({
      ...result,
      scope: 'observability_only',
      accountDeletionRequested: false,
      limitations: [
        'De-identified, rounded daily aggregates are not subtracted.',
        'Mandatory diagnostic access receipts and support-case evidence remain until their disclosed retention expiry.',
      ],
    }, { status: result.duplicate ? 200 : 202 });
  } catch {
    return observabilityError(
      503,
      'observability_reset_unavailable',
      'The observability reset request is temporarily unavailable.',
    );
  }
}
