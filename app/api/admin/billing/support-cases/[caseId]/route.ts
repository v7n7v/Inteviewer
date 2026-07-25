import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminMutation } from '@/lib/admin-auth';
import { readBoundedJson } from '@/lib/admin/bounded-json';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  normalizeStripeAccountReviewStatus,
  validateStripeAccountReviewTransition,
} from '@/lib/billing/stripe-account-review-case';
import { STRIPE_ACCOUNT_REVIEW_ISSUE_CODE } from '@/lib/billing/stripe-account-review-support';
import { adminMutationRetentionDate } from '@/lib/admin/mutation-claims';

export const dynamic = 'force-dynamic';

const SAFE_CASE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};

const transitionSchema = z.object({
  status: z.enum(['reviewing', 'resolved']),
  note: z.string().trim().min(5).max(1_000),
  accountHistoryReviewed: z.boolean().optional(),
  checkoutSafetyReviewed: z.boolean().optional(),
  confirmationText: z.string().max(120).optional(),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const guard = await requireAdminMutation(request, 'support.manage');
  if (guard.error) return guard.error;

  const { caseId } = await context.params;
  if (!SAFE_CASE_ID.test(caseId)) {
    return NextResponse.json(
      { error: 'Invalid billing support case.', code: 'BILLING_SUPPORT_CASE_INVALID' },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const body = await readBoundedJson(request, 8_192);
  const parsed = transitionSchema.safeParse(body.ok ? body.value : null);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid billing support transition.', code: 'BILLING_SUPPORT_TRANSITION_INVALID' },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const db = getAdminDb();
  const caseRef = db.collection('admin_feedback').doc(caseId);
  const claimRef = db.collection('admin_mutation_claims').doc(`support_${caseId}_${parsed.data.idempotencyKey}`);
  const now = new Date().toISOString();
  const requestFingerprint = createHash('sha256').update(JSON.stringify({
    caseId,
    status: parsed.data.status,
    note: parsed.data.note,
    accountHistoryReviewed: parsed.data.accountHistoryReviewed === true,
    checkoutSafetyReviewed: parsed.data.checkoutSafetyReviewed === true,
    confirmationText: parsed.data.confirmationText || null,
  })).digest('hex');

  try {
    const result = await db.runTransaction(async transaction => {
      const [snapshot, claimSnapshot] = await Promise.all([
        transaction.get(caseRef),
        transaction.get(claimRef),
      ]);
      if (claimSnapshot.exists) {
        const claim = claimSnapshot.data() || {};
        if (
          claim.actorUid !== guard.actor.uid
          || claim.caseId !== caseId
          || claim.requestFingerprint !== requestFingerprint
        ) throw new Error('CLAIM_CONFLICT');
        if (claim.status !== 'complete' || !claim.result) throw new Error('CLAIM_CONFLICT');
        return claim.result as {
          caseId: string;
          status: 'reviewing' | 'resolved';
          updatedAt: string;
          resolvedAt: string | null;
        };
      }
      if (!snapshot.exists) throw new Error('CASE_NOT_FOUND');
      const data = snapshot.data() || {};
      if (data.issueCode !== STRIPE_ACCOUNT_REVIEW_ISSUE_CODE) throw new Error('CASE_NOT_FOUND');

      const transition = validateStripeAccountReviewTransition({
        currentStatus: data.status,
        nextStatus: parsed.data.status,
        note: parsed.data.note,
        accountHistoryReviewed: parsed.data.accountHistoryReviewed,
        checkoutSafetyReviewed: parsed.data.checkoutSafetyReviewed,
        confirmationText: parsed.data.confirmationText,
        checkoutAccountEvidence: data.checkoutAccountEvidence,
      });
      if (!transition.valid) throw new Error(`TRANSITION:${transition.error}`);

      const receiptRef = typeof data.uid === 'string'
        ? db.collection('users').doc(data.uid).collection('billingSupport').doc('current')
        : null;
      const receiptSnapshot = receiptRef ? await transaction.get(receiptRef) : null;
      const receiptBelongsToCase = receiptSnapshot
        ? receiptSnapshot.data()?.caseId === caseId
        : true;
      if (receiptRef && receiptSnapshot?.exists && !receiptBelongsToCase) {
        throw new Error('RECEIPT_CONFLICT');
      }

      const historyEntry = {
        at: now,
        by: guard.actor.email,
        actorUid: guard.actor.uid,
        action: transition.nextStatus === 'reviewing' ? 'review_started' : 'review_resolved',
        note: transition.note,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60_000),
      };
      const boundedHistory = Array.isArray(data.history)
        ? data.history.slice(-49)
        : [];
      const update = {
        status: transition.nextStatus,
        operatorNote: transition.note,
        reviewedBy: guard.actor.email,
        reviewedAt: transition.nextStatus === 'reviewing' ? now : (data.reviewedAt || now),
        updatedAt: now,
        ...(transition.nextStatus === 'resolved'
          ? {
              resolvedAt: now,
              resolutionNote: transition.note,
              accountHistoryReviewed: true,
              checkoutSafetyReviewed: true,
            }
          : {}),
        history: [...boundedHistory, historyEntry],
      };
      transaction.update(caseRef, update);
      transaction.create(caseRef.collection('history').doc(), historyEntry);

      if (receiptRef) {
        transaction.set(receiptRef, {
          caseId,
          issueCode: STRIPE_ACCOUNT_REVIEW_ISSUE_CODE,
          status: transition.nextStatus,
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : now,
          updatedAt: now,
          resolvedAt: transition.nextStatus === 'resolved' ? now : null,
          expiresAt: data.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60_000),
        });
      }

      const adminAuditRef = db.collection('admin_audit_log').doc();
      transaction.set(adminAuditRef, {
        action: `billing.support_case.${transition.nextStatus}`,
        actorUid: guard.actor.uid,
        actorEmail: guard.actor.email,
        actorRole: guard.actor.role,
        targetUid: typeof data.uid === 'string' ? data.uid : null,
        targetCaseId: caseId,
        occurredAt: now,
        metadata: {
          previousStatus: normalizeStripeAccountReviewStatus(data.status),
          nextStatus: transition.nextStatus,
          idempotencyKey: parsed.data.idempotencyKey,
        },
      });

      const billingAuditChanges = {
        caseId,
        previousStatus: normalizeStripeAccountReviewStatus(data.status),
        nextStatus: transition.nextStatus,
        targetUid: typeof data.uid === 'string' ? data.uid : null,
      };
      const billingAuditRef = db
        .collection('settings')
        .doc('admin_log')
        .collection('entries')
        .doc();
      transaction.set(billingAuditRef, {
        action: 'billing_support_case_transition',
        changes: billingAuditChanges,
        by: guard.actor.email,
        at: now,
      });
      const resultRecord = {
        caseId,
        status: transition.nextStatus,
        updatedAt: now,
        resolvedAt: transition.nextStatus === 'resolved' ? now : null,
      };
      transaction.create(claimRef, {
        kind: 'billing_support_case_transition',
        actorUid: guard.actor.uid,
        caseId,
        requestFingerprint,
        status: 'complete',
        createdAt: now,
        completedAt: now,
        expiresAt: adminMutationRetentionDate(),
        result: resultRecord,
      });
      return resultRecord;
    });

    return NextResponse.json({ case: result }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'CASE_NOT_FOUND'
      ? 404
      : message.startsWith('TRANSITION:')
        || message === 'RECEIPT_CONFLICT'
        || message === 'CLAIM_CONFLICT'
        ? 409
        : 503;
    const safeMessage = message.startsWith('TRANSITION:')
      ? message.slice('TRANSITION:'.length)
      : status === 404
        ? 'Billing support case not found.'
        : status === 409
          ? 'The billing support case changed. Refresh and try again.'
          : 'The billing support case could not be updated.';
    if (status === 503) console.error('[admin/billing/support-cases] transition failed', error);
    return NextResponse.json(
      { error: safeMessage, code: status === 503 ? 'BILLING_SUPPORT_UPDATE_UNAVAILABLE' : 'BILLING_SUPPORT_UPDATE_REJECTED' },
      { status, headers: PRIVATE_HEADERS },
    );
  }
}
