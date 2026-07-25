import 'server-only';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  AdminCostResponse,
  AdminEmailOperationsResponse,
  AdminPlatformStatsResponse,
} from '@/lib/admin/contracts';
import { adminEvidence, evidenceState } from '@/lib/admin/evidence';
import { adminResponseMeta } from '@/lib/admin/http';
import {
  claimAdminAggregateRefresh,
  publishAdminAggregateGeneration,
  releaseAdminAggregateRefresh,
} from '@/lib/admin/aggregate-cache';
import {
  readBoundedFeatureUsage,
  readBoundedTacoEconomics,
  readBoundedUserAggregates,
  readCollectionCount,
  readFilteredCollectionCount,
  readVerifiedSubscriptionAggregates,
} from '@/lib/admin/read-models';
import { getJobNotificationDeliveryReadinessForStore } from '@/lib/job-notification-readiness';

export const ADMIN_STATS_CACHE_KEY = 'platform_stats_v2';
export const ADMIN_EMAIL_CACHE_KEY = 'email_operations_v2';
export const ADMIN_COST_CACHE_WINDOWS = [7, 30, 90] as const;
export const ADMIN_AGGREGATE_TTL_MS = 15 * 60_000;
export const ADMIN_AGGREGATE_MATERIALIZATION_LEASE_KEY = 'materialization_lease_v2';
const ADMIN_AGGREGATE_MATERIALIZATION_LEASE_MS = 3 * 60_000;
const EMAIL_OUTBOX_STATUSES = [
  'queued',
  'retry',
  'leased',
  'accepted',
  'delivered',
  'delayed',
  'failed',
  'skipped',
  'dead',
] as const;

type SettledValue<T> = PromiseSettledResult<T>;

