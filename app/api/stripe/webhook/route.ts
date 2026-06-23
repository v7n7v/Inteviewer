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
import { sendSubscriptionEmail, sendCancellationEmail, sendTrialEndingEmail, sendPlanChangeEmail } from '@/lib/email';

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

function formatStripePrice(price?: Stripe.Price | null) {
  if (!price?.unit_amount) return undefined;
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: price.unit_amount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price.unit_amount / 100);
  const interval = price.recurring?.interval === 'year' ? 'yr' : 'mo';
  return `${amount}/${interval}`;
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

        const subId = session.subscription as string;
        let status: string = 'active';
        let trialEnd: string | null = null;
        let amount = (session as any).amount_total ?? 0;
        let currency = session.currency || 'usd';
        let interval = session.metadata?.interval || 'month';
        let priceDisplay: string | undefined;
        if (subId) {
          try {
            const stripe2 = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
            const sub = await stripe2.subscriptions.retrieve(subId);
            const price = sub.items?.data?.[0]?.price;
            amount = price?.unit_amount ?? amount;
            currency = price?.currency || currency;
            interval = price?.recurring?.interval || interval;
            priceDisplay = formatStripePrice(price);
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
          currency,
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
          // Send subscription confirmation email
          const customerName = (session as any).customer_details?.name || customerEmail.split('@')[0];
          sendSubscriptionEmail(customerEmail, customerName, plan, interval, priceDisplay).catch(() => {});
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

        const status = subscription.status; // active, trialing, past_due, canceled, etc.

        // Detect plan from metadata or price ID
        const studioPrices2 = [process.env.STRIPE_STUDIO_PRICE_ID, process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID].filter(Boolean);
        const subPriceId = subscription.items?.data?.[0]?.price?.id;
        const updPlan = subscription.metadata?.plan || (studioPrices2.includes(subPriceId) ? 'studio' : 'pro');

        await setDoc(doc(getDb(), 'users', uid, 'subscription', 'current'), {
          plan: ['active', 'trialing'].includes(status) ? updPlan : 'free',
          status,
          stripeSubscriptionId: subscription.id,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: (subscription as any).current_period_end
            ? new Date((subscription as any).current_period_end * 1000).toISOString()
            : null,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        console.log(`[stripe] subscription.updated uid=${uid.slice(0, 8)}… plan=${updPlan} status=${status}`);

        // Detect plan change and send notification email
        const prevAttrs = (event.data as any).previous_attributes;
        if (prevAttrs && status === 'active' && customer.email) {
          const prevPriceId = prevAttrs?.items?.data?.[0]?.price?.id;
          if (prevPriceId && prevPriceId !== subPriceId) {
            const prevPlan = studioPrices2.includes(prevPriceId) ? 'studio' : 'pro';
            if (prevPlan !== updPlan) {
              const changeName = customer.name || customer.email.split('@')[0];
              sendPlanChangeEmail(customer.email, changeName, prevPlan, updPlan).catch(() => {});
              monitor.info('Plan Changed', `${prevPlan} → ${updPlan}`, [
                { name: 'UID', value: uid.slice(0, 8) + '…' },
              ]);
            }
          }
        }

        if (customer.email && subscription.cancel_at_period_end && prevAttrs?.cancel_at_period_end === false) {
          const cancelName = customer.name || customer.email.split('@')[0];
          const accessEndsAt = (subscription as any).current_period_end
            ? new Date((subscription as any).current_period_end * 1000).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : undefined;
          sendCancellationEmail(customer.email, cancelName, accessEndsAt).catch(() => {});
          monitor.info('Subscription Cancel Scheduled', 'User will retain access through the billing period', [
            { name: 'UID', value: uid.slice(0, 8) + '…' },
            { name: 'Access ends', value: accessEndsAt || 'period end' },
          ]);
        }
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

        // Send cancellation email
        if (customer.email) {
          const cancelName = customer.name || customer.email.split('@')[0];
          const accessEndsAt = (subscription as any).current_period_end
            ? new Date((subscription as any).current_period_end * 1000).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : undefined;
          sendCancellationEmail(customer.email, cancelName, accessEndsAt).catch(() => {});
        }
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

        // Send trial ending email
        if (cust.email) {
          const trialName = cust.name || cust.email.split('@')[0];
          const daysLeft = sub.trial_end
            ? Math.max(1, Math.ceil((sub.trial_end * 1000 - Date.now()) / (24 * 60 * 60 * 1000)))
            : 3;
          sendTrialEndingEmail(cust.email, trialName, daysLeft).catch(() => {});
        }
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
