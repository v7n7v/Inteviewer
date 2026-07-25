import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { getStripeRuntimeReadiness } from '@/lib/billing/stripe-runtime-readiness';
import {
  normalizeStripePendingCheckoutReceipt,
  readStripeCheckoutGuard,
  recordStripePendingCheckout,
  releaseStripeCheckout,
} from '@/lib/billing/stripe-checkout-reservation';
import {
  findStripeCheckoutSession,
  STRIPE_CHECKOUT_RECONCILIATION_MAX_NETWORK_RETRIES,
  STRIPE_CHECKOUT_RECONCILIATION_TIMEOUT_MS,
} from '@/lib/billing/stripe-checkout-reconciliation';
import {
  buildStripeCheckoutResumePayload,
  type StripeCheckoutResumePayload,
} from '@/lib/billing/stripe-checkout-resume';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ResumeResponse =
  | StripeCheckoutResumePayload
  | { status: 'idle' | 'pending' | 'complete' | 'expired' };

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};

function resumeResponse(payload: ResumeResponse, responseStatus = 200) {
  return NextResponse.json(
    payload,
    { status: responseStatus, headers: PRIVATE_HEADERS },
  );
}

function timestamp(value: string | null | undefined) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 10, rateLimitWindow: 60_000, skipUsageCap: true });
  if (guard.error) return guard.error;

  const checkoutGuard = await readStripeCheckoutGuard(getAdminDb(), guard.user.uid);
  const reservationId = checkoutGuard?.activeReservationId;
  if (!reservationId) return resumeResponse({ status: 'idle' });

  const reservationStartedAtMs = timestamp(checkoutGuard.reservationStartedAt);
  const reservationExpiresAtMs = timestamp(checkoutGuard.reservationExpiresAt);
  const receipt = normalizeStripePendingCheckoutReceipt(checkoutGuard);
  if (
    !guard.user.email
    || reservationStartedAtMs === null
    || reservationExpiresAtMs === null
    || receipt === undefined
  ) {
    return resumeResponse({ status: 'pending' }, 409);
  }

  if (!getStripeRuntimeReadiness().configurationReady || !process.env.STRIPE_SECRET_KEY) {
    return resumeResponse({ status: 'pending' }, 503);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
    timeout: STRIPE_CHECKOUT_RECONCILIATION_TIMEOUT_MS,
    maxNetworkRetries: STRIPE_CHECKOUT_RECONCILIATION_MAX_NETWORK_RETRIES,
  });

  try {
    const result = await findStripeCheckoutSession(stripe, {
      uid: guard.user.uid,
      email: guard.user.email,
      reservationId,
      reservationStartedAtMs,
      receipt,
    });

    if (result.status === 'expired') {
      await releaseStripeCheckout(getAdminDb(), guard.user.uid, reservationId);
      return resumeResponse({ status: 'expired' });
    }
    if (result.status === 'not_found' && reservationExpiresAtMs <= Date.now()) {
      await releaseStripeCheckout(getAdminDb(), guard.user.uid, reservationId);
      return resumeResponse({ status: 'expired' });
    }
    if (result.status === 'complete') {
      return resumeResponse({ status: 'complete' });
    }
    if (result.status !== 'open' || !result.session) {
      return resumeResponse({ status: 'pending' }, result.status === 'ambiguous' ? 409 : 200);
    }

    const payload = buildStripeCheckoutResumePayload(result.session);
    const plan = result.session.metadata?.plan;
    const interval = result.session.metadata?.interval;
    if (
      !payload
      || (plan !== 'pro' && plan !== 'studio')
      || (interval !== 'month' && interval !== 'year')
    ) {
      return resumeResponse({ status: 'pending' }, 409);
    }

    const receiptResult = await recordStripePendingCheckout(getAdminDb(), {
      uid: guard.user.uid,
      reservationId,
      checkoutSessionId: result.session.id,
      mode: payload.mode,
      plan,
      interval,
      expiresAtMs: result.session.expires_at * 1_000,
    });
    if (!receiptResult.recorded) {
      return resumeResponse({ status: 'pending' }, 409);
    }
    return resumeResponse(payload);
  } catch {
    return resumeResponse({ status: 'pending' }, 503);
  }
}
