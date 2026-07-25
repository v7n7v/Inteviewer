import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { adminJson, adminReadFailure } from '@/lib/admin/http';
import { checkRateLimitStrict } from '@/lib/rate-limit';
import { probeJobSupplyHealth } from '@/lib/job-supply-health';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'operations.read');
  if (guard.error) return guard.error;

  const strictLimit = await checkRateLimitStrict(
    `admin-job-supply-verification:${guard.actor.uid}`,
    6,
    60_000,
  );
  if (strictLimit.unavailable) {
    return adminReadFailure(
      'admin_job_supply_rate_limit_unavailable',
      'Live job-supply verification is temporarily unavailable.',
      503,
      60,
    );
  }
  if (!strictLimit.allowed) {
    return adminReadFailure(
      'admin_job_supply_rate_limited',
      'Live job-supply verification is limited. Wait before checking again.',
      429,
      Math.ceil(strictLimit.resetIn / 1_000),
    );
  }

  const result = await probeJobSupplyHealth({ force: true });
  return adminJson(
    {
      provider: 'ever_jobs',
      status: result.status,
      preparationReady: result.preparationReady,
      configurationReady: result.preparationConfigured,
      apiKeyProtectionVerified: result.apiKeyProtectionVerified,
      safeSourcePolicyReady: result.safeSources.length > 0 && result.unsafeSources.length === 0,
      checkedAt: result.checkedAt,
      latencyMs: result.latencyMs,
      endpoint: result.endpoint,
      message: result.message,
      recovery: result.preparationReady
        ? null
        : {
            code: 'PRIMARY_JOB_SUPPLY_UNAVAILABLE',
            retryable: result.status === 'unreachable' || result.status === 'unhealthy',
          },
      privacy: 'No API keys, source credentials, job content, or raw provider errors are returned.',
    },
    { status: result.preparationReady ? 200 : 503 },
  );
}
