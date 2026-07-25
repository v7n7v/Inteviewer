import type { BillingInterval, BillingPlan, PublicBillingPrice } from '@/lib/billing-price-types';

export const FOUNDING_OFFER_EXPIRES_AT = '2026-11-01T03:59:59.000Z';
export const FOUNDING_OFFER_END_LABEL = 'October 31, 2026';
export const FOUNDING_OFFER_MAX_REDEMPTIONS_PER_PLAN = 100;

export const FOUNDING_OFFERS: Record<BillingPlan, {
  code: string;
  discountPercent: number;
  customerPlanName: string;
}> = {
  pro: {
    code: 'FOUNDING20',
    discountPercent: 20,
    customerPlanName: 'Standard',
  },
  studio: {
    code: 'FOUNDING25',
    discountPercent: 25,
    customerPlanName: 'Max',
  },
};

function formatMoney(unitAmount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: unitAmount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(unitAmount / 100);
}

function intervalLabel(interval: BillingInterval) {
  return interval === 'year' ? 'yr' : 'mo';
}

export function isFoundingOfferActive(now = Date.now()) {
  return now <= Date.parse(FOUNDING_OFFER_EXPIRES_AT);
}

export function foundingOfferForPrice(
  plan: BillingPlan,
  price: Pick<PublicBillingPrice, 'unitAmount' | 'currency' | 'interval' | 'active' | 'sourceStatus'>,
  now = Date.now(),
) {
  const offer = FOUNDING_OFFERS[plan];
  if (
    !isFoundingOfferActive(now)
    || price.sourceStatus !== 'verified'
    || !price.active
    || price.unitAmount == null
    || price.unitAmount <= 0
  ) {
    return null;
  }
  const unitAmount = Math.round(price.unitAmount * (100 - offer.discountPercent) / 100);
  return {
    ...offer,
    unitAmount,
    display: `${formatMoney(unitAmount, price.currency)}/${intervalLabel(price.interval)}`,
    effectiveMonthlyDisplay: price.interval === 'year'
      ? `${formatMoney(Math.round(unitAmount / 12), price.currency)}/mo effective`
      : `${formatMoney(unitAmount, price.currency)}/mo`,
    expiresAt: FOUNDING_OFFER_EXPIRES_AT,
    endLabel: FOUNDING_OFFER_END_LABEL,
    maxRedemptions: FOUNDING_OFFER_MAX_REDEMPTIONS_PER_PLAN,
  };
}

