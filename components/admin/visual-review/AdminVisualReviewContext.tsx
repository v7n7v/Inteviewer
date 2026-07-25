'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { AdminSession } from '@/components/admin/shell/AdminSessionProvider';

interface AdminVisualReviewValue {
  session: AdminSession;
  resources: Readonly<Record<string, unknown>>;
}

const AdminVisualReviewContext = createContext<AdminVisualReviewValue | null>(null);

function evidenceMeta(generatedAt: string, source: string) {
  return {
    generatedAt,
    state: 'ready',
    freshUntil: generatedAt,
    source,
    complete: true,
    sampleLimit: null,
    sampleCapped: false,
    limitations: [],
  };
}

export function AdminVisualReviewProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AdminVisualReviewValue>(() => {
    const generatedAt = new Date().toISOString();
    const meta = {
      requestId: 'visual-review',
      generatedAt,
      staleAfterMs: 75_000,
      partial: false,
      truncated: false,
    };
    const signals = [
      {
        key: 'stripe',
        label: 'Revenue & Stripe',
        state: 'ready',
        configured: true,
        ready: true,
        checkedAt: generatedAt,
        evidenceAgeSeconds: 12,
        latencyP95Ms: 182,
        throughput: 42,
        errorRatePercent: 0.2,
        message: 'Checkout catalogue and runtime readiness verified.',
        drilldownHref: '/suite/admin/finance',
      },
      {
        key: 'job_supply',
        label: 'Job Supply',
        state: 'ready',
        configured: true,
        ready: true,
        checkedAt: generatedAt,
        evidenceAgeSeconds: 18,
        latencyP95Ms: 264,
        throughput: 128,
        errorRatePercent: 0.6,
        message: 'Ever Jobs supply is prepared and serving bounded results.',
        drilldownHref: '/suite/admin/operations',
      },
      {
        key: 'taco_providers',
        label: 'Taco Providers',
        state: 'degraded',
        configured: true,
        ready: false,
        checkedAt: generatedAt,
        evidenceAgeSeconds: 31,
        latencyP95Ms: 811,
        throughput: 19,
        errorRatePercent: 3.1,
        message: 'One provider is above the review latency threshold.',
        drilldownHref: '/suite/admin/operations',
      },
      {
        key: 'notifications',
        label: 'Notifications',
        state: 'ready',
        configured: true,
        ready: true,
        checkedAt: generatedAt,
        evidenceAgeSeconds: 9,
        latencyP95Ms: 205,
        throughput: 73,
        errorRatePercent: 0.4,
        message: 'Tracked delivery and receipt evidence is current.',
        drilldownHref: '/suite/admin/email',
      },
      {
        key: 'security',
        label: 'Security',
        state: 'blocked',
        configured: true,
        ready: false,
        checkedAt: generatedAt,
        evidenceAgeSeconds: 6,
        latencyP95Ms: null,
        throughput: null,
        errorRatePercent: null,
        message: 'Second recovery owner verification is still required.',
        drilldownHref: '/suite/admin/access',
      },
    ];
    return {
      session: {
        uid: 'visual-owner',
        email: 'owner@talentconsulting.io',
        displayName: 'Jordan Lee',
        role: 'owner',
        permissions: [
          'admin.access',
          'admin.accounts.read',
          'admin.accounts.manage',
          'admin.audit.read',
          'users.read',
          'users.manage',
          'billing.read',
          'billing.manage',
          'support.read',
          'support.manage',
          'operations.read',
          'operations.manage',
          'settings.read',
          'settings.manage',
          'email.send',
          'analytics.read',
          'diagnostics.metadata.read',
        ],
        mfaSatisfied: true,
        mfaEnforced: true,
        mutationReady: true,
        features: {
          observability: true,
        },
      },
      resources: {
        '/api/admin/observability': {
          generatedAt,
          meta,
          enabled: true,
          state: 'ready',
          observationWindow: {
            startsAt: new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString(),
            endsAt: generatedAt,
            windowDays: 7,
          },
          observedActivity: 1240,
          byCategory: {
            tool_usage: 780,
            workspace: 330,
            reliability: 120,
          },
          byTool: {
            resume_check: 310,
            job_match: 240,
            taco: 180,
            interview_prep: 90,
          },
          byOutcome: {
            success: 1080,
            degraded: 110,
            failure: 50,
          },
          consentCoverage: null,
          completeness: {
            complete: true,
            expectedShards: 112,
            readShards: 112,
            suppressedCells: 2,
            partialReasons: [],
          },
          definitions: {
            observedActivity: 'Rounded, allowlisted observed events; not unique users.',
            suppressedCell: 'Small and complementary cells are hidden.',
            consentCoverage: 'Unavailable without a population scan.',
          },
          retention: {
            configuredDays: 7,
            policyApproved: true,
          },
          limitations: [
            'Privacy-suppressed aggregate evidence only.',
            'Counts are rounded and may be incomplete.',
          ],
        },
        '/api/admin/diagnostic-cases': {
          enabled: true,
          truncated: false,
          cases: [
            {
              caseId: 'bug-feedback-review-7K2M',
              category: 'tool_failure',
              status: 'open',
              scope: 'observability_metadata_v1',
              grantState: 'active',
              grantExpiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
              createdAt: generatedAt,
              updatedAt: generatedAt,
            },
          ],
        },
        '/api/admin/ops': {
          generatedAt,
          meta,
          overallState: 'degraded',
          live: false,
          pollingRecommendedSeconds: 30,
          aggregates: {
            stripeCheckoutReady: true,
            everJobs: true,
            tacoProvidersConfigured: 2,
            tacoProvidersRequired: 3,
            trackedEmailReady: true,
            distributedRateLimitConfigured: true,
          },
          signals,
          limitations: ['Aggregate visual-review evidence only.'],
        },
        '/api/admin/stats': {
          generatedAt,
          meta: { ...meta, staleAfterMs: 600_000 },
          totalUsers: 12_486,
          tierCounts: { free: 9_180, pro: 2_471, studio: 835, admin: 8, disabled: 43 },
          mrr: 146_820,
          verifiedMrr: {
            mrrUsd: 146_820,
            activePaidAccounts: 3_306,
            pricedActiveAccounts: 3_297,
            unresolvedActiveAccounts: 9,
            coveragePercent: 99.7,
            complete: true,
            basisVersion: 'verified-recurring-v8',
          },
          signupTrend: [],
          activeWeek: 6_824,
          activeToday: 1_931,
          featureUsage: {},
          evidence: {
            users: evidenceMeta(generatedAt, 'Firebase Auth aggregate'),
            subscriptions: evidenceMeta(generatedAt, 'Subscription evidence'),
            featureUsage: evidenceMeta(generatedAt, 'Usage aggregate'),
          },
        },
        '/api/admin/billing/support-cases?summary=1': {
          open: 7,
          complete: true,
          generatedAt,
          meta,
        },
      },
    };
  }, []);

  return (
    <AdminVisualReviewContext.Provider value={value}>
      {children}
    </AdminVisualReviewContext.Provider>
  );
}

export function useAdminVisualReview() {
  return useContext(AdminVisualReviewContext);
}
