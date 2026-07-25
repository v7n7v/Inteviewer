import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  createDiagnosticCase,
  diagnosticCaseCreateSchema,
  sanitizeDiagnosticCase,
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

export async function GET(request: NextRequest) {
  const auth = await requireObservabilityUser(request);
  if (auth.error) return auth.error;
  try {
    const snapshot = await getAdminDb()
      .collection('diagnostic_support_cases')
      .where('targetUid', '==', auth.token.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    const cases = snapshot.docs
      .map(document => sanitizeDiagnosticCase(document.id, document.data()))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    return observabilityJson({
      cases,
      enabled: observabilitySurfaceAvailable(),
      truncated: snapshot.size === 20,
    });
  } catch {
    return observabilityError(
      503,
      'diagnostic_cases_unavailable',
      'Diagnostic support cases are temporarily unavailable.',
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireObservabilityUser(request);
  if (auth.error) return auth.error;
  const limiter = await checkObservabilityRateLimitStrict(
    'diagnostic-case-create',
    auth.token.uid,
    10,
    60 * 60_000,
  );
  if (limiter.unavailable) {
    return observabilityError(503, 'observability_rate_limit_unavailable', 'Diagnostic support is temporarily unavailable.');
  }
  if (!limiter.allowed) {
    return observabilityError(429, 'observability_rate_limited', 'Too many diagnostic support requests.');
  }
  if (!observabilitySurfaceAvailable()) {
    return observabilityError(
      409,
      'observability_disabled',
      'Privacy-safe diagnostic sharing is not enabled.',
    );
  }
  const body = await readBoundedJson(request, 2_048);
  const parsed = diagnosticCaseCreateSchema.safeParse(body.ok ? body.value : null);
  if (!parsed.success) {
    return observabilityError(400, 'diagnostic_case_invalid', 'The diagnostic support request is invalid.');
  }
  try {
    const diagnosticCase = await createDiagnosticCase(
      getAdminDb(),
      auth.token.uid,
      parsed.data,
    );
    return observabilityJson({ case: diagnosticCase }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return observabilityError(
      code === 'OBSERVABILITY_NOTICE_VERSION_CHANGED' ? 409 : 503,
      code === 'OBSERVABILITY_NOTICE_VERSION_CHANGED'
        ? 'observability_notice_changed'
        : 'diagnostic_case_unavailable',
      code === 'OBSERVABILITY_NOTICE_VERSION_CHANGED'
        ? 'The privacy notice changed. Review it before continuing.'
        : 'The diagnostic support request is temporarily unavailable.',
    );
  }
}
