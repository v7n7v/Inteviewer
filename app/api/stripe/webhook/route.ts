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

        await setDoc(doc(db, 'users', uid, 'subscription', 'current'), {
          plan: 'pro',
          status: 'active',
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          priceId: process.env.STRIPE_PRO_PRICE_ID,
          amount: 299, // cents
          currency: 'usd',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        console.log(`✅ Pro subscription activated for user: ${uid}`);
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

        await setDoc(doc(db, 'users', uid, 'subscription', 'current'), {
          plan: status === 'active' ? 'pro' : 'free',
          status,
          stripeSubscriptionId: subscription.id,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        console.log(`🔄 Subscription updated for user ${uid}: ${status}`);
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

        console.log(`❌ Subscription canceled for user ${uid}`);
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
