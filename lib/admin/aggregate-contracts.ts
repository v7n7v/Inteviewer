import { z } from 'zod';

export const adminResponseMetaSchema = z.object({
  requestId: z.string().min(1),
  generatedAt: z.string().datetime(),
  staleAfterMs: z.number().finite().nonnegative(),
  partial: z.boolean(),
  truncated: z.boolean(),
}).strict();

export const adminEvidenceMetaSchema = z.object({
  generatedAt: z.string().datetime(),
  state: z.enum(['ready', 'degraded', 'blocked', 'unknown']),
  freshUntil: z.string().datetime().nullable(),
  source: z.string().min(1),
  complete: z.boolean(),
  sampleLimit: z.number().int().nonnegative().nullable(),
  sampleCapped: z.boolean(),
  limitations: z.array(z.string()),
}).strict();

export const adminPlatformStatsSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  meta: adminResponseMetaSchema,
  totalUsers: z.number().int().nonnegative().nullable(),
  tierCounts: z.object({
    free: z.number().int().nonnegative().nullable(),
    pro: z.number().int().nonnegative().nullable(),
    studio: z.number().int().nonnegative().nullable(),
    admin: z.number().int().nonnegative().nullable(),
    disabled: z.number().int().nonnegative().nullable(),
  }).strict(),
  mrr: z.number().finite().nonnegative().nullable(),
  verifiedMrr: z.object({
    mrrUsd: z.number().finite().nonnegative().nullable(),
    activePaidAccounts: z.number().int().nonnegative().nullable(),
    pricedActiveAccounts: z.number().int().nonnegative().nullable(),
    unresolvedActiveAccounts: z.number().int().nonnegative().nullable(),
    coveragePercent: z.number().finite().min(0).max(100).nullable(),
    complete: z.boolean(),
    basisVersion: z.string().min(1).nullable(),
  }).strict(),
  signupTrend: z.array(z.object({
    date: z.string().min(1),
    count: z.number().int().nonnegative(),
  }).strict()),
  activeWeek: z.number().int().nonnegative().nullable(),
  activeToday: z.number().int().nonnegative().nullable(),
  featureUsage: z.record(z.string(), z.number().finite().nonnegative()),
  evidence: z.object({
    users: adminEvidenceMetaSchema,
    subscriptions: adminEvidenceMetaSchema,
    featureUsage: adminEvidenceMetaSchema,
  }).strict(),
  privacy: z.string().min(1),
  limitations: z.array(z.string()),
}).strict();

export const adminCostSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  meta: adminResponseMetaSchema,
  windowDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  mrr: z.number().finite().nonnegative().nullable(),
  totalCost: z.null(),
  netProfit: z.null(),
  profitMargin: z.null(),
  costPerUser: z.null(),
  revenue: z.object({
    verifiedMrrUsd: z.number().finite().nonnegative().nullable(),
    complete: z.boolean(),
    coveragePercent: z.number().finite().min(0).max(100).nullable(),
    activePaidAccounts: z.number().int().nonnegative().nullable(),
    unresolvedActiveAccounts: z.number().int().nonnegative().nullable(),
    basisVersion: z.string().min(1).nullable(),
  }).strict(),
  costs: z.object({
    tacoProviderEstimatedUsd: z.number().finite().nonnegative().nullable(),
    basisVersion: z.string().min(1).nullable(),
    runsObserved: z.number().int().nonnegative().nullable(),
    sampleCapped: z.boolean(),
    scope: z.string().min(1),
  }).strict(),
  directionalContribution: z.object({
    revenueLessObservedTacoCostUsd: z.number().finite().nullable(),
    marginPercent: z.number().finite().nullable(),
    isTotalGrossMargin: z.literal(false),
  }).strict(),
  evidence: z.object({
    subscriptions: adminEvidenceMetaSchema,
    tacoEconomics: adminEvidenceMetaSchema,
  }).strict(),
  limitations: z.array(z.string()),
}).strict();

export const adminEmailSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  meta: adminResponseMetaSchema,
  readiness: z.object({
    provider: z.literal('resend'),
    state: z.enum(['ready', 'degraded', 'blocked', 'unknown']),
    canSendTrackedEmail: z.boolean(),
    providerVerified: z.boolean(),
    providerVerifiedAt: z.string().datetime().nullable(),
    webhookVerified: z.boolean(),
    webhookVerifiedAt: z.string().datetime().nullable(),
    verifiedReceiptEvents: z.number().int().nonnegative(),
    requiredReceiptEvents: z.number().int().nonnegative(),
    message: z.string().min(1),
  }).strict(),
  outbox: z.object({
    total: z.number().int().nonnegative().nullable(),
    byStatus: z.object({
      queued: z.number().int().nonnegative().nullable(),
      retry: z.number().int().nonnegative().nullable(),
      leased: z.number().int().nonnegative().nullable(),
      accepted: z.number().int().nonnegative().nullable(),
      delivered: z.number().int().nonnegative().nullable(),
      delayed: z.number().int().nonnegative().nullable(),
      failed: z.number().int().nonnegative().nullable(),
      skipped: z.number().int().nonnegative().nullable(),
      dead: z.number().int().nonnegative().nullable(),
    }).strict(),
    aggregationComplete: z.boolean(),
  }).strict(),
  evidence: adminEvidenceMetaSchema,
}).strict();

export type AdminPlatformStatsSnapshot = z.infer<typeof adminPlatformStatsSnapshotSchema>;
export type AdminCostSnapshot = z.infer<typeof adminCostSnapshotSchema>;
export type AdminEmailSnapshot = z.infer<typeof adminEmailSnapshotSchema>;

export function isAdminPlatformStatsSnapshot(
  value: unknown,
): value is AdminPlatformStatsSnapshot {
  return adminPlatformStatsSnapshotSchema.safeParse(value).success;
}

export function isAdminCostSnapshot(value: unknown): value is AdminCostSnapshot {
  return adminCostSnapshotSchema.safeParse(value).success;
}

export function isAdminEmailSnapshot(value: unknown): value is AdminEmailSnapshot {
  return adminEmailSnapshotSchema.safeParse(value).success;
}
