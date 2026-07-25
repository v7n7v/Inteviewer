import { NextRequest } from 'next/server';
import { requireAdmin, requireAdminMutation } from '@/lib/admin-auth';
import { readBoundedJson } from '@/lib/admin/bounded-json';
import { adminJson } from '@/lib/admin/http';
import { getBillingPrices } from '@/lib/billing-prices';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimitStrict } from '@/lib/rate-limit';
import { buildAdminPlanEconomics } from '@/lib/assistant/admin-plan-economics';
import {
  buildSonaPricingOptionsDecision,
  compareSonaPricingOptionsDecisionReplay,
  parseSonaPricingOptionsDecisionInput,
  publicSonaPricingOptionsDecision,
} from '@/lib/assistant/pricing-options-decision';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};

async function freshPricingReview() {
  const prices = await getBillingPrices({ force: true, skipCommercialReadiness: true });
  const economics = await buildAdminPlanEconomics(prices);
  return economics.pricingOptionsMemo;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'billing.read');
  if (guard.error) return guard.error;
  if (new URL(request.url).searchParams.get('activate') !== '1') {
    return adminJson(
      {
        error: 'Pricing evidence is loaded only after an explicit operator request.',
        code: 'PRICING_REVIEW_ACTIVATION_REQUIRED',
      },
      { status: 409, headers: PRIVATE_HEADERS },
    );
  }

  const limit = await checkRateLimitStrict(`admin-pricing-review:${guard.actor.uid}`, 4, 60_000);
  if (limit.unavailable && process.env.NODE_ENV === 'production') {
    return adminJson(
      { error: 'Pricing evidence is temporarily unavailable.', code: 'PRICING_REVIEW_RATE_LIMIT_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
  if (!limit.unavailable && !limit.allowed) {
    return adminJson(
      { error: 'Pricing evidence was loaded recently. Wait a moment before refreshing.', code: 'PRICING_REVIEW_RATE_LIMITED' },
      { status: 429, headers: PRIVATE_HEADERS },
    );
  }

  try {
    const memo = await freshPricingReview();
    const snapshot = await getAdminDb()
      .collection('admin_pricing_options_decisions')
      .doc(memo.evidenceFingerprint)
      .get();
    return adminJson(
      {
        memo,
        decision: publicSonaPricingOptionsDecision(
          snapshot.exists ? snapshot.data() as Record<string, unknown> : null,
        ),
        mutationAuthority: {
          stripe: false,
          price: false,
          promotion: false,
          entitlement: false,
        },
        meta: {
          requestId: crypto.randomUUID(),
          generatedAt: memo.generatedAt,
          staleAfterMs: 300_000,
          partial: false,
          truncated: false,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error('[admin/billing/pricing-options-decision] evidence read failed', error);
    return adminJson(
      {
        error: 'The current pricing evidence could not be verified.',
        code: 'PRICING_DECISION_EVIDENCE_UNAVAILABLE',
      },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminMutation(request, 'billing.manage');
  if (guard.error) return guard.error;

  const body = await readBoundedJson(request, 4_096);
  const input = parseSonaPricingOptionsDecisionInput(body.ok ? body.value : null);
  if (!input) {
    return adminJson(
      {
        error: 'Review the current evidence, complete every no-mutation attestation, and enter the exact confirmation phrase.',
        code: 'PRICING_DECISION_INPUT_INVALID',
      },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  try {
    // A decision is valid only against provider-backed evidence recomputed in this request.
    const memo = await freshPricingReview();
    const decision = buildSonaPricingOptionsDecision(input, memo, guard.actor.email);
    if (!decision.ok) {
      return adminJson(
        { error: decision.error, code: decision.code },
        { status: decision.status, headers: PRIVATE_HEADERS },
      );
    }

    const db = getAdminDb();
    const ref = db
      .collection('admin_pricing_options_decisions')
      .doc(input.evidenceFingerprint);
    const result = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) {
        const replay = compareSonaPricingOptionsDecisionReplay(
          snapshot.data() as Record<string, unknown>,
          input,
          guard.actor.email,
        );
        if (!replay.ok) {
          return { conflict: replay, record: null, alreadyRecorded: false };
        }
        return { conflict: null, record: replay.record, alreadyRecorded: true };
      }

      transaction.create(ref, decision.record);
      transaction.create(db.collection('admin_audit_log').doc(), {
        action: 'billing.pricing_options.review_recorded',
        actorUid: guard.actor.uid,
        actorEmail: guard.actor.email,
        actorRole: guard.actor.role,
        occurredAt: decision.record.at,
        metadata: {
          evidenceFingerprint: decision.record.evidenceFingerprint,
          selectedScenarioId: decision.record.selectedScenarioId,
          priceChangeAuthorized: false,
          promotionChangeAuthorized: false,
          entitlementChangeAuthorized: false,
        },
      });
      return { conflict: null, record: decision.record, alreadyRecorded: false };
    });

    if (result.conflict) {
      return adminJson(
        { error: result.conflict.error, code: result.conflict.code },
        { status: result.conflict.status, headers: PRIVATE_HEADERS },
      );
    }
    return adminJson(
      {
        decision: publicSonaPricingOptionsDecision(result.record || null),
        alreadyRecorded: result.alreadyRecorded,
        mutationAuthority: {
          stripe: false,
          price: false,
          promotion: false,
          entitlement: false,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error('[admin/billing/pricing-options-decision] failed', error);
    return adminJson(
      {
        error: 'The current pricing evidence could not be verified. No decision was recorded.',
        code: 'PRICING_DECISION_EVIDENCE_UNAVAILABLE',
      },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
