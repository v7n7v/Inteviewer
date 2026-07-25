import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { adminJson } from '@/lib/admin/http';
import type { AdminCostResponse } from '@/lib/admin/contracts';
import { readAdminAggregateCache } from '@/lib/admin/aggregate-cache';
import { ADMIN_COST_CACHE_WINDOWS } from '@/lib/admin/aggregate-materializer';
import { isAdminCostSnapshot } from '@/lib/admin/aggregate-contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Finance reads one scheduled, server-owned materialized snapshot. Opening or
 * polling Admin never performs a subscription scan or Taco economics query.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'billing.read');
  if (guard.error) return guard.error;

  const requestedWindow = Number(request.nextUrl.searchParams.get('windowDays') || 30);
  const windowDays = ADMIN_COST_CACHE_WINDOWS.includes(
    requestedWindow as (typeof ADMIN_COST_CACHE_WINDOWS)[number],
  )
    ? requestedWindow
    : 30;
  const cached = await readAdminAggregateCache<AdminCostResponse>(
    getAdminDb(),
    `costs_v2_${windowDays}`,
    isAdminCostSnapshot,
  );
  if (!cached.payload) {
    return adminJson(
      {
        error: 'The scheduled Finance snapshot is not available yet.',
        code: 'ADMIN_COSTS_SNAPSHOT_UNAVAILABLE',
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
