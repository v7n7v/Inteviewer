/**
 * Internal Monitor Endpoint
 * Receives security events from middleware (Edge runtime)
 * and forwards to Discord via lib/monitor.ts.
 * POST /api/monitor/alert
 *
 * This is an internal-only route — not exposed to users.
 */
import { NextRequest, NextResponse } from 'next/server';
import { monitor } from '@/lib/monitor';

export async function POST(req: NextRequest) {
  // Simple shared-secret guard — not a user-facing route
  const secret = req.headers.get('x-monitor-secret');
  if (secret !== process.env.DISCORD_WEBHOOK_URL?.slice(-16)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const { severity, title, details, fields } = await req.json();
    monitor.send(severity || 'warning', { title, details, fields });
    return NextResponse.json({ ok: true });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
