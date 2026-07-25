import type Stripe from 'stripe';
import type { BillingPlan } from '@/lib/billing-price-types';
import {
  FOUNDING_OFFERS,
  FOUNDING_OFFER_EXPIRES_AT,
} from '@/lib/billing/founding-offer';

const PROMOTION_CODE_ENV: Record<BillingPlan, string> = {
  pro: 'STRIPE_PRO_PROMOTION_CODE_ID',
  studio: 'STRIPE_STUDIO_PROMOTION_CODE_ID',
};

export class StripeFoundingOfferVerificationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StripeFoundingOfferVerificationError';
  }
}

export async function resolveStripeFoundingPromotionCode(
  stripe: Stripe,
  input: {
    plan: BillingPlan;
    selectedPrice: Stripe.Price;
    hasPriorSubscriptionHistory: boolean;
    now?: number;
  },
) {
  if (input.hasPriorSubscriptionHistory) return null;
  const now = input.now ?? Date.now();
  if (now > Date.parse(FOUNDING_OFFER_EXPIRES_AT)) return null;

  const promotionCodeId = process.env[PROMOTION_CODE_ENV[input.plan]]?.trim();
  if (!promotionCodeId) return null;

  let promotionCode: Stripe.PromotionCode;
  try {
    promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId, {
      expand: ['promotion.coupon'],
    });
  } catch (error) {
    throw new StripeFoundingOfferVerificationError(
      'Stripe could not verify the founding offer.',
      { cause: error },
    );
  }

  if (
    !promotionCode.active
    || (promotionCode.expires_at != null && promotionCode.expires_at * 1_000 < now)
    || (
      promotionCode.max_redemptions != null
      && promotionCode.times_redeemed >= promotionCode.max_redemptions
    )
  ) {
    return null;
  }
  if (
    promotionCode.code.toUpperCase() !== FOUNDING_OFFERS[input.plan].code
    || promotionCode.restrictions.first_time_transaction !== true
    || promotionCode.promotion?.type !== 'coupon'
  ) {
    throw new StripeFoundingOfferVerificationError(
      'The founding offer no longer matches the reviewed promotion policy.',
    );
  }

  const coupon = promotionCode.promotion.coupon;
  if (!coupon || typeof coupon === 'string' || coupon.deleted) {
    throw new StripeFoundingOfferVerificationError(
      'The founding offer coupon could not be verified.',
    );
  }
  const selectedProductId = typeof input.selectedPrice.product === 'string'
    ? input.selectedPrice.product
    : input.selectedPrice.product.id;
  if (
    coupon.percent_off !== FOUNDING_OFFERS[input.plan].discountPercent
    || coupon.duration !== 'forever'
    || coupon.metadata?.talent_internal_plan !== input.plan
    || coupon.metadata?.talent_product_id !== selectedProductId
  ) {
    throw new StripeFoundingOfferVerificationError(
      'The founding offer is not scoped to the selected plan.',
    );
  }

  return {
    id: promotionCode.id,
    code: promotionCode.code,
    discountPercent: coupon.percent_off,
  };
}
