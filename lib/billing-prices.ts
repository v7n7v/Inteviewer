import Stripe from 'stripe';
import {
  type BillingInterval,
  type BillingPlan,
  type PublicBillingPrice,
  type PublicBillingPrices,
  unavailableBillingPrice,
  unavailableBillingPrices,
} from '@/lib/billing-price-types';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedPrices: { expiresAt: number; value: PublicBillingPrices } | null = null;
let stripeClient: Stripe | null = null;

const PRICE_ENV: Record<BillingPlan, Record<BillingInterval, string>> = {
  pro: {
    month: 'STRIPE_PRO_PRICE_ID',
    year: 'STRIPE_PRO_ANNUAL_PRICE_ID',
  },
  studio: {
    month: 'STRIPE_STUDIO_PRICE_ID',
    year: 'STRIPE_STUDIO_ANNUAL_PRICE_ID',
  },
};

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });
  }
  return stripeClient;
}

function formatMoney(unitAmount: number | null | undefined, currency = 'usd') {
  if (unitAmount == null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: unitAmount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(unitAmount / 100);
}

function formatInterval(interval: BillingInterval) {
  return interval === 'year' ? 'yr' : 'mo';
}

function publicPriceFromStripe(price: Stripe.Price, interval: BillingInterval): PublicBillingPrice {
  const currency = price.currency || 'usd';
  const unitAmount = price.unit_amount ?? null;
  const money = formatMoney(unitAmount, currency);

  return {
    unitAmount,
    currency,
    interval,
    active: price.active,
    display: money ? `${money}/${formatInterval(interval)}` : unavailableBillingPrice(interval).display,
    effectiveMonthlyDisplay: interval === 'year' && unitAmount != null
      ? `${formatMoney(Math.round(unitAmount / 12), currency)}/mo effective`
      : money ? `${money}/mo` : unavailableBillingPrice(interval).effectiveMonthlyDisplay,
    savingsLabel: '',
  };
}

function addSavings(prices: PublicBillingPrices): PublicBillingPrices {
  const next = structuredClone(prices);

  (['pro', 'studio'] as BillingPlan[]).forEach((plan) => {
    const month = next.plans[plan].month.unitAmount;
    const year = next.plans[plan].year.unitAmount;
    if (!month || !year) return;

    const annualFull = month * 12;
    if (year >= annualFull) return;

    const percent = Math.round((1 - year / annualFull) * 100);
    next.plans[plan].year.savingsLabel = `Save ${percent}%`;
  });

  return next;
}

async function fetchPrice(plan: BillingPlan, interval: BillingInterval): Promise<PublicBillingPrice> {
  const stripe = getStripe();
  const priceId = process.env[PRICE_ENV[plan][interval]];
  if (!stripe || !priceId) return unavailableBillingPrice(interval);

  try {
    const price = await stripe.prices.retrieve(priceId);
    return publicPriceFromStripe(price, interval);
  } catch (error) {
    console.warn(`[billing-prices] Could not retrieve ${plan}/${interval} price:`, error);
    return unavailableBillingPrice(interval);
  }
}

export async function getBillingPrices(opts: { force?: boolean } = {}): Promise<PublicBillingPrices> {
  if (!opts.force && cachedPrices && cachedPrices.expiresAt > Date.now()) {
    return cachedPrices.value;
  }

  const [proMonth, proYear, studioMonth, studioYear] = await Promise.all([
    fetchPrice('pro', 'month'),
    fetchPrice('pro', 'year'),
    fetchPrice('studio', 'month'),
    fetchPrice('studio', 'year'),
  ]);

  const value = addSavings({
    plans: {
      pro: { month: proMonth, year: proYear },
      studio: { month: studioMonth, year: studioYear },
    },
    updatedAt: new Date().toISOString(),
  });

  cachedPrices = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function getBillingPrice(plan: BillingPlan, interval: BillingInterval) {
  const prices = await getBillingPrices();
  return prices.plans[plan][interval];
}

export async function getMonthlyPlanRevenue(plan: BillingPlan) {
  const price = await getBillingPrice(plan, 'month');
  return price.unitAmount == null ? 0 : price.unitAmount / 100;
}

export function getDefaultBillingPrices() {
  return unavailableBillingPrices();
}
