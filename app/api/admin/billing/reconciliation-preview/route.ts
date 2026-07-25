import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireBillingAdmin } from '@/lib/admin-billing-auth';
import { checkRateLimitStrict } from '@/lib/rate-limit';
import { billingAccountReference } from '@/lib/admin/billing-account-reference';
import {
  listBillingAccounts,
  previewCustomerBillingEvidence,
  type BillingAccountRecord,
} from '@/lib/billing-ledger';

export const dynamic = 'force-dynamic';

const MAX_PREVIEW_ACCOUNTS = 20;
const PREVIEW_CONCURRENCY = 4;
const PREVIEW_DEADLINE_MS = 16_000;
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};

async function withPreviewDeadline<T>(work: Promise<T>, remainingMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('PREVIEW_DEADLINE')), remainingMs);
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function boundedLimit(value: string | null) {
  const parsed = Number(value || 5);
  return Math.min(Math.max(Number.isFinite(parsed) ? Math.floor(parsed) : 5, 1), MAX_PREVIEW_ACCOUNTS);
}

function sanitizedPreview(account: BillingAccountRecord, preview: Awaited<ReturnType<typeof previewCustomerBillingEvidence>>) {
  return {
    accountRef: billingAccountReference(account.accountId),
    status: preview.status,
    evidenceStatus: preview.evidenceStatus,
    missing: preview.missing,
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
  };
}

function unavailablePreview(account: BillingAccountRecord, reason = 'provider_evidence_unavailable') {
  return {
    accountRef: billingAccountReference(account.accountId),
    status: 'blocked' as const,
    evidenceStatus: 'incomplete' as const,
    missing: [reason],
    proposed: {},
  };
}

export async function GET(request: NextRequest) {
  const guard = await requireBillingAdmin(request);
  if (guard.error) return guard.error;

  const generatedAt = new Date().toISOString();
  if (request.nextUrl.searchParams.get('activate') !== '1') {
    return NextResponse.json(
      {
        previews: [],
        activationRequired: true,
        writePerformed: false,
        meta: {
          requestId: crypto.randomUUID(),
          generatedAt,
          staleAfterMs: 300_000,
          partial: false,
          truncated: false,
          maxAccounts: MAX_PREVIEW_ACCOUNTS,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  }

  const limiter = await checkRateLimitStrict(
    `admin-billing-preview:${guard.user.uid}`,
    4,
    60_000,
  );
  if ((limiter.unavailable && process.env.NODE_ENV === 'production') || (!limiter.unavailable && !limiter.allowed)) {
    return NextResponse.json(
      { error: 'The bounded reconciliation preview is temporarily rate limited.', code: 'BILLING_RECONCILIATION_RATE_LIMITED' },
      { status: limiter.unavailable ? 503 : 429, headers: PRIVATE_HEADERS },
    );
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Reconciliation evidence is temporarily unavailable.', code: 'BILLING_RECONCILIATION_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }

  const limit = boundedLimit(request.nextUrl.searchParams.get('limit'));
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
    maxNetworkRetries: 0,
    timeout: 7_000,
  });
  try {
    const accounts = (await listBillingAccounts(limit)) as BillingAccountRecord[];
    const deadlineAt = Date.now() + PREVIEW_DEADLINE_MS;
    const previews = new Array<
      ReturnType<typeof sanitizedPreview> | ReturnType<typeof unavailablePreview>
    >(accounts.length);
    let cursor = 0;

    const workers = Array.from({ length: Math.min(PREVIEW_CONCURRENCY, accounts.length) }, async () => {
      while (cursor < accounts.length) {
        const index = cursor;
        cursor += 1;
        const account = accounts[index];
        const remainingMs = deadlineAt - Date.now();
        if (remainingMs <= 0) {
          previews[index] = unavailablePreview(account, 'preview_deadline_reached');
          continue;
        }
        try {
          const providerPreview = await withPreviewDeadline(
            previewCustomerBillingEvidence(stripe, account),
            remainingMs,
          );
          previews[index] = sanitizedPreview(account, providerPreview);
        } catch {
          previews[index] = unavailablePreview(
            account,
            Date.now() >= deadlineAt ? 'preview_deadline_reached' : 'provider_evidence_unavailable',
          );
        }
      }
    });
    await Promise.all(workers);
    const partial = previews.some(preview => (
      preview.missing.includes('provider_evidence_unavailable')
      || preview.missing.includes('preview_deadline_reached')
    ));
    return NextResponse.json(
      {
        previews,
        activationRequired: false,
        writePerformed: false,
        meta: {
          requestId: crypto.randomUUID(),
          generatedAt,
          staleAfterMs: 300_000,
          partial,
          truncated: accounts.length === limit,
          maxAccounts: MAX_PREVIEW_ACCOUNTS,
          concurrency: PREVIEW_CONCURRENCY,
          deadlineMs: PREVIEW_DEADLINE_MS,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error('[admin/billing/reconciliation-preview] failed', error);
    return NextResponse.json(
      { error: 'Reconciliation evidence is temporarily unavailable.', code: 'BILLING_RECONCILIATION_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
