import { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  observabilityError,
  observabilityJson,
  requireObservabilityUser,
} from '@/lib/observability/http';
import { readObservabilityTimeline } from '@/lib/observability/timeline';
import { checkObservabilityRateLimitStrict } from '@/lib/observability/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireObservabilityUser(request);
  if (auth.error) return auth.error;
  const limiter = await checkObservabilityRateLimitStrict(
    'self-export',
    auth.token.uid,
    60,
    60 * 60_000,
  );
  if (limiter.unavailable) {
    return observabilityError(503, 'observability_rate_limit_unavailable', 'The observability export is temporarily unavailable.');
  }
  if (!limiter.allowed) {
    return observabilityError(429, 'observability_rate_limited', 'Too many observability export requests.');
  }
  const params = new URL(request.url).searchParams;
  const limit = Number(params.get('limit') || 25);
  const cursor = params.get('cursor');
  try {
    const result = await readObservabilityTimeline(getAdminDb(), {
      uid: auth.token.uid,
      caseId: 'self-export',
      cursorContext: `privacy-export:${auth.token.uid}`,
      limit,
      cursor,
    });
    return observabilityJson({
      ...result,
      scope: 'observability_metadata_only',
      limitations: [
        'This export contains privacy-safe observability metadata only.',
        'It is not a complete account or document export.',
      ],
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return observabilityError(
      code === 'OBSERVABILITY_CURSOR_INVALID' ? 409 : 503,
      code === 'OBSERVABILITY_CURSOR_INVALID'
        ? 'observability_export_cursor_invalid'
        : 'observability_export_unavailable',
      code === 'OBSERVABILITY_CURSOR_INVALID'
        ? 'The export cursor is invalid or expired.'
        : 'The observability export is temporarily unavailable.',
    );
  }
}
