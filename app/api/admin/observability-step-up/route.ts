import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkObservabilityRateLimitStrict } from '@/lib/observability/rate-limit';
import { observabilitySurfaceAvailable } from '@/lib/observability/config';
import {
  createObservabilityAdminStepUp,
  readObservabilityAdminToken,
} from '@/lib/observability/diagnostics';
import {
  observabilityError,
  observabilityJson,
} from '@/lib/observability/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request, 'diagnostics.metadata.read');
  if (guard.error) return guard.error;
  if (!observabilitySurfaceAvailable()) {
    return observabilityError(409, 'observability_disabled', 'Observability is not enabled.');
  }
  const limiter = await checkObservabilityRateLimitStrict(
    'admin-step-up',
    guard.actor.uid,
    5,
    60_000,
  );
  if (limiter.unavailable) {
    return observabilityError(
      503,
      'observability_rate_limit_unavailable',
      'Admin step-up is temporarily unavailable.',
    );
  }
  if (!limiter.allowed) {
    return observabilityError(429, 'observability_rate_limited', 'Too many step-up attempts.');
  }
  try {
    const evidence = await readObservabilityAdminToken(request);
    const lease = await createObservabilityAdminStepUp(
      getAdminDb(),
      guard.actor,
      evidence,
    );
    return observabilityJson({
      scope: 'observability_metadata_v1',
      expiresAt: lease.expiresAt,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const denied = code === 'OBSERVABILITY_RECENT_MFA_REQUIRED'
      || code === 'OBSERVABILITY_ADMIN_REVOKED'
      || code === 'ADMIN_TOKEN_INVALID';
    return observabilityError(
      denied ? 403 : 503,
      denied ? 'observability_recent_mfa_required' : 'observability_step_up_unavailable',
      denied
        ? 'Reauthenticate with your second factor before viewing diagnostic metadata.'
        : 'Admin step-up is temporarily unavailable.',
    );
  }
}
