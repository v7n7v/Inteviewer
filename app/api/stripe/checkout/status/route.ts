import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { getStripeRuntimeReadiness } from '@/lib/billing/stripe-runtime-readiness';
import {
  normalizeStripePendingCheckoutReceipt,
  readStripeCheckoutGuard,
  releaseStripeCheckout,
} from '@/lib/billing/stripe-checkout-reservation';
import {
  reconcileStripeCheckoutSession,
  STRIPE_CHECKOUT_RECONCILIATION_MAX_NETWORK_RETRIES,
  STRIPE_CHECKOUT_RECONCILIATION_TIMEOUT_MS,
} from '@/lib/billing/stripe-checkout-reconciliation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PublicCheckoutStatus = 'idle' | 'pending' | 'open' | 'complete' | 'expired';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};

function statusResponse(status: PublicCheckoutStatus, responseStatus = 200) {
  return NextResponse.json(
    { status },
    { status: responseStatus, headers: PRIVATE_HEADERS },
  );
}

function timestamp(value: string | null | undefined) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  const guard = await guardApiRoute(req, {
    rateLimit: 10,
    rateLimitWindow: 60_000,
    skipUsageCap: true,
  });
  if (guard.error) return guard.error;

  const checkoutGuard = await readStripeCheckoutGuard(getAdminDb(), guard.user.uid);
  const reservationId = checkoutGuard?.activeReservationId;
  if (!reservationId) return statusResponse('idle');

  const reservationStartedAtMs = timestamp(checkoutGuard.reservationStartedAt);
  const reservationExpiresAtMs = timestamp(checkoutGuard.reservationExpiresAt);
  const receipt = normalizeStripePendingCheckoutReceipt(checkoutGuard);
  if (
    !guard.user.email
    || reservationStartedAtMs === null
    || reservationExpiresAtMs === null
    || receipt === undefined
  ) {
    return statusResponse('pending');
  }

  if (!getStripeRuntimeReadiness().configurationReady || !process.env.STRIPE_SECRET_KEY) {
    return statusResponse('pending', 503);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
    timeout: STRIPE_CHECKOUT_RECONCILIATION_TIMEOUT_MS,
    maxNetworkRetries: STRIPE_CHECKOUT_RECONCILIATION_MAX_NETWORK_RETRIES,
  });

  try {
    const result = await reconcileStripeCheckoutSession(stripe, {
      uid: guard.user.uid,
      email: guard.user.email,
      reservationId,
      reservationStartedAtMs,
      receipt,
    });
    const reservationExpired = reservationExpiresAtMs <= Date.now();
    if (result.status === 'expired' || (result.status === 'not_found' && reservationExpired)) {
      await releaseStripeCheckout(getAdminDb(), guard.user.uid, reservationId);
      return statusResponse('expired');
    }
    if (result.status === 'open' || result.status === 'complete') {
      return statusResponse(result.status);
    }
    return statusResponse('pending');
  } catch {
    return statusResponse('pending', 503);
  }
}
