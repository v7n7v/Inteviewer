/**
 * Stripe Customer Portal API
 * Creates a portal session for managing subscriptions.
 * POST /api/stripe/portal
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { guardApiRoute } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }
    const stripe = new Stripe(key, { apiVersion: '2026-02-25.clover' });

    const { email } = guard.user;

    // Find Stripe customer
    const customers = await stripe.customers.list({ email: email!, limit: 1 });
    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: 'No subscription found. Please upgrade first.' },
        { status: 404 }
      );
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${origin}/suite`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Portal session error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
