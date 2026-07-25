const Stripe = require('stripe');

const EXPECTED_ACCOUNT_ID = 'acct_1SCsqyRzCQJUfMDH';
const PRICING_GENERATION = 'founding_2026_07';
const FOUNDING_EXPIRES_AT = Math.floor(Date.parse('2026-11-01T03:59:59Z') / 1_000);

const CATALOGUE = {
  pro: {
    productName: 'Talent Standard',
    productDescription: 'Hands-on career tools for an active job search.',
    prices: {
      month: {
        unitAmount: 999,
        lookupKey: 'talent_standard_monthly_2026',
        nickname: 'Talent Standard monthly',
      },
      year: {
        unitAmount: 9_999,
        lookupKey: 'talent_standard_yearly_2026',
        nickname: 'Talent Standard annual',
      },
    },
    coupon: {
      id: 'talent_standard_founding20_2026',
      code: 'FOUNDING20',
      percentOff: 20,
      name: 'Standard founding member — 20% off',
    },
  },
  studio: {
    productName: 'Talent Max',
    productDescription: 'Taco-led scouting and review-ready application preparation.',
    prices: {
      month: {
        unitAmount: 1_999,
        lookupKey: 'talent_max_monthly_2026',
        nickname: 'Talent Max monthly',
      },
      year: {
        unitAmount: 23_988,
        lookupKey: 'talent_max_yearly_2026_v2',
        nickname: 'Talent Max annual',
      },
    },
    coupon: {
      id: 'talent_max_founding25_2026',
      code: 'FOUNDING25',
      percentOff: 25,
      name: 'Max founding member — 25% off',
    },
  },
};

const LEGACY_PROMOTION_CODES = new Set(['LAUNCH50', 'FRIENDS50']);
const LEGACY_PRICE_ENV_NAMES = [
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_PRO_ANNUAL_PRICE_ID',
  'STRIPE_STUDIO_PRICE_ID',
  'STRIPE_STUDIO_ANNUAL_PRICE_ID',
];
const LEGACY_PRICE_IDS = new Set([
  'price_1TLUDXRzCQJUfMDHtjTmbzxI',
  'price_1TLUEdRzCQJUfMDHEPEpip7f',
  'price_1TLpBiRzCQJUfMDHUIL1Nk0F',
  'price_1TLpEdRzCQJUfMDHxptFqG20',
  'price_1TwracRzCQJUfMDHiehaFEus',
]);

function hasArgument(name) {
  return process.argv.includes(name);
}

