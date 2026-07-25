import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkObservabilityRateLimitStrict } from '@/lib/observability/rate-limit';
import { observabilitySurfaceAvailable } from '@/lib/observability/config';
import {
  assertDiagnosticAccessPreflight,
  createDiagnosticAccessReceipt,
  DIAGNOSTIC_METADATA_SCOPE,
  readObservabilityAdminToken,
  SAFE_DIAGNOSTIC_CASE_ID,
} from '@/lib/observability/diagnostics';
import {
  observabilityError,
  observabilityJson,
} from '@/lib/observability/http';
import { readObservabilityTimeline } from '@/lib/observability/timeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const guard = await requireAdmin(request, 'diagnostics.metadata.read');
  if (guard.error) return guard.error;
  if (!observabilitySurfaceAvailable()) {
    return observabilityError(409, 'observability_disabled', 'Observability is not enabled.');
  }
  const limiter = await checkObservabilityRateLimitStrict(
    'admin-diagnostic-read',
    guard.actor.uid,
    30,
    60_000,
  );
  if (limiter.unavailable) {
    return observabilityError(
      503,
      'observability_rate_limit_unavailable',
      'Diagnostic metadata is temporarily unavailable.',
    );
  }
  if (!limiter.allowed) {
    return observabilityError(429, 'observability_rate_limited', 'Too many diagnostic reads.');
  }
  const { caseId } = await context.params;
  if (!SAFE_DIAGNOSTIC_CASE_ID.test(caseId)) {
    return observabilityError(404, 'diagnostic_case_not_found', 'Diagnostic support case not found.');
  }
  const params = new URL(request.url).searchParams;
  const limit = Number(params.get('limit') || 25);
  const cursor = params.get('cursor');
  const db = getAdminDb();
  try {
    const [caseSnapshot, evidence] = await Promise.all([
      db.collection('diagnostic_support_cases').doc(caseId).get(),
      readObservabilityAdminToken(request),
    ]);
    const diagnosticCase = caseSnapshot.data();
    const caseExpiresAt = diagnosticCase?.expiresAt
      && typeof diagnosticCase.expiresAt.toMillis === 'function'
      ? Number(diagnosticCase.expiresAt.toMillis())
      : Number.NaN;
    if (
      !caseSnapshot.exists
      || diagnosticCase?.status !== 'open'
      || diagnosticCase?.scope !== DIAGNOSTIC_METADATA_SCOPE
      || typeof diagnosticCase?.targetUid !== 'string'
      || !Number.isFinite(caseExpiresAt)
      || caseExpiresAt <= Date.now()
    ) {
      return observabilityError(404, 'diagnostic_case_not_found', 'Diagnostic support case not found.');
    }
    const targetUid = diagnosticCase.targetUid;
    await assertDiagnosticAccessPreflight(db, {
      actor: guard.actor,
      evidence,
      caseId,
      expectedTargetUid: targetUid,
    });
    const cursorContext = `diagnostic-activity:${caseId}:${guard.actor.uid}`;
    const timeline = await readObservabilityTimeline(db, {
      uid: targetUid,
      caseId,
      cursorContext,
      limit,
      cursor,
    });

    const authorization = await createDiagnosticAccessReceipt(db, {
      actor: guard.actor,
      evidence,
      caseId,
      expectedTargetUid: targetUid,
      returnedEvents: timeline.events.length,
      cursorUsed: Boolean(cursor),
    });
    return observabilityJson({
      caseId,
      scope: DIAGNOSTIC_METADATA_SCOPE,
      case: {
        id: caseId,
        status: authorization.caseStatus,
      },
      grant: {
        state: 'active',
        expiresAt: authorization.grantExpiresAt,
      },
      stepUp: {
        state: 'active',
        expiresAt: authorization.stepUpExpiresAt,
      },
      events: timeline.events,
      nextCursor: timeline.nextCursor,
      truncated: timeline.truncated,
      completeHistory: false,
      limitations: [
        'This is a partial timeline of retained, allowlisted metadata only.',
        'Prompts, Taco responses, documents, filenames, search terms, and identity fields are never included.',
      ],
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'OBSERVABILITY_CURSOR_INVALID') {
      return observabilityError(409, 'observability_cursor_invalid', 'The activity cursor is invalid or expired.');
    }
    if (
      code === 'OBSERVABILITY_DIAGNOSTIC_ACCESS_DENIED'
      || code === 'ADMIN_TOKEN_INVALID'
    ) {
      return observabilityError(
        403,
        'observability_diagnostic_access_denied',
        'The case grant, recent-MFA lease, or Admin permission is missing or expired.',
      );
    }
    return observabilityError(
      503,
      'observability_diagnostic_unavailable',
      'Diagnostic metadata is temporarily unavailable.',
    );
  }
}
