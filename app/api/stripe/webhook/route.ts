/**
 * Stripe Webhook Handler
 * Processes subscription lifecycle events from Stripe.
 * POST /api/stripe/webhook
 *
 * Events handled:
 * - checkout.session.completed → create subscription record
 * - customer.subscription.updated → update status
 * - customer.subscription.deleted → revert to free
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

// Firebase client for Firestore writes
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig, 'webhook');
const db = getFirestore(app);

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.client_reference_id;
        if (!uid) break;

        // Determine plan from metadata or price ID
        const sessionPlan = session.metadata?.plan;
        let plan: 'pro' | 'studio' = 'pro';
        if (sessionPlan === 'studio') {
          plan = 'studio';
        }

        const amount = plan === 'studio' ? 999 : 499; // cents

        await setDoc(doc(db, 'users', uid, 'subscription', 'current'), {
          plan,
          status: 'active',
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          amount,
          currency: 'usd',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        console.log(`[stripe] checkout.completed uid=${uid.slice(0, 8)}… plan=${plan}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        // Handles Stripe Elements flow (subscription created with default_incomplete)
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        if (!subscriptionId || !invoice.customer) break;

        const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer;
        const uid = customer.metadata?.firebaseUid;
        if (!uid) break;

        // Get subscription to read interval and plan from metadata
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const interval = subscription.metadata?.interval || 'month';

        // Detect plan from subscription metadata or price ID
        const studioPrices = [process.env.STRIPE_STUDIO_PRICE_ID, process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID].filter(Boolean);
        const invoicePriceId = (invoice as any).lines?.data?.[0]?.price?.id;
        const subPlan = subscription.metadata?.plan || (studioPrices.includes(invoicePriceId) ? 'studio' : 'pro');

        await setDoc(doc(db, 'users', uid, 'subscription', 'current'), {
          plan: subPlan,
          status: 'active',
          stripeCustomerId: invoice.customer as string,
          stripeSubscriptionId: subscriptionId,
          interval,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        console.log(`[stripe] invoice.paid uid=${uid.slice(0, 8)}… plan=${subPlan} interval=${interval}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        const uid = customer.metadata?.firebaseUid;
        if (!uid) break;

        const status = subscription.status; // active, past_due, canceled, etc.

        // Detect plan from metadata or price ID
        const studioPrices2 = [process.env.STRIPE_STUDIO_PRICE_ID, process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID].filter(Boolean);
        const subPriceId = subscription.items?.data?.[0]?.price?.id;
        const updPlan = subscription.metadata?.plan || (studioPrices2.includes(subPriceId) ? 'studio' : 'pro');

        await setDoc(doc(db, 'users', uid, 'subscription', 'current'), {
          plan: status === 'active' ? updPlan : 'free',
          status,
          stripeSubscriptionId: subscription.id,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        console.log(`[stripe] subscription.updated uid=${uid.slice(0, 8)}… plan=${updPlan} status=${status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        const uid = customer.metadata?.firebaseUid;
        if (!uid) break;

        await setDoc(doc(db, 'users', uid, 'subscription', 'current'), {
          plan: 'free',
          status: 'canceled',
          canceledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        console.log(`[stripe] subscription.deleted uid=${uid.slice(0, 8)}…`);
        break;
      }

      default:
        // Unhandled event type
        break;
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
