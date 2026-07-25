import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { observabilitySurfaceAvailable } from '@/lib/observability/config';
import { sanitizeDiagnosticCase } from '@/lib/observability/diagnostics';
import {
  observabilityError,
  observabilityJson,
} from '@/lib/observability/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'diagnostics.metadata.read');
  if (guard.error) return guard.error;
  if (!observabilitySurfaceAvailable()) {
    return observabilityJson({ enabled: false, cases: [], truncated: false });
  }
  try {
    const snapshot = await getAdminDb()
      .collection('diagnostic_support_cases')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return observabilityJson({
      enabled: true,
      cases: snapshot.docs
        .map(document => sanitizeDiagnosticCase(document.id, document.data()))
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
      truncated: snapshot.size === 50,
      limitations: [
        'Cases are metadata-only and do not include user identity or submitted content.',
      ],
    });
  } catch {
    return observabilityError(
      503,
      'admin_diagnostic_cases_unavailable',
      'Diagnostic support cases are temporarily unavailable.',
    );
  }
}