function fulfilled<T>(result: SettledValue<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

function buildStatsPayload(input: {
  users: Awaited<ReturnType<typeof readBoundedUserAggregates>> | null;
  subscriptions: Awaited<ReturnType<typeof readVerifiedSubscriptionAggregates>> | null;
  featureUsage: Awaited<ReturnType<typeof readBoundedFeatureUsage>> | null;
  adminCount: number | null;
  generatedAt: string;
}) {
  const verifiedMrr = input.subscriptions?.verifiedMrr;
  const response: AdminPlatformStatsResponse = {
    generatedAt: input.generatedAt,
    meta: adminResponseMeta({
      generatedAt: input.generatedAt,
      staleAfterMs: ADMIN_AGGREGATE_TTL_MS,
      partial: !input.users?.evidence.complete
        || !input.subscriptions?.evidence.complete
        || !input.featureUsage?.evidence.complete
        || input.adminCount === null,
    }),
    totalUsers: input.users?.totalUsers ?? null,
    tierCounts: {
      free: null,
      pro: input.subscriptions?.tierCounts.pro ?? null,
      studio: input.subscriptions?.tierCounts.studio ?? null,
      admin: input.adminCount,
      disabled: input.users?.disabled ?? null,
    },
    mrr: input.subscriptions?.evidence.complete ? verifiedMrr?.mrrUsd ?? null : null,
    verifiedMrr: {
      mrrUsd: verifiedMrr?.mrrUsd ?? null,
      activePaidAccounts: verifiedMrr?.activePaidAccounts ?? null,
      pricedActiveAccounts: verifiedMrr?.pricedActiveAccounts ?? null,
      unresolvedActiveAccounts: verifiedMrr?.unresolvedActiveAccounts ?? null,
      coveragePercent: verifiedMrr?.coveragePercent ?? null,
      complete: input.subscriptions?.evidence.complete ?? false,
      basisVersion: verifiedMrr?.basisVersion ?? null,
    },
    signupTrend: input.users?.signupTrend ?? [],
    activeWeek: input.users?.activeWeek ?? null,
    activeToday: input.users?.activeToday ?? null,
    featureUsage: input.featureUsage?.usage ?? {},
    evidence: {
      users: input.users?.evidence ?? adminEvidence({
        state: 'unknown',
        source: 'Firebase Authentication bounded user listing',
        complete: false,
        limitations: ['User aggregates could not be read.'],
        freshnessMs: null,
      }),
      subscriptions: input.subscriptions?.evidence ?? adminEvidence({
        state: 'unknown',
        source: 'Firestore server-owned active subscription evidence',
        complete: false,
        limitations: ['Subscription aggregates could not be read.'],
        freshnessMs: null,
      }),
      featureUsage: input.featureUsage?.evidence ?? adminEvidence({
        state: 'unknown',
        source: 'Firestore bounded usage-document aggregation',
        complete: false,
        limitations: ['Feature usage aggregates could not be read.'],
        freshnessMs: null,
      }),
    },
  };
  return {
    ...response,
    privacy: 'Aggregate response only; no user IDs, emails, names, or activity records are returned.',
    limitations: [
      'Free-plan count is unknown until a complete, non-overlapping account ledger is available.',
      'A null KPI is unavailable or incomplete evidence, never a measured zero.',
    ],
  };
}

function buildCostPayload(input: {
  windowDays: number;
  subscriptions: Awaited<ReturnType<typeof readVerifiedSubscriptionAggregates>> | null;
  economics: Awaited<ReturnType<typeof readBoundedTacoEconomics>> | null;
  generatedAt: string;
}): AdminCostResponse {
  const mrr = input.subscriptions?.verifiedMrr;
  const estimatedCostUsd = input.economics?.summary.estimatedCostUsd ?? null;
  const completeForDirectionalComparison = Boolean(
    input.subscriptions?.evidence.complete
    && input.economics?.evidence.complete
    && mrr
    && estimatedCostUsd != null,
  );
  const directionalContribution = completeForDirectionalComparison
    ? Number((mrr!.mrrUsd - estimatedCostUsd!).toFixed(4))
    : null;
  const directionalMargin = directionalContribution != null && mrr!.mrrUsd > 0
    ? Number(((directionalContribution / mrr!.mrrUsd) * 100).toFixed(1))
    : null;

  return {
    generatedAt: input.generatedAt,
    meta: adminResponseMeta({
      generatedAt: input.generatedAt,
      staleAfterMs: ADMIN_AGGREGATE_TTL_MS,
      partial: !input.subscriptions?.evidence.complete || !input.economics?.evidence.complete,
      truncated: input.economics?.sampleCapped ?? false,
    }),
    windowDays: input.windowDays,
    mrr: input.subscriptions?.evidence.complete ? mrr?.mrrUsd ?? null : null,
    totalCost: null,
    netProfit: null,
    profitMargin: null,
    costPerUser: null,
    revenue: {
      verifiedMrrUsd: mrr?.mrrUsd ?? null,
      complete: input.subscriptions?.evidence.complete ?? false,
      coveragePercent: mrr?.coveragePercent ?? null,
      activePaidAccounts: mrr?.activePaidAccounts ?? null,
      unresolvedActiveAccounts: mrr?.unresolvedActiveAccounts ?? null,
      basisVersion: mrr?.basisVersion ?? null,
    },
    costs: {
      tacoProviderEstimatedUsd: estimatedCostUsd,
      basisVersion: input.economics?.summary.costBasisVersion ?? null,
      runsObserved: input.economics?.summary.runsObserved ?? null,
      sampleCapped: input.economics?.sampleCapped ?? false,
      scope: 'Directional Taco workload cost derived from recorded work events; excludes invoiced infrastructure, support, tax, refunds, and acquisition spend.',
    },
    directionalContribution: {
      revenueLessObservedTacoCostUsd: directionalContribution,
      marginPercent: directionalMargin,
      isTotalGrossMargin: false,
    },
    evidence: {
      subscriptions: input.subscriptions?.evidence ?? adminEvidence({
        state: 'unknown',
        source: 'Firestore server-owned active subscription evidence',
        complete: false,
        limitations: ['Subscription evidence could not be read.'],
        freshnessMs: null,
      }),
      tacoEconomics: input.economics?.evidence ?? adminEvidence({
        state: 'unknown',
        source: 'Firestore Taco workload economics events',
        complete: false,
        limitations: ['Taco workload cost evidence could not be read.'],
        freshnessMs: null,
      }),
    },
    limitations: [
      'No plan-count multiplication, cohort extrapolation, or invented infrastructure formula is used.',
      'Total cost, net profit, profit margin, and cost per user remain unknown until verified invoices or an authoritative cost ledger exists.',
      'The directional comparison must not be presented as recognized revenue or total gross margin.',
    ],
  };
}

function buildEmailPayload(input: {
  readiness: Awaited<ReturnType<typeof getJobNotificationDeliveryReadinessForStore>> | null;
  total: number | null;
  statuses: Array<number | null>;
  generatedAt: string;
}): AdminEmailOperationsResponse {
  const aggregationComplete = input.total !== null
    && input.statuses.every(value => value !== null);
  const readiness = input.readiness;
  const byStatus = Object.fromEntries(
    EMAIL_OUTBOX_STATUSES.map((status, index) => [status, input.statuses[index] ?? null]),
  );
  return {
    generatedAt: input.generatedAt,
    meta: adminResponseMeta({
      generatedAt: input.generatedAt,
      staleAfterMs: ADMIN_AGGREGATE_TTL_MS,
      partial: !aggregationComplete || !readiness,
    }),
    readiness: {
      provider: 'resend',
      state: readiness
        ? evidenceState({
            ready: readiness.canSendTrackedEmail,
            configured: readiness.status === 'configured',
          })
        : 'unknown',
      canSendTrackedEmail: readiness?.canSendTrackedEmail ?? false,
      providerVerified: readiness?.providerVerified ?? false,
      providerVerifiedAt: readiness?.providerVerifiedAt ?? null,
      webhookVerified: readiness?.webhookVerified ?? false,
      webhookVerifiedAt: readiness?.webhookVerifiedAt ?? null,
      verifiedReceiptEvents: readiness?.verifiedReceiptEvents ?? 0,
      requiredReceiptEvents: readiness?.requiredReceiptEvents ?? 0,
      message: readiness?.message || 'Email readiness evidence is unavailable.',
    },
    outbox: {
      total: input.total,
      byStatus,
      aggregationComplete,
    },
    evidence: adminEvidence({
      state: aggregationComplete && readiness
        ? evidenceState({
            ready: readiness.canSendTrackedEmail,
            configured: readiness.status === 'configured',
          })
        : 'unknown',
      source: 'Scheduled Resend verification receipts and Firestore count aggregations',
      complete: aggregationComplete && Boolean(readiness),
      limitations: [
        ...(!aggregationComplete ? ['One or more email outbox count aggregations were unavailable.'] : []),
        ...(!readiness ? ['Email delivery readiness evidence was unavailable.'] : []),
        'This snapshot contains no recipient payloads and performs no email send.',
      ],
    }),
  };
}

export async function materializeAdminAggregateSnapshots(
  auth: Auth,
  db: Firestore,
  options: { windows?: readonly number[] } = {},
) {
  const executionId = await claimAdminAggregateRefresh(
    db,
    ADMIN_AGGREGATE_MATERIALIZATION_LEASE_KEY,
    ADMIN_AGGREGATE_MATERIALIZATION_LEASE_MS,
  );
  if (!executionId) {
    return {
      skipped: true as const,
      reason: 'materialization_already_running' as const,
      providerWritesPerformed: false as const,
    };
  }

  const windows = [...new Set(options.windows || ADMIN_COST_CACHE_WINDOWS)]
    .filter(windowDays => Number.isInteger(windowDays) && windowDays >= 7 && windowDays <= 90);
  try {
    const coreResultsPromise = Promise.allSettled([
      readBoundedUserAggregates(auth),
      readVerifiedSubscriptionAggregates(db),
      readBoundedFeatureUsage(db),
      readCollectionCount(db, 'admin_accounts'),
      ...windows.map(windowDays => readBoundedTacoEconomics(db, windowDays)),
    ]);
    const emailResultsPromise = Promise.allSettled([
      getJobNotificationDeliveryReadinessForStore(db),
      readCollectionCount(db, 'email_outbox'),
      ...EMAIL_OUTBOX_STATUSES.map(status => (
        readFilteredCollectionCount(db, 'email_outbox', 'status', status)
      )),
    ]);
    const [coreResults, emailResults] = await Promise.all([
      coreResultsPromise,
      emailResultsPromise,
    ]);
    const [
      usersResult,
      subscriptionsResult,
      featureUsageResult,
      adminCountResult,
      ...economicsResults
    ] = coreResults;
    const [emailReadinessResult, emailTotalResult, ...emailStatusResults] = emailResults;
    const generatedAt = new Date().toISOString();
    const subscriptions = fulfilled(subscriptionsResult);
    const stats = buildStatsPayload({
      users: fulfilled(usersResult),
      subscriptions,
      featureUsage: fulfilled(featureUsageResult),
      adminCount: fulfilled(adminCountResult),
      generatedAt,
    });
    const costs = windows.map((windowDays, index) => buildCostPayload({
      windowDays,
      subscriptions,
      economics: fulfilled(economicsResults[index]),
      generatedAt,
    }));
    const email = buildEmailPayload({
      readiness: fulfilled(emailReadinessResult),
      total: fulfilled(emailTotalResult),
      statuses: emailStatusResults.map(result => fulfilled(result)),
      generatedAt,
    });
    const published = await publishAdminAggregateGeneration(
      db,
      ADMIN_AGGREGATE_MATERIALIZATION_LEASE_KEY,
      executionId,
      [
        { key: ADMIN_STATS_CACHE_KEY, payload: stats, ttlMs: ADMIN_AGGREGATE_TTL_MS },
        { key: ADMIN_EMAIL_CACHE_KEY, payload: email, ttlMs: ADMIN_AGGREGATE_TTL_MS },
        ...costs.map(payload => ({
          key: `costs_v2_${payload.windowDays}`,
          payload,
          ttlMs: ADMIN_AGGREGATE_TTL_MS,
        })),
      ],
    );
    if (!published) {
      throw new Error('ADMIN_AGGREGATE_LEASE_SUPERSEDED');
    }
    return {
      skipped: false as const,
      generatedAt,
      windows,
      partial: stats.meta.partial || email.meta.partial || costs.some(payload => payload.meta.partial),
      stats: {
        partial: stats.meta.partial,
        truncated: stats.meta.truncated,
      },
      email: {
        partial: email.meta.partial,
        truncated: email.meta.truncated,
      },
      costs: costs.map(payload => ({
        windowDays: payload.windowDays,
        partial: payload.meta.partial,
        truncated: payload.meta.truncated,
      })),
      sourceReadsScheduled: true,
      providerWritesPerformed: false,
    };
  } catch (error) {
    await releaseAdminAggregateRefresh(
      db,
      ADMIN_AGGREGATE_MATERIALIZATION_LEASE_KEY,
      executionId,
    ).catch(() => undefined);
    throw error;
  }
}