function stripeMode(secretKey) {
  if (secretKey.startsWith('sk_live_')) return 'live';
  if (secretKey.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

async function allPages(listPage) {
  const items = [];
  let startingAfter;
  do {
    const page = await listPage(startingAfter);
    items.push(...page.data);
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);
  return items;
}

async function findOrCreateProduct(stripe, plan, config) {
  const products = await allPages(startingAfter => stripe.products.list({
    active: true,
    limit: 100,
    starting_after: startingAfter,
  }));
  const existing = products.find(product =>
    product.metadata?.talent_pricing_generation === PRICING_GENERATION
    && product.metadata?.talent_internal_plan === plan,
  );
  if (existing) {
    if (existing.name !== config.productName) {
      throw new Error(`Existing ${plan} product name does not match the reviewed catalogue`);
    }
    return existing;
  }
  return stripe.products.create({
    name: config.productName,
    description: config.productDescription,
    metadata: {
      talent_internal_plan: plan,
      talent_pricing_generation: PRICING_GENERATION,
    },
  }, {
    idempotencyKey: `talent-${PRICING_GENERATION}-${plan}-product`,
  });
}

async function findOrCreatePrice(stripe, plan, product, interval, config) {
  const existing = (await stripe.prices.list({
    lookup_keys: [config.lookupKey],
    limit: 10,
  })).data[0];
  if (existing) {
    const productId = typeof existing.product === 'string' ? existing.product : existing.product.id;
    if (
      productId !== product.id
      || existing.unit_amount !== config.unitAmount
      || existing.currency !== 'usd'
      || existing.recurring?.interval !== interval
    ) {
      throw new Error(`Existing ${config.lookupKey} price does not match the reviewed catalogue`);
    }
    if (!existing.active) {
      return stripe.prices.update(existing.id, { active: true });
    }
    return existing;
  }
  return stripe.prices.create({
    active: true,
    currency: 'usd',
    unit_amount: config.unitAmount,
    product: product.id,
    recurring: { interval },
    lookup_key: config.lookupKey,
    nickname: config.nickname,
    metadata: {
      talent_internal_plan: plan,
      talent_pricing_generation: PRICING_GENERATION,
      talent_billing_interval: interval,
    },
  }, {
    idempotencyKey: `talent-${PRICING_GENERATION}-${config.lookupKey}-price`,
  });
}

async function findOrCreateCoupon(stripe, plan, product, config) {
  let existing = null;
  try {
    existing = await stripe.coupons.retrieve(config.id);
  } catch (error) {
    if (error?.code !== 'resource_missing') throw error;
  }
  if (existing && !existing.deleted) {
    if (
      existing.percent_off !== config.percentOff
      || existing.duration !== 'forever'
      || existing.redeem_by !== FOUNDING_EXPIRES_AT
    ) {
      throw new Error(`Existing ${config.id} coupon does not match the reviewed founding offer`);
    }
    if (
      existing.metadata?.talent_internal_plan !== plan
      || existing.metadata?.talent_product_id !== product.id
    ) {
      return stripe.coupons.update(existing.id, {
        metadata: {
          talent_internal_plan: plan,
          talent_product_id: product.id,
          talent_pricing_generation: PRICING_GENERATION,
          talent_offer: 'founding_member',
        },
      });
    }
    return existing;
  }
  return stripe.coupons.create({
    id: config.id,
    name: config.name,
    percent_off: config.percentOff,
    duration: 'forever',
    redeem_by: FOUNDING_EXPIRES_AT,
    applies_to: { products: [product.id] },
    metadata: {
      talent_internal_plan: plan,
      talent_product_id: product.id,
      talent_pricing_generation: PRICING_GENERATION,
      talent_offer: 'founding_member',
    },
  }, {
    idempotencyKey: `talent-${PRICING_GENERATION}-${config.id}`,
  });
}

async function findOrCreatePromotionCode(stripe, plan, coupon, config) {
  const existing = (await stripe.promotionCodes.list({
    code: config.code,
    limit: 100,
  })).data.find(code =>
    code.promotion?.type === 'coupon'
    && (typeof code.promotion.coupon === 'string'
      ? code.promotion.coupon
      : code.promotion.coupon?.id) === coupon.id,
  );
  if (existing) {
    if (
      existing.expires_at !== FOUNDING_EXPIRES_AT
      || existing.max_redemptions !== 100
      || existing.restrictions.first_time_transaction !== true
    ) {
      throw new Error(`Existing ${config.code} promotion code does not match the reviewed founding offer`);
    }
    if (!existing.active) {
      return stripe.promotionCodes.update(existing.id, { active: true });
    }
    return existing;
  }
  return stripe.promotionCodes.create({
    active: true,
    code: config.code,
    promotion: { type: 'coupon', coupon: coupon.id },
    expires_at: FOUNDING_EXPIRES_AT,
    max_redemptions: 100,
    restrictions: { first_time_transaction: true },
    metadata: {
      talent_internal_plan: plan,
      talent_pricing_generation: PRICING_GENERATION,
      talent_offer: 'founding_member',
    },
  }, {
    idempotencyKey: `talent-${PRICING_GENERATION}-${plan}-promotion-code`,
  });
}

async function provisionCatalogue(stripe) {
  const result = {};
  for (const [plan, config] of Object.entries(CATALOGUE)) {
    const product = await findOrCreateProduct(stripe, plan, config);
    const month = await findOrCreatePrice(stripe, plan, product, 'month', config.prices.month);
    const year = await findOrCreatePrice(stripe, plan, product, 'year', config.prices.year);
    const coupon = await findOrCreateCoupon(stripe, plan, product, config.coupon);
    const promotionCode = await findOrCreatePromotionCode(stripe, plan, coupon, config.coupon);
    result[plan] = {
      productId: product.id,
      monthlyPriceId: month.id,
      annualPriceId: year.id,
      couponId: coupon.id,
      promotionCodeId: promotionCode.id,
      promotionCode: promotionCode.code,
    };
  }
  return result;
}

async function finalizeLegacyCatalogue(stripe, provisioned) {
  const currentPriceIds = new Set(Object.values(provisioned).flatMap(plan => [
    plan.monthlyPriceId,
    plan.annualPriceId,
  ]));
  const currentProductIds = new Set(Object.values(provisioned).map(plan => plan.productId));
  const deactivatedPriceIds = [];
  const deactivatedProductIds = [];
  const retainedDefaultPriceIds = [];
  const productCache = new Map();
  const possibleLegacyPriceIds = new Set([
    ...LEGACY_PRICE_IDS,
    ...LEGACY_PRICE_ENV_NAMES.map(envName => process.env[envName]).filter(Boolean),
  ]);
  for (const priceId of possibleLegacyPriceIds) {
    if (!priceId || currentPriceIds.has(priceId)) continue;
    const price = await stripe.prices.retrieve(priceId);
    const productId = typeof price.product === 'string' ? price.product : price.product.id;
    let product = productCache.get(productId);
    if (!product) {
      product = await stripe.products.retrieve(productId);
      productCache.set(productId, product);
    }
    const defaultPriceId = typeof product.default_price === 'string'
      ? product.default_price
      : product.default_price?.id;
    if (defaultPriceId === price.id) {
      if (!currentProductIds.has(productId) && product.active) {
        product = await stripe.products.update(productId, { active: false });
        productCache.set(productId, product);
        deactivatedProductIds.push(productId);
      }
      retainedDefaultPriceIds.push(price.id);
      continue;
    }
    if (price.active) {
      await stripe.prices.update(price.id, { active: false });
      deactivatedPriceIds.push(price.id);
    }
  }

  const promotionCodes = await allPages(startingAfter => stripe.promotionCodes.list({
    active: true,
    limit: 100,
    starting_after: startingAfter,
  }));
  const deactivatedPromotionCodeIds = [];
  for (const code of promotionCodes) {
    if (!LEGACY_PROMOTION_CODES.has(code.code.toUpperCase())) continue;
    await stripe.promotionCodes.update(code.id, { active: false });
    deactivatedPromotionCodeIds.push(code.id);
  }
  return {
    deactivatedPriceIds,
    deactivatedProductIds,
    retainedDefaultPriceIds,
    deactivatedPromotionCodeIds,
  };
}

async function main() {
  if (!hasArgument('--execute')) {
    throw new Error('Refusing live writes without --execute');
  }
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  if (stripeMode(secretKey) !== 'live') {
    throw new Error('This operator only accepts a live Stripe secret key');
  }
  const stripe = new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
    maxNetworkRetries: 2,
    timeout: 20_000,
  });
  const account = await stripe.accounts.retrieve();
  if (account.id !== EXPECTED_ACCOUNT_ID) {
    throw new Error(`Connected Stripe account ${account.id} does not match ${EXPECTED_ACCOUNT_ID}`);
  }

  const provisioned = await provisionCatalogue(stripe);
  const finalized = hasArgument('--finalize')
    ? await finalizeLegacyCatalogue(stripe, provisioned)
    : {
        deactivatedPriceIds: [],
        deactivatedProductIds: [],
        retainedDefaultPriceIds: [],
        deactivatedPromotionCodeIds: [],
      };
  console.log(JSON.stringify({
    mode: 'live',
    accountId: account.id,
    expiresAt: new Date(FOUNDING_EXPIRES_AT * 1_000).toISOString(),
    provisioned,
    finalized,
  }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  CATALOGUE,
  EXPECTED_ACCOUNT_ID,
  FOUNDING_EXPIRES_AT,
  PRICING_GENERATION,
  stripeMode,
};
