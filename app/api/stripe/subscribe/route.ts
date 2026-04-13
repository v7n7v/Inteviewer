/**
 * Stripe Subscribe API — Embedded Checkout Flow
 * Creates an embedded checkout session for the Pro plan.
 * Returns clientSecret for frontend EmbeddedCheckout or PaymentElement.
 * POST /api/stripe/subscribe
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { guardApiRoute } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { StripeSubscribeSchema } from '@/lib/schemas';

// Lazy-init Stripe to avoid crash if env var missing at module load
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2026-02-25.clover' });
}

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    const stripe = getStripe();
    const { uid, email } = guard.user;

    let interval = 'month';
    let plan = 'pro';
    const validated = await validateBody(req, StripeSubscribeSchema);
    if (validated.success) {
      interval = validated.data.interval;
      plan = validated.data.plan;
    }

    // Resolve price ID based on plan + interval
    const PRICE_MAP: Record<string, Record<string, string | undefined>> = {
      pro: {
        month: process.env.STRIPE_PRO_PRICE_ID,
        year: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
      },
      studio: {
        month: process.env.STRIPE_STUDIO_PRICE_ID,
        year: process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID,
      },
    };

    const priceId = PRICE_MAP[plan]?.[interval];

    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe ${plan} ${interval}ly price not configured. Contact support.` },
        { status: 500 }
      );
    }

    // Get or create Stripe customer
    const customers = await stripe.customers.list({ email: email!, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      if (!customers.data[0].metadata?.firebaseUid) {
        await stripe.customers.update(customerId, {
          metadata: { firebaseUid: uid },
        });
      }
    } else {
      const customer = await stripe.customers.create({
        email: email!,
        metadata: { firebaseUid: uid },
      });
      customerId = customer.id;
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    // Create embedded checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: uid,
      ui_mode: 'embedded',
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: `${origin}/suite?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      metadata: { firebaseUid: uid, interval, plan },
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
    });
  } catch (error: unknown) {
    console.error('[api/stripe/subscribe] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
