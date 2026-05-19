export type BillingPlan = 'pro' | 'studio';
export type BillingInterval = 'month' | 'year';

export interface PublicBillingPrice {
  unitAmount: number | null;
  currency: string;
  interval: BillingInterval;
  active: boolean;
  display: string;
  effectiveMonthlyDisplay: string;
  savingsLabel: string;
}

export interface PublicBillingPlanPrices {
  month: PublicBillingPrice;
  year: PublicBillingPrice;
}

export interface PublicBillingPrices {
  plans: Record<BillingPlan, PublicBillingPlanPrices>;
  updatedAt: string;
}

export const PRICE_UNAVAILABLE_LABEL = 'View price in checkout';

export function unavailableBillingPrice(interval: BillingInterval): PublicBillingPrice {
  return {
    unitAmount: null,
    currency: 'usd',
    interval,
    active: false,
    display: PRICE_UNAVAILABLE_LABEL,
    effectiveMonthlyDisplay: PRICE_UNAVAILABLE_LABEL,
    savingsLabel: '',
  };
}

export function unavailableBillingPrices(): PublicBillingPrices {
  return {
    plans: {
      pro: {
        month: unavailableBillingPrice('month'),
        year: unavailableBillingPrice('year'),
      },
      studio: {
        month: unavailableBillingPrice('month'),
        year: unavailableBillingPrice('year'),
      },
    },
    updatedAt: new Date(0).toISOString(),
  };
}
