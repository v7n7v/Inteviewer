export type AdminEvidenceState = 'ready' | 'degraded' | 'blocked' | 'unknown';

export interface AdminResponseMeta {
  requestId: string;
  generatedAt: string;
  staleAfterMs: number;
  partial: boolean;
  truncated: boolean;
}

export interface AdminEvidenceMeta {
  generatedAt: string;
  state: AdminEvidenceState;
  freshUntil: string | null;
  source: string;
  complete: boolean;
  sampleLimit: number | null;
  sampleCapped: boolean;
  limitations: string[];
}

export interface AdminOperationsSignal {
  key: 'stripe' | 'job_supply' | 'taco_providers' | 'notifications' | 'security';
  label: string;
  state: AdminEvidenceState;
  configured: boolean | null;
  ready: boolean | null;
  checkedAt: string | null;
  evidenceAgeSeconds: number | null;
  latencyP95Ms: number | null;
  throughput: number | null;
  errorRatePercent: number | null;
  message: string;
  drilldownHref: string;
}

export interface AdminOperationsResponse {
  generatedAt: string;
  meta: AdminResponseMeta;
  overallState: AdminEvidenceState;
  live: false;
  pollingRecommendedSeconds: number;
  aggregates: {
    stripeCheckoutReady: boolean;
    everJobs: boolean | null;
    tacoProvidersConfigured: number;
    tacoProvidersRequired: number;
    trackedEmailReady: boolean;
    distributedRateLimitConfigured: boolean;
  };
  signals: AdminOperationsSignal[];
  limitations: string[];
}

export interface AdminEmailOperationsResponse {
  generatedAt: string;
  meta: AdminResponseMeta;
  readiness: {
    provider: 'resend';
    state: AdminEvidenceState;
    canSendTrackedEmail: boolean;
    providerVerified: boolean;
    providerVerifiedAt: string | null;
    webhookVerified: boolean;
    webhookVerifiedAt: string | null;
    verifiedReceiptEvents: number;
    requiredReceiptEvents: number;
    message: string;
  };
  outbox: {
    total: number | null;
    byStatus: Record<string, number | null>;
    aggregationComplete: boolean;
  };
  evidence: AdminEvidenceMeta;
}

export interface AdminPlatformStatsResponse {
  generatedAt: string;
  meta: AdminResponseMeta;
  totalUsers: number | null;
  tierCounts: {
    free: number | null;
    pro: number | null;
    studio: number | null;
    admin: number | null;
    disabled: number | null;
  };
  mrr: number | null;
  verifiedMrr: {
    mrrUsd: number | null;
    activePaidAccounts: number | null;
    pricedActiveAccounts: number | null;
    unresolvedActiveAccounts: number | null;
    coveragePercent: number | null;
    complete: boolean;
    basisVersion: string | null;
  };
  signupTrend: Array<{ date: string; count: number }>;
  activeWeek: number | null;
  activeToday: number | null;
  featureUsage: Record<string, number>;
  evidence: {
    users: AdminEvidenceMeta;
    subscriptions: AdminEvidenceMeta;
    featureUsage: AdminEvidenceMeta;
  };
}

export interface AdminCostResponse {
  generatedAt: string;
  meta: AdminResponseMeta;
  windowDays: number;
  mrr: number | null;
  totalCost: null;
  netProfit: null;
  profitMargin: null;
  costPerUser: null;
  revenue: {
    verifiedMrrUsd: number | null;
    complete: boolean;
    coveragePercent: number | null;
    activePaidAccounts: number | null;
    unresolvedActiveAccounts: number | null;
    basisVersion: string | null;
  };
  costs: {
    tacoProviderEstimatedUsd: number | null;
    basisVersion: string | null;
    runsObserved: number | null;
    sampleCapped: boolean;
    scope: string;
  };
  directionalContribution: {
    revenueLessObservedTacoCostUsd: number | null;
    marginPercent: number | null;
    isTotalGrossMargin: false;
  };
  evidence: {
    subscriptions: AdminEvidenceMeta;
    tacoEconomics: AdminEvidenceMeta;
  };
  limitations: string[];
}

export type ObservabilityCell = number | null;

export interface AdminObservabilityResponse {
  generatedAt: string;
  meta: AdminResponseMeta;
  enabled: boolean;
  state: 'disabled' | 'ready' | 'sparse' | 'partial' | 'stale' | 'unavailable';
  observationWindow: {
    startsAt: string | null;
    endsAt: string | null;
    windowDays: number;
  };
  observedActivity: ObservabilityCell;
  byCategory: Record<string, ObservabilityCell>;
  byTool: Record<string, ObservabilityCell>;
  byOutcome: Record<string, ObservabilityCell>;
  consentCoverage: null;
  completeness: {
    complete: boolean;
    expectedShards: number;
    readShards: number;
    suppressedCells: number;
    partialReasons: string[];
  };
  definitions: {
    observedActivity: string;
    suppressedCell: string;
    consentCoverage: string;
  };
  retention: {
    configuredDays: number | null;
    policyApproved: boolean;
  };
  limitations: string[];
}
