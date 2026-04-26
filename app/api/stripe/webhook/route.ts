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
import { monitor } from '@/lib/monitor';
import { triggerReferralReward } from '@/lib/referral';

let _stripe: Stripe | null = null;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
  return _stripe;
}

// Firebase client for Firestore writes (lazy)
let _db: ReturnType<typeof getFirestore> | null = null;
function getDb() {
  if (!_db) {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    };
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig, 'webhook');
    _db = getFirestore(app);
  }
  return _db;
}

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
    event = getStripe().webhooks.constructEvent(
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

        const subId = session.subscription as string;
        let status: string = 'active';
        let trialEnd: string | null = null;
        if (subId) {
          try {
            const stripe2 = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
            const sub = await stripe2.subscriptions.retrieve(subId);
            if (sub.status === 'trialing') {
              status = 'trialing';
              trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
            }
          } catch { /* fall through */ }
        }

        await setDoc(doc(getDb(), 'users', uid, 'subscription', 'current'), {
          plan,
          status,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subId || (session.subscription as string),
          amount,
          currency: 'usd',
          ...(trialEnd ? { trialEnd } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        console.log(`[stripe] checkout.completed uid=${uid.slice(0, 8)}… plan=${plan}`);
        monitor.info('New Subscription', `Plan: ${plan}${status === 'trialing' ? ' (7-day trial)' : ''}`, [
          { name: 'UID', value: uid.slice(0, 8) + '…' },
          { name: 'Plan', value: plan },
          { name: 'Status', value: status },
          { name: 'Amount', value: `$${(amount / 100).toFixed(2)}` },
        ]);

        const customerEmail = (session as any).customer_details?.email;
        if (customerEmail) {
          triggerReferralReward(uid, customerEmail).catch(() => {});
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Handles Stripe Elements flow (subscription created with default_incomplete)
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        if (!subscriptionId || !invoice.customer) break;

        const customer = await getStripe().customers.retrieve(invoice.customer as string) as Stripe.Customer;
        const uid = customer.metadata?.firebaseUid;
        if (!uid) break;

        // Get subscription to read interval and plan from metadata
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        const interval = subscription.metadata?.interval || 'month';

        // Detect plan from subscription metadata or price ID
        const studioPrices = [process.env.STRIPE_STUDIO_PRICE_ID, process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID].filter(Boolean);
        const invoicePriceId = (invoice as any).lines?.data?.[0]?.price?.id;
        const subPlan = subscription.metadata?.plan || (studioPrices.includes(invoicePriceId) ? 'studio' : 'pro');

        await setDoc(doc(getDb(), 'users', uid, 'subscription', 'current'), {
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
        monitor.info('Invoice Paid', `Renewal for ${subPlan}`, [
          { name: 'UID', value: uid.slice(0, 8) + '…' },
          { name: 'Plan', value: subPlan as string },
          { name: 'Amount', value: `$${((invoice.amount_paid ?? 0) / 100).toFixed(2)}` },
        ]);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const customer = await getStripe().customers.retrieve(customerId) as Stripe.Customer;
        const uid = customer.metadata?.firebaseUid;
        if (!uid) break;

        const status = subscription.status; // active, past_due, canceled, etc.

        // Detect plan from metadata or price ID
        const studioPrices2 = [process.env.STRIPE_STUDIO_PRICE_ID, process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID].filter(Boolean);
        const subPriceId = subscription.items?.data?.[0]?.price?.id;
        const updPlan = subscription.metadata?.plan || (studioPrices2.includes(subPriceId) ? 'studio' : 'pro');

        await setDoc(doc(getDb(), 'users', uid, 'subscription', 'current'), {
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

        const customer = await getStripe().customers.retrieve(customerId) as Stripe.Customer;
        const uid = customer.metadata?.firebaseUid;
        if (!uid) break;

        await setDoc(doc(getDb(), 'users', uid, 'subscription', 'current'), {
          plan: 'free',
          status: 'canceled',
          canceledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        console.log(`[stripe] subscription.deleted uid=${uid.slice(0, 8)}…`);
        monitor.warn('Subscription Canceled', 'User downgraded to free', [
          { name: 'UID', value: uid.slice(0, 8) + '…' },
        ]);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        const custId = sub.customer as string;
        const cust = await getStripe().customers.retrieve(custId) as Stripe.Customer;
        monitor.info('Trial Ending Soon', '3 days left', [
          { name: 'UID', value: cust.metadata?.firebaseUid?.slice(0, 8) + '…' || 'unknown' },
          { name: 'Email', value: cust.email || 'unknown' },
          { name: 'Auto-Renew', value: sub.cancel_at_period_end ? 'No' : 'Yes' },
        ]);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    monitor.critical('Stripe Webhook Error', String(error));
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
