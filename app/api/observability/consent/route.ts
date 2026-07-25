import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  readObservabilityConsent,
  setObservabilityConsent,
  type ObservabilityConsentState,
} from '@/lib/observability/consent';
import {
  observabilityNoticeVersion,
  observabilityPolicyApproved,
  observabilitySurfaceAvailable,
} from '@/lib/observability/config';
import {
  observabilityError,
  observabilityJson,
  readBoundedJson,
  requireObservabilityUser,
} from '@/lib/observability/http';
import { checkObservabilityRateLimitStrict } from '@/lib/observability/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uiConsentSchema = z.object({
  productAnalytics: z.boolean(),
  noticeVersion: z.string().min(3).max(64).regex(/^[a-z0-9][a-z0-9._-]+$/i),
  expectedRevision: z.number().int().nonnegative(),
}).strict();

function uiConsent(consent: ObservabilityConsentState) {
  return {
    productAnalytics: consent.productAnalytics ? 'granted' as const : 'denied' as const,
    noticeVersion: consent.noticeVersion,
    decidedAt: consent.decisionAt,
    withdrawnAt: consent.withdrawnAt,
    revision: consent.revision,
  };
}

function policy() {
  return {
    noticeVersion: observabilityNoticeVersion(),
    retentionApproved: observabilityPolicyApproved(),
    collectionEnabled: observabilitySurfaceAvailable(),
    optional: true,
    contentCollected: false,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireObservabilityUser(request);
  if (auth.error) return auth.error;
  try {
    const consent = await readObservabilityConsent(getAdminDb(), auth.token.uid);
    return observabilityJson({
      enabled: true,
      consent: uiConsent(consent),
      policy: policy(),
    });
  } catch {
    return observabilityError(
      503,
      'observability_consent_unavailable',
      'Privacy controls are temporarily unavailable.',
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireObservabilityUser(request);
  if (auth.error) return auth.error;
  const body = await readBoundedJson(request, 2_048);
  const parsed = uiConsentSchema.safeParse(body.ok ? body.value : null);
  if (!parsed.success) {
    return observabilityError(400, 'observability_consent_invalid', 'The privacy preference is invalid.');
  }
  if (parsed.data.productAnalytics) {
    const limiter = await checkObservabilityRateLimitStrict(
      'consent-grant',
      auth.token.uid,
      10,
      24 * 60 * 60_000,
    );
    if (limiter.unavailable) {
      return observabilityError(
        503,
        'observability_rate_limit_unavailable',
        'Optional analytics cannot be enabled right now. Analytics remain off.',
      );
    }
    if (!limiter.allowed) {
      return observabilityError(
        429,
        'observability_rate_limited',
        'Too many analytics preference changes. Analytics remain off.',
      );
    }
  }
  try {
    const consent = await setObservabilityConsent(
      getAdminDb(),
      auth.token.uid,
      parsed.data,
    );
    return observabilityJson({
      enabled: true,
      consent: uiConsent(consent),
      policy: policy(),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'OBSERVABILITY_NOTICE_VERSION_CHANGED') {
      return observabilityError(
        409,
        'observability_notice_changed',
        'The privacy notice changed. Review it before continuing.',
      );
    }
    if (code === 'OBSERVABILITY_CONSENT_REVISION_CONFLICT') {
      return observabilityError(
        409,
        'observability_consent_changed',
        'Your privacy preference changed. Refresh and try again.',
      );
    }
    return observabilityError(
      503,
      'observability_consent_unavailable',
      'Privacy controls are temporarily unavailable.',
    );
  }
}
