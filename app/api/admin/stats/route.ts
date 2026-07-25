import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { adminJson } from '@/lib/admin/http';
import type { AdminPlatformStatsResponse } from '@/lib/admin/contracts';
import { readAdminAggregateCache } from '@/lib/admin/aggregate-cache';
import { ADMIN_STATS_CACHE_KEY } from '@/lib/admin/aggregate-materializer';
import { isAdminPlatformStatsSnapshot } from '@/lib/admin/aggregate-contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'analytics.read');
  if (guard.error) return guard.error;

  const cached = await readAdminAggregateCache<AdminPlatformStatsResponse & {
    privacy: string;
    limitations: string[];
  }>(getAdminDb(), ADMIN_STATS_CACHE_KEY, isAdminPlatformStatsSnapshot);
  if (!cached.payload) {
    return adminJson(
      {
        error: 'The scheduled platform snapshot is not available yet.',
        code: 'ADMIN_STATS_SNAPSHOT_UNAVAILABLE',
      },
      { status: 503 },
    );
  }
  return adminJson({
    ...cached.payload,
    meta: {
      ...cached.payload.meta,
      requestId: crypto.randomUUID(),
      partial: cached.payload.meta.partial || !cached.fresh,
    },
    limitations: [
      ...cached.payload.limitations,
      ...(!cached.fresh ? ['The scheduled aggregate snapshot is stale; no live source scan was triggered by this request.'] : []),
    ],
  });
}
