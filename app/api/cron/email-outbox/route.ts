import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dispatchEmailOutboxBatch, inspectEmailOutboxBacklog } from '@/lib/email/outbox';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limitValue = Number(request.nextUrl.searchParams.get('limit') || 20);
  const result = await dispatchEmailOutboxBatch(Number.isFinite(limitValue) ? limitValue : 20);
  const backlog = await inspectEmailOutboxBacklog();
  return NextResponse.json({ success: true, ...result, backlog });
}

export async function GET(request: NextRequest) {
  return POST(request);
}

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authorization = request.headers.get('authorization');
  const supplied = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : request.headers.get('x-cron-secret') || '';
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}
