import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { requireBillingAdmin } from '@/lib/admin-billing-auth';
import { readBoundedJson } from '@/lib/admin/bounded-json';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  billingAccountReference,
  billingAccountReferenceMatches,
} from '@/lib/admin/billing-account-reference';
import {
  BILLING_COLLECTIONS,
  listBillingAccounts,
  previewCustomerBillingEvidence,
  type BillingAccountRecord,
} from '@/lib/billing-ledger';
import {
  adminMutationClaimIsRunning,
  adminMutationLeaseFields,
  adminMutationRetentionDate,
  failAdminMutationClaim,
} from '@/lib/admin/mutation-claims';

export const dynamic = 'force-dynamic';

const SAFE_ACCOUNT_REF = /^[a-f0-9]{24}$/;
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};
const syncSchema = z.object({
  reason: z.string().trim().min(10).max(500),
  confirmationText: z.literal('SYNC BILLING EVIDENCE'),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

function requestFingerprint(accountRef: string, reason: string) {
  return createHash('sha256')
    .update(JSON.stringify({ accountRef, reason }))
    .digest('hex');
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> },
) {
  const guard = await requireBillingAdmin(request);
  if (guard.error) return guard.error;

  const { accountId: accountRef } = await context.params;
  const body = await readBoundedJson(request, 4_096);
  const parsed = syncSchema.safeParse(body.ok ? body.value : null);
  if (!SAFE_ACCOUNT_REF.test(accountRef) || !parsed.success) {
    return NextResponse.json(
      { error: 'Confirm the bounded evidence sync and provide an operator reason.', code: 'BILLING_SYNC_CONFIRMATION_REQUIRED' },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
  if (
    process.env.ADMIN_MUTATIONS_V2_ENABLED !== 'true'
    || process.env.ADMIN_MFA_ENFORCED !== 'true'
    || !guard.user.mfaSatisfied
  ) {
    return NextResponse.json(
      { error: 'Billing evidence capture requires the verified MFA rollout.', code: 'BILLING_SYNC_MFA_REQUIRED' },
      { status: 409, headers: PRIVATE_HEADERS },
    );
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Billing evidence sync is temporarily unavailable.', code: 'BILLING_SYNC_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }

  const db = getAdminDb();
  const claimRef = db.collection('admin_mutation_claims')
    .doc(`billing_sync_${parsed.data.idempotencyKey}`);
  const fingerprint = requestFingerprint(accountRef, parsed.data.reason);
  const executionId = randomUUID();
  try {
    const accounts = (await listBillingAccounts(20)) as BillingAccountRecord[];
    const storedAccount = accounts.find(account => billingAccountReferenceMatches(account.accountId, accountRef));
    if (!storedAccount) {
      return NextResponse.json(
        { error: 'Billing account reference is no longer in the bounded review window.', code: 'BILLING_ACCOUNT_NOT_FOUND' },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    }

    const reservation = await db.runTransaction(async transaction => {
      const claim = await transaction.get(claimRef);
      if (claim.exists) {
        const value = claim.data() || {};
        if (
          value.actorUid !== guard.user.uid
          || value.accountRef !== accountRef
          || value.requestFingerprint !== fingerprint
        ) return { conflict: true as const };
        if (value.status === 'complete' && value.result) {
          return { duplicate: true as const, result: value.result };
        }
        if (adminMutationClaimIsRunning(value)) return { running: true as const };
        transaction.update(claimRef, {
          ...adminMutationLeaseFields(
            executionId,
            Date.now(),
            Math.max(1, Number(value.attempts || 0) + 1),
          ),
          retriedAt: new Date().toISOString(),
        });
        return { ready: true as const };
      }
      const now = new Date().toISOString();
      transaction.create(claimRef, {
        kind: 'billing_evidence_capture',
        ...adminMutationLeaseFields(executionId),
        actorUid: guard.user.uid,
        accountRef,
        requestFingerprint: fingerprint,
        createdAt: now,
        expiresAt: adminMutationRetentionDate(),
      });
      transaction.create(db.collection('admin_audit_log').doc(), {
        action: 'billing.account.evidence_capture_requested',
        actorUid: guard.user.uid,
        actorEmail: guard.user.email,
        actorRole: guard.user.role,
        targetAccountRef: accountRef,
        occurredAt: now,
        metadata: {
          reason: parsed.data.reason,
          idempotencyKey: parsed.data.idempotencyKey,
          requestFingerprint: fingerprint,
          authoritativePlanMutation: false,
          entitlementMutation: false,
        },
      });
      return { ready: true as const };
    });
    if ('duplicate' in reservation) {
      return NextResponse.json(
        { account: reservation.result, duplicate: true },
        { headers: PRIVATE_HEADERS },
      );
    }
    if ('conflict' in reservation || 'running' in reservation) {
      return NextResponse.json(
        { error: 'This billing evidence request is already claimed.', code: 'BILLING_SYNC_DUPLICATE' },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
      maxNetworkRetries: 0,
      timeout: 7_000,
    });
    const preview = await previewCustomerBillingEvidence(stripe, storedAccount);
    const now = new Date().toISOString();
    const result = {
      accountRef,
      status: preview.status,
      billingEvidenceStatus: preview.evidenceStatus,
      billingEvidenceMissing: preview.missing,
      billingEvidenceCapturedAt: now,
      proposed: {
        ...(preview.proposed.plan ? { plan: preview.proposed.plan } : {}),
        ...(preview.proposed.billingInterval ? { billingInterval: preview.proposed.billingInterval } : {}),
        ...(typeof preview.proposed.recurringAmountCents === 'number'
          ? { recurringAmountCents: preview.proposed.recurringAmountCents }
          : {}),
        ...(preview.proposed.recurringCurrency
          ? { recurringCurrency: preview.proposed.recurringCurrency }
          : {}),
      },
      authoritativePlanMutation: false,
      entitlementMutation: false,
    };
    const receiptRef = db.collection('billing_reconciliation_evidence')
      .doc(`${accountRef}_${parsed.data.idempotencyKey}`);
    await db.runTransaction(async transaction => {
      const claim = await transaction.get(claimRef);
      const value = claim.data() || {};
      if (value.status === 'complete') return;
      if (
        value.status !== 'running'
        || value.executionId !== executionId
        || value.actorUid !== guard.user.uid
        || value.requestFingerprint !== fingerprint
      ) throw new Error('BILLING_SYNC_CLAIM_CHANGED');
      transaction.create(receiptRef, {
        ...result,
        createdBy: guard.user.uid,
        requestFingerprint: fingerprint,
        reason: parsed.data.reason,
      });
      transaction.create(db.collection('admin_audit_log').doc(), {
        action: 'billing.account.evidence_captured',
        actorUid: guard.user.uid,
        actorEmail: guard.user.email,
        actorRole: guard.user.role,
        targetAccountRef: accountRef,
        occurredAt: now,
        metadata: {
          reason: parsed.data.reason,
          idempotencyKey: parsed.data.idempotencyKey,
          evidenceStatus: preview.evidenceStatus,
          missingCount: preview.missing.length,
          authoritativePlanMutation: false,
          entitlementMutation: false,
        },
      });
      transaction.update(claimRef, {
        status: 'complete',
        completedAt: now,
        leaseUntil: null,
        result,
      });
    });
    await db.collection('admin').doc('cache_costs_v8').delete().catch(() => {});
    return NextResponse.json({ account: result, duplicate: false }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    await failAdminMutationClaim(
      db,
      claimRef,
      executionId,
      'BILLING_SYNC_UNAVAILABLE',
    ).catch(() => {});
    console.error('[admin/billing/accounts/sync] failed', error);
    return NextResponse.json(
      { error: 'Billing evidence sync is temporarily unavailable.', code: 'BILLING_SYNC_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
