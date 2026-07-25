import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { materializeAdminAggregateSnapshots } from '@/lib/admin/aggregate-materializer';
import { materializeObservabilityAggregate } from '@/lib/observability/aggregate';
import { observabilitySurfaceAvailable } from '@/lib/observability/config';
import { processQueuedObservabilityResetJobs } from '@/lib/observability/reset';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authorization = request.headers.get('authorization');
  const supplied = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : request.headers.get('x-cron-secret') || '';
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }
  const db = getAdminDb();
  const result = await materializeAdminAggregateSnapshots(getAdminAuth(), db);
  const [observability, resets] = await Promise.allSettled([
    observabilitySurfaceAvailable()
      ? materializeObservabilityAggregate(db)
      : Promise.resolve({ published: false, preserved: true, partial: false, disabled: true }),
    processQueuedObservabilityResetJobs(db),
  ]);
  return NextResponse.json(
    {
      success: true,
      ...result,
      observability: observability.status === 'fulfilled'
        ? observability.value
        : { published: false, preserved: true, partial: true, error: 'materialization_unavailable' },
      observabilityResets: resets.status === 'fulfilled'
        ? resets.value
        : { inspected: 0, completed: 0, running: 0, failed: 1, overdue: 0 },
    },
    {
      status: result.skipped ? 202 : 200,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    },
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}
