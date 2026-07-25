import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { STRIPE_ACCOUNT_REVIEW_ISSUE_CODE } from '@/lib/billing/stripe-account-review-support';
import {
  isStripeAccountReviewStatus,
  normalizeStripeAccountReviewEvidence,
  normalizeStripeAccountReviewStatus,
} from '@/lib/billing/stripe-account-review-case';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};
const SAFE_CURSOR = /^[A-Za-z0-9_-]{1,128}$/;

function boundedLimit(value: string | null) {
  const parsed = Number(value || 75);
  return Math.min(Math.max(Number.isFinite(parsed) ? Math.floor(parsed) : 75, 1), 100);
}

function safeHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-25).map(item => {
    const entry = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      at: typeof entry.at === 'string' ? entry.at : null,
      by: typeof entry.by === 'string' ? entry.by : null,
      actorUid: typeof entry.actorUid === 'string' ? entry.actorUid : null,
      action: typeof entry.action === 'string' ? entry.action : 'evidence_recorded',
      status: typeof entry.status === 'string' ? entry.status : null,
      note: typeof entry.note === 'string' ? entry.note.slice(0, 1_000) : null,
      linkedCustomerCount: Number.isInteger(entry.linkedCustomerCount) ? entry.linkedCustomerCount : null,
      prospectiveCustomerCount: Number.isInteger(entry.prospectiveCustomerCount) ? entry.prospectiveCustomerCount : null,
    };
  });
}

function supportCase(id: string, value: FirebaseFirestore.DocumentData) {
  if (!isStripeAccountReviewStatus(value.status)) return null;
  return {
    caseId: id,
    uid: typeof value.uid === 'string' ? value.uid : null,
    email: typeof value.email === 'string' ? value.email : null,
    name: typeof value.name === 'string' ? value.name : null,
    issueCode: STRIPE_ACCOUNT_REVIEW_ISSUE_CODE,
    message: typeof value.message === 'string' ? value.message.slice(0, 2_000) : '',
    status: normalizeStripeAccountReviewStatus(value.status),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    reviewedAt: typeof value.reviewedAt === 'string' ? value.reviewedAt : null,
    resolvedAt: typeof value.resolvedAt === 'string' ? value.resolvedAt : null,
    operatorNote: typeof value.operatorNote === 'string' ? value.operatorNote.slice(0, 1_000) : '',
    checkoutAccountEvidence: normalizeStripeAccountReviewEvidence(value.checkoutAccountEvidence),
    history: safeHistory(value.history),
  };
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'support.read');
  if (guard.error) return guard.error;

  try {
    const db = getAdminDb();
    const searchParams = new URL(request.url).searchParams;
    const summaryOnly = searchParams.get('summary') === '1';
    const base = db.collection('admin_feedback')
      .where('issueCode', '==', STRIPE_ACCOUNT_REVIEW_ISSUE_CODE);

    if (summaryOnly) {
      const [newCount, reviewingCount, resolvedCount] = await Promise.all([
        base.where('status', '==', 'new').count().get(),
        base.where('status', '==', 'reviewing').count().get(),
        base.where('status', '==', 'resolved').count().get(),
      ]);
      const byStatus = {
        new: newCount.data().count,
        reviewing: reviewingCount.data().count,
        resolved: resolvedCount.data().count,
      };
      return NextResponse.json(
        {
          open: byStatus.new + byStatus.reviewing,
          byStatus,
          complete: true,
          generatedAt: new Date().toISOString(),
          meta: {
            requestId: crypto.randomUUID(),
            generatedAt: new Date().toISOString(),
            staleAfterMs: 150_000,
            partial: false,
            truncated: false,
          },
        },
        { headers: PRIVATE_HEADERS },
      );
    }

    const limit = boundedLimit(searchParams.get('limit'));
    const cursor = String(searchParams.get('cursor') || '').trim();
    let query: FirebaseFirestore.Query = base
      .orderBy('createdAt', 'desc')
      .orderBy(FieldPath.documentId(), 'desc')
      .limit(limit);
    if (cursor) {
      if (!SAFE_CURSOR.test(cursor)) {
        return NextResponse.json(
          { error: 'Invalid support-case cursor.', code: 'BILLING_SUPPORT_CURSOR_INVALID' },
          { status: 400, headers: PRIVATE_HEADERS },
        );
      }
      const cursorSnapshot = await db.collection('admin_feedback').doc(cursor).get();
      if (
        !cursorSnapshot.exists
        || cursorSnapshot.data()?.issueCode !== STRIPE_ACCOUNT_REVIEW_ISSUE_CODE
      ) {
        return NextResponse.json(
          { error: 'Support-case cursor is no longer available.', code: 'BILLING_SUPPORT_CURSOR_EXPIRED' },
          { status: 409, headers: PRIVATE_HEADERS },
        );
      }
      query = base
        .orderBy('createdAt', 'desc')
        .orderBy(FieldPath.documentId(), 'desc')
        .startAfter(cursorSnapshot)
        .limit(limit);
    }

    const snapshot = await query.get();
    const cases = snapshot.docs.flatMap(document => {
      const parsed = supportCase(document.id, document.data());
      return parsed ? [parsed] : [];
    });
    const generatedAt = new Date().toISOString();
    return NextResponse.json(
      {
        cases,
        nextCursor: snapshot.size === limit ? snapshot.docs.at(-1)?.id || null : null,
        meta: {
          requestId: crypto.randomUUID(),
          generatedAt,
          staleAfterMs: 60_000,
          partial: false,
          truncated: snapshot.size === limit || cases.length !== snapshot.size,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error('[admin/billing/support-cases] list failed', error);
    return NextResponse.json(
      { error: 'Billing support cases are temporarily unavailable.', code: 'BILLING_SUPPORT_CASES_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
