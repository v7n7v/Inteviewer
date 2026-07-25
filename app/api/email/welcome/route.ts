/**
 * Welcome Email API — POST /api/email/welcome
 * Queues one welcome email per account after signup.
 */
import { NextRequest, NextResponse } from 'next/server';
import { monitor } from '@/lib/monitor';
import { authenticateRequest } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAdminAuth } from '@/lib/firebase-admin';
import { enqueueEmail } from '@/lib/email/outbox';

export async function POST(req: NextRequest) {
  try {
    const authUser = await authenticateRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // New Firebase email/password accounts are authenticated before their email
    // is verified. Resolve the address from the authenticated UID without
    // weakening the shared helper's verified-email boundary.
    const userRecord = await getAdminAuth().getUser(authUser.uid);
    if (!userRecord.email) {
      return NextResponse.json({ error: 'Authenticated account has no email' }, { status: 400 });
    }

    const ip = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const { allowed } = await checkRateLimit(`welcome-email:${ip}`, 5, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many welcome email requests' }, { status: 429 });
    }

    const { email, name } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }
    if (normalizedEmail !== userRecord.email.toLowerCase()) {
      return NextResponse.json({ error: 'Email does not match authenticated user' }, { status: 403 });
    }

    const displayName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : normalizedEmail.split('@')[0] || 'there';
    const queued = await enqueueEmail({
      event: 'account.welcome',
      recipient: { kind: 'user', uid: authUser.uid },
      dedupeKey: 'account-welcome:v1',
      payload: { recipientName: displayName },
      metadata: { source: 'signup' },
    });

    return NextResponse.json({ sent: true, queued: true, duplicate: !queued.created, messageId: queued.messageId });
  } catch (error) {
    console.error('[api/email/welcome] Error:', error);
    monitor.critical('Tool: email/welcome', String(error));
    return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 });
  }
}
