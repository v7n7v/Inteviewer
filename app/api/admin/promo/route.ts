import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireAdminMutation } from '@/lib/admin-auth';
import { readBoundedJson } from '@/lib/admin/bounded-json';
import { getAdminDb } from '@/lib/firebase-admin';
import { getBillingPrices } from '@/lib/billing-prices';
import { buildAdminPlanEconomics } from '@/lib/assistant/admin-plan-economics';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  active: z.boolean(),
  headline: z.string().trim().min(3).max(180),
  code: z.string().trim().min(2).max(60),
  ctaText: z.string().trim().min(2).max(80),
  evidenceFingerprint: z.string().trim().min(16).max(160),
  reason: z.string().trim().min(10).max(500),
  confirmationText: z.literal('APPLY PROMOTION PRESENTATION'),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
  expectedVersion: z.number().int().min(1),
}).strict();

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'settings.read');
  if (guard.error) return guard.error;
  try {
    const snapshot = await getAdminDb().doc('settings/promo').get();
    const data = snapshot.data() || {};
    return NextResponse.json(
      {
        active: data.active === true,
        headline: typeof data.headline === 'string' ? data.headline : '',
        code: typeof data.code === 'string' ? data.code : '',
        ctaText: typeof data.ctaText === 'string' ? data.ctaText : '',
        version: Number.isInteger(data.version) ? data.version : 1,
        evidenceFingerprint: typeof data.evidenceFingerprint === 'string' ? data.evidenceFingerprint : null,
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error('[admin/promo] read failed', error);
    return NextResponse.json(
      { error: 'Promotion settings are temporarily unavailable.', code: 'ADMIN_PROMOTION_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdminMutation(request, 'settings.manage');
  if (guard.error) return guard.error;
  const body = await readBoundedJson(request, 4_096);
  const parsed = updateSchema.safeParse(body.ok ? body.value : null);
  if (
    !parsed.success
    || process.env.ADMIN_MUTATIONS_V2_ENABLED !== 'true'
    || process.env.ADMIN_MFA_ENFORCED !== 'true'
    || !guard.actor.mfaSatisfied
  ) {
    return NextResponse.json(
      { error: 'Promotion changes require verified evidence, MFA, and exact confirmation.', code: 'ADMIN_PROMOTION_MUTATION_DISABLED' },
      { status: 409, headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization' } },
    );
  }
  const db = getAdminDb();
  const claimRef = db.collection('admin_mutation_claims').doc(`promotion_${parsed.data.idempotencyKey}`);
  const requestFingerprint = createHash('sha256').update(JSON.stringify({
    active: parsed.data.active,
    headline: parsed.data.headline,
    code: parsed.data.code,
    ctaText: parsed.data.ctaText,
    evidenceFingerprint: parsed.data.evidenceFingerprint,
    reason: parsed.data.reason,
    expectedVersion: parsed.data.expectedVersion,
  })).digest('hex');
  try {
    const prices = await getBillingPrices({ force: true, skipCommercialReadiness: true });
    const economics = await buildAdminPlanEconomics(prices);
    if (
      !economics.pricingOptionsMemo.readyForHumanReview
      || economics.pricingOptionsMemo.evidenceFingerprint !== parsed.data.evidenceFingerprint
    ) {
      return NextResponse.json(
        {
          error: 'Promotion evidence changed or is blocked. Review the latest verified economics before applying.',
          code: 'ADMIN_PROMOTION_EVIDENCE_STALE',
        },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }
    const now = new Date().toISOString();
    const result = await db.runTransaction(async transaction => {
      const promoRef = db.doc('settings/promo');
      const [claim, currentSnapshot] = await Promise.all([
        transaction.get(claimRef),
        transaction.get(promoRef),
      ]);
      if (claim.exists) {
        const value = claim.data() || {};
        if (
          value.actorUid !== guard.actor.uid
          || value.requestFingerprint !== requestFingerprint
          || value.status !== 'complete'
          || !value.result
        ) throw new Error('CLAIM_CONFLICT');
        return { promotion: value.result, duplicate: true };
      }
      const currentVersion = Number.isInteger(currentSnapshot.data()?.version)
        ? currentSnapshot.data()!.version
        : 1;
      if (currentVersion !== parsed.data.expectedVersion) throw new Error('STALE_VERSION');
      const promotion = {
        active: parsed.data.active,
        headline: parsed.data.headline,
        code: parsed.data.code,
        ctaText: parsed.data.ctaText,
        evidenceFingerprint: parsed.data.evidenceFingerprint,
        version: currentVersion + 1,
        updatedAt: now,
        updatedBy: guard.actor.email,
      };
      transaction.set(promoRef, promotion);
      transaction.create(claimRef, {
        kind: 'promotion_presentation_change',
        status: 'complete',
        actorUid: guard.actor.uid,
        requestFingerprint,
        createdAt: now,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
        result: promotion,
      });
      transaction.set(db.collection('admin_audit_log').doc(), {
        action: 'settings.promotion.updated',
        actorUid: guard.actor.uid,
        actorEmail: guard.actor.email,
        actorRole: guard.actor.role,
        occurredAt: now,
        metadata: {
          reason: parsed.data.reason,
          idempotencyKey: parsed.data.idempotencyKey,
          evidenceFingerprint: parsed.data.evidenceFingerprint,
          active: parsed.data.active,
        },
      });
      return { promotion, duplicate: false };
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization' } });
  } catch (error) {
    const stale = error instanceof Error && (
      error.message === 'STALE_VERSION'
      || error.message === 'CLAIM_CONFLICT'
    );
    if (!stale) console.error('[admin/promo] update failed', error);
    return NextResponse.json(
      {
        error: stale
          ? 'Promotion settings changed since this view loaded. Refresh before applying.'
          : 'Promotion presentation could not be updated.',
        code: stale ? 'ADMIN_PROMOTION_STALE' : 'ADMIN_PROMOTION_UPDATE_UNAVAILABLE',
      },
      { status: stale ? 409 : 503, headers: PRIVATE_HEADERS },
    );
  }
}
