import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { requireAdminMutation } from '@/lib/admin-auth';
import { readBoundedJson } from '@/lib/admin/bounded-json';
import { getAdminDb } from '@/lib/firebase-admin';
import { discoverStripeCheckoutCustomers } from '@/lib/billing/stripe-checkout-account-read';
import { buildStripeAccountReviewEvidence } from '@/lib/billing/stripe-account-review-case';
import { STRIPE_ACCOUNT_REVIEW_ISSUE_CODE } from '@/lib/billing/stripe-account-review-support';
import {
  adminMutationClaimIsRunning,
  adminMutationLeaseFields,
  adminMutationRetentionDate,
  failAdminMutationClaim,
} from '@/lib/admin/mutation-claims';

export const dynamic = 'force-dynamic';

const SAFE_CASE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};
const verifySchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const guard = await requireAdminMutation(request, 'support.manage');
  if (guard.error) return guard.error;

  const { caseId } = await context.params;
  const body = await readBoundedJson(request, 1_024);
  const parsed = verifySchema.safeParse(body.ok ? body.value : null);
  if (!SAFE_CASE_ID.test(caseId) || !parsed.success) {
    return NextResponse.json(
      { error: 'A valid support case and idempotency key are required.', code: 'BILLING_SUPPORT_CASE_INVALID' },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'Customer evidence is temporarily unavailable.', code: 'STRIPE_ACCOUNT_EVIDENCE_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }

  const db = getAdminDb();
  const caseRef = db.collection('admin_feedback').doc(caseId);
  const claimRef = db.collection('admin_mutation_claims')
    .doc(`support_verify_${caseId}_${parsed.data.idempotencyKey}`);
  const requestFingerprint = createHash('sha256')
    .update(JSON.stringify({ caseId, operation: 'verify_stripe_account_evidence' }))
    .digest('hex');
  const executionId = randomUUID();
  try {
    const reservation = await db.runTransaction(async transaction => {
      const [snapshot, claim] = await Promise.all([
        transaction.get(caseRef),
        transaction.get(claimRef),
      ]);
      const data = snapshot.data();
      if (
        !snapshot.exists
        || data?.issueCode !== STRIPE_ACCOUNT_REVIEW_ISSUE_CODE
        || typeof data.uid !== 'string'
        || typeof data.email !== 'string'
        || data.status === 'resolved'
      ) {
        return { unavailable: true as const };
      }
      if (claim.exists) {
        const existing = claim.data() || {};
        if (
          existing.actorUid !== guard.actor.uid
          || existing.caseId !== caseId
          || existing.requestFingerprint !== requestFingerprint
        ) {
          return { conflict: true as const };
        }
        if (existing.status === 'complete' && existing.result) {
          return { duplicate: true as const, result: existing.result };
        }
        if (adminMutationClaimIsRunning(existing)) return { running: true as const };
        transaction.update(claimRef, {
          ...adminMutationLeaseFields(
            executionId,
            Date.now(),
            Math.max(1, Number(existing.attempts || 0) + 1),
          ),
          retriedAt: new Date().toISOString(),
        });
        return { ready: true as const, uid: data.uid as string, email: data.email as string };
      }
      const now = new Date().toISOString();
      transaction.create(claimRef, {
        kind: 'billing_support_evidence_verification',
        ...adminMutationLeaseFields(executionId),
        caseId,
        actorUid: guard.actor.uid,
        requestFingerprint,
        createdAt: now,
        expiresAt: adminMutationRetentionDate(),
      });
      transaction.create(db.collection('admin_audit_log').doc(), {
        action: 'billing.support_case.evidence_verification_requested',
        actorUid: guard.actor.uid,
        actorEmail: guard.actor.email,
        actorRole: guard.actor.role,
        targetUid: data.uid,
        targetCaseId: caseId,
        occurredAt: now,
        metadata: { idempotencyKey: parsed.data.idempotencyKey },
      });
      return { ready: true as const, uid: data.uid as string, email: data.email as string };
    });

    if ('duplicate' in reservation) {
      return NextResponse.json(
        { evidence: reservation.result, duplicate: true },
        { headers: PRIVATE_HEADERS },
      );
    }
    if ('unavailable' in reservation) {
      return NextResponse.json(
        { error: 'Billing support case is not available for verification.', code: 'BILLING_SUPPORT_CASE_NOT_VERIFIABLE' },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }
    if ('conflict' in reservation || 'running' in reservation) {
      return NextResponse.json(
        { error: 'This evidence check is already claimed.', code: 'BILLING_SUPPORT_VERIFICATION_DUPLICATE' },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }

    const stripe = new Stripe(key, {
      apiVersion: '2026-02-25.clover',
      maxNetworkRetries: 0,
      timeout: 7_000,
    });
    const discovery = await discoverStripeCheckoutCustomers(stripe, {
      email: reservation.email,
      uid: reservation.uid,
    });
    const associatedIds = [
      ...discovery.emailCustomers.map(customer => customer.id),
      ...discovery.uidCustomers.map(customer => customer.id),
    ];
    const evidence = buildStripeAccountReviewEvidence({
      uidCustomerIds: associatedIds,
      needsNewCustomer: associatedIds.length === 0,
    });
    const now = new Date().toISOString();

    const completion = await db.runTransaction(async transaction => {
      const [current, claim] = await Promise.all([
        transaction.get(caseRef),
        transaction.get(claimRef),
      ]);
      const currentData = current.data();
      const claimData = claim.data() || {};
      if (claimData.status === 'complete' && claimData.result) {
        return { evidence: claimData.result, duplicate: true };
      }
      if (
        !current.exists
        || currentData?.issueCode !== STRIPE_ACCOUNT_REVIEW_ISSUE_CODE
        || currentData.status === 'resolved'
        || currentData.uid !== reservation.uid
        || currentData.email !== reservation.email
        || claimData.status !== 'running'
        || claimData.executionId !== executionId
        || claimData.actorUid !== guard.actor.uid
        || claimData.requestFingerprint !== requestFingerprint
      ) {
        throw new Error('CASE_CHANGED');
      }
      const historyEntry = {
        at: now,
        by: guard.actor.email,
        actorUid: guard.actor.uid,
        action: 'customer_evidence_verified',
        status: evidence.status,
        linkedCustomerCount: evidence.linkedCustomerCount,
        prospectiveCustomerCount: evidence.prospectiveCustomerCount,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60_000),
      };
      const boundedHistory = Array.isArray(currentData.history)
        ? currentData.history.slice(-49)
        : [];
      transaction.update(caseRef, {
        checkoutAccountEvidence: evidence,
        updatedAt: now,
        history: [...boundedHistory, historyEntry],
      });
      transaction.create(caseRef.collection('history').doc(), historyEntry);
      transaction.create(db.collection('admin_audit_log').doc(), {
        action: 'billing.support_case.evidence_verified',
        actorUid: guard.actor.uid,
        actorEmail: guard.actor.email,
        actorRole: guard.actor.role,
        targetUid: currentData.uid,
        targetCaseId: caseId,
        occurredAt: now,
        metadata: {
          evidenceStatus: evidence.status,
          linkedCustomerCount: evidence.linkedCustomerCount,
          prospectiveCustomerCount: evidence.prospectiveCustomerCount,
          idempotencyKey: parsed.data.idempotencyKey,
        },
      });
      transaction.update(claimRef, {
        status: 'complete',
        completedAt: now,
        leaseUntil: null,
        result: evidence,
      });
      return { evidence, duplicate: false };
    });

    return NextResponse.json(completion, { headers: PRIVATE_HEADERS });
  } catch (error) {
    await failAdminMutationClaim(
      db,
      claimRef,
      executionId,
      'STRIPE_ACCOUNT_EVIDENCE_UNAVAILABLE',
    ).catch(() => {});
    console.error('[admin/billing/support-cases] evidence verification failed', error);
    return NextResponse.json(
      { error: 'Customer evidence is temporarily unavailable.', code: 'STRIPE_ACCOUNT_EVIDENCE_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
