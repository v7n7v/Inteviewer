import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  diagnosticGrantUpdateSchema,
  updateDiagnosticGrant,
} from '@/lib/observability/diagnostics';
import { observabilitySurfaceAvailable } from '@/lib/observability/config';
import { checkObservabilityRateLimitStrict } from '@/lib/observability/rate-limit';
import {
  observabilityError,
  observabilityJson,
  readBoundedJson,
  requireObservabilityUser,
} from '@/lib/observability/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const auth = await requireObservabilityUser(request);
  if (auth.error) return auth.error;
  const limiter = await checkObservabilityRateLimitStrict(
    'diagnostic-grant',
    auth.token.uid,
    30,
    60 * 60_000,
  );
  if (limiter.unavailable) {
    return observabilityError(503, 'observability_rate_limit_unavailable', 'Diagnostic sharing is temporarily unavailable.');
  }
  if (!limiter.allowed) {
    return observabilityError(429, 'observability_rate_limited', 'Too many diagnostic-sharing changes.');
  }
  const body = await readBoundedJson(request, 2_048);
  const parsed = diagnosticGrantUpdateSchema.safeParse(body.ok ? body.value : null);
  if (!parsed.success) {
    return observabilityError(400, 'diagnostic_grant_invalid', 'The diagnostic-sharing choice is invalid.');
  }
  if (parsed.data.decision === 'grant' && !observabilitySurfaceAvailable()) {
    return observabilityError(
      409,
      'observability_disabled',
      'Privacy-safe diagnostic sharing is not enabled.',
    );
  }
  const { caseId } = await context.params;
  try {
    const diagnosticCase = await updateDiagnosticGrant(
      getAdminDb(),
      auth.token.uid,
      caseId,
      parsed.data,
    );
    return observabilityJson({ case: diagnosticCase });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const notFound = code === 'DIAGNOSTIC_CASE_NOT_FOUND';
    const noticeChanged = code === 'OBSERVABILITY_NOTICE_VERSION_CHANGED';
    return observabilityError(
      notFound ? 404 : noticeChanged ? 409 : 503,
      notFound
        ? 'diagnostic_case_not_found'
        : noticeChanged
          ? 'observability_notice_changed'
          : 'diagnostic_grant_unavailable',
      notFound
        ? 'Diagnostic support case not found.'
        : noticeChanged
          ? 'The privacy notice changed. Review it before continuing.'
          : 'The diagnostic-sharing choice is temporarily unavailable.',
    );
  }
}
