/**
 * Stripe Checkout Session API
 * Creates a checkout session for the Pro plan ($2.99/mo)
 * POST /api/stripe/checkout
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { guardApiRoute } from '@/lib/api-auth';
import { monitor } from '@/lib/monitor';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
    });

    const { uid, email } = guard.user;

    // Get or create Stripe customer
    const customers = await stripe.customers.list({ email: email!, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: email!,
        metadata: { firebaseUid: uid },
      });
      customerId = customer.id;
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 });
    }

    // Determine base URL for redirects
    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: uid,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/suite?upgrade=success`,
      cancel_url: `${origin}/suite?upgrade=canceled`,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 7,
        metadata: { firebaseUid: uid },
      },
      metadata: { firebaseUid: uid },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    monitor.critical('Tool: stripe/checkout', String(error));
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
