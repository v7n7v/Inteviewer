import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getAdminAuth } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendEmailEventResult } from '@/lib/email';

const allowedEvents = new Set(['password_changed', 'email_changed']);

export async function POST(request: NextRequest) {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { event?: unknown } | null;
  const event = typeof body?.event === 'string' ? body.event : '';
  if (!allowedEvents.has(event)) return NextResponse.json({ error: 'Unsupported confirmation event.' }, { status: 400 });

  const rate = await checkRateLimit(`security-confirmation:${authenticated.uid}:${event}`, 4, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: 'Too many confirmation requests.' }, { status: 429 });

  const user = await getAdminAuth().getUser(authenticated.uid);
  if (!user.email) return NextResponse.json({ error: 'Account does not have an email address.' }, { status: 400 });
  const occurredAt = new Date().toISOString();
  const result = event === 'password_changed'
    ? await sendEmailEventResult(user.email, 'security.password_changed', {
        recipientName: user.displayName || undefined,
        changedAt: occurredAt,
        secureAccountUrl: 'https://talentconsulting.io/auth/reset-password',
      })
    : await sendEmailEventResult(user.email, 'security.email_changed', {
      recipientName: user.displayName || undefined,
      occurredAt,
        securityUrl: 'https://talentconsulting.io/suite/settings',
      });

  return NextResponse.json({ accepted: result.ok }, { status: result.ok ? 202 : 503 });
}
