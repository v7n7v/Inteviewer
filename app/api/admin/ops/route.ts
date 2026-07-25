import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { adminJson, adminReadFailure, adminResponseMeta } from '@/lib/admin/http';
import {
  evidenceAgeSeconds,
  evidenceState,
  operationalSecretConfigured,
} from '@/lib/admin/evidence';
import type {
  AdminEvidenceState,
  AdminOperationsResponse,
  AdminOperationsSignal,
} from '@/lib/admin/contracts';
import { getAdminDb } from '@/lib/firebase-admin';
import { getStripeRuntimeReadiness } from '@/lib/billing/stripe-runtime-readiness';
import { getJobSupplyConfiguration } from '@/lib/job-supply-health';
import { getJobNotificationDeliveryReadinessForStore } from '@/lib/job-notification-readiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function overallState(signals: AdminOperationsSignal[]): AdminEvidenceState {
  const states = signals.map(signal => signal.state);
  if (states.includes('blocked')) return 'blocked';
  if (states.includes('unknown')) return 'unknown';
  if (states.includes('degraded')) return 'degraded';
  return 'ready';
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'operations.read');
  if (guard.error) return guard.error;

  try {
    const generatedAt = new Date().toISOString();
    const stripeCheckout = getStripeRuntimeReadiness();
    const jobSupply = getJobSupplyConfiguration();
    const notificationDelivery = await getJobNotificationDeliveryReadinessForStore(getAdminDb());
    const tacoProviders = {
      gemini: operationalSecretConfigured(process.env.GEMINI_API_KEY),
      groq: operationalSecretConfigured(process.env.GROQ_API_KEY),
    };
    const tacoProvidersConfigured = Object.values(tacoProviders).filter(Boolean).length;
    const distributedRateLimitConfigured = (
      operationalSecretConfigured(process.env.UPSTASH_REDIS_REST_URL, 'https://')
      && operationalSecretConfigured(process.env.UPSTASH_REDIS_REST_TOKEN)
    );
    const mfaEnforced = process.env.ADMIN_MFA_ENFORCED === 'true';

    const signals: AdminOperationsSignal[] = [
      {
        key: 'stripe',
        label: 'Revenue & Stripe',
        state: evidenceState({
          ready: stripeCheckout.configurationReady,
          configured: stripeCheckout.status !== 'not_configured',
        }),
        configured: stripeCheckout.status !== 'not_configured',
        ready: stripeCheckout.configurationReady,
        checkedAt: null,
        evidenceAgeSeconds: null,
        latencyP95Ms: null,
        throughput: null,
        errorRatePercent: null,
        message: stripeCheckout.message,
        drilldownHref: '/suite/admin/finance',
      },
      {
        key: 'job_supply',
        label: 'Job Supply',
        state: jobSupply.preparationConfigured ? 'unknown' : 'blocked',
        configured: jobSupply.preparationConfigured,
        ready: jobSupply.preparationConfigured ? null : false,
        checkedAt: null,
        evidenceAgeSeconds: null,
        latencyP95Ms: null,
        throughput: null,
        errorRatePercent: null,
        message: jobSupply.preparationConfigured
          ? 'Ever Jobs configuration and safe-source policy are present; routine Overview polling does not perform a live provider probe.'
          : 'Ever Jobs configuration or safe-source policy is incomplete.',
        drilldownHref: '/suite/admin/operations?system=job-supply',
      },
      {
        key: 'taco_providers',
        label: 'Taco Providers',
        state: tacoProvidersConfigured === 2 ? 'unknown' : 'blocked',
        configured: tacoProvidersConfigured === 2,
        ready: null,
        checkedAt: null,
        evidenceAgeSeconds: null,
        latencyP95Ms: null,
        throughput: null,
        errorRatePercent: null,
        message: tacoProvidersConfigured === 2
          ? 'Required provider credentials are configured; no live provider check was performed by this read-only overview.'
          : `${2 - tacoProvidersConfigured} required Taco provider configuration${2 - tacoProvidersConfigured === 1 ? '' : 's'} missing.`,
        drilldownHref: '/suite/admin/operations?system=taco-providers',
      },
      {
        key: 'notifications',
        label: 'Resend Email and Receipts',
        state: evidenceState({
          ready: notificationDelivery.canSendTrackedEmail,
          configured: notificationDelivery.status === 'configured',
        }),
        configured: notificationDelivery.sendConfigured && notificationDelivery.receiptConfigured,
        ready: notificationDelivery.canSendTrackedEmail,
        checkedAt: notificationDelivery.webhookVerifiedAt || notificationDelivery.providerVerifiedAt,
        evidenceAgeSeconds: evidenceAgeSeconds(
          notificationDelivery.webhookVerifiedAt || notificationDelivery.providerVerifiedAt,
        ),
        latencyP95Ms: null,
        throughput: null,
        errorRatePercent: null,
        message: notificationDelivery.message,
        drilldownHref: '/suite/admin/email',
      },
      {
        key: 'security',
        label: 'Security',
        state: distributedRateLimitConfigured && mfaEnforced ? 'ready' : 'degraded',
        configured: distributedRateLimitConfigured,
        ready: distributedRateLimitConfigured && mfaEnforced,
        checkedAt: null,
        evidenceAgeSeconds: null,
        latencyP95Ms: null,
        throughput: null,
        errorRatePercent: null,
        message: distributedRateLimitConfigured && mfaEnforced
          ? 'Distributed rate limiting and Admin MFA enforcement are configured.'
          : 'Review Admin MFA enforcement and distributed rate-limit configuration before enabling high-impact operations.',
        drilldownHref: '/suite/admin/access',
      },
    ];

    const response: AdminOperationsResponse = {
      generatedAt,
      meta: adminResponseMeta({
        generatedAt,
        staleAfterMs: 75_000,
        partial: signals.some(signal => (
          signal.ready === null
          || signal.evidenceAgeSeconds === null
          || signal.throughput === null
          || signal.latencyP95Ms === null
          || signal.errorRatePercent === null
        )),
      }),
      overallState: overallState(signals),
      live: false,
      pollingRecommendedSeconds: 30,
      aggregates: {
        stripeCheckoutReady: stripeCheckout.configurationReady,
        everJobs: jobSupply.preparationConfigured ? null : false,
        tacoProvidersConfigured,
        tacoProvidersRequired: 2,
        trackedEmailReady: notificationDelivery.canSendTrackedEmail,
        distributedRateLimitConfigured,
      },
      signals,
      limitations: [
        'Aggregate response only; no credentials, provider identifiers, user content, or raw provider errors are returned.',
        'Overview performs read-only readiness checks and authorizes no provider, billing, entitlement, email, or score-policy mutation.',
        'Routine Overview polling never calls Ever Jobs; use the separately rate-limited verification endpoint for a live supply check.',
        'Null telemetry means the metric is not instrumented; it must not be interpreted as zero.',
      ],
    };

    return adminJson(response);
  } catch {
    return adminReadFailure(
      'admin_operations_evidence_unavailable',
      'Operational evidence is temporarily unavailable.',
    );
  }
}
