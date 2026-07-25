import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getAdminAuth } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildCustomAuthActionUrl, normalizeAuthEmail, resolveAuthActionOrigin } from '@/lib/auth-action-links';
import { createEmailChangeState, markEmailChangeDeliveryFailed } from '@/lib/email-change-state';
import { sendEmailEventResult } from '@/lib/email';

export async function POST(request: NextRequest) {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { newEmail?: unknown } | null;
  const newEmail = normalizeAuthEmail(body?.newEmail);
  if (!newEmail) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });

  const rate = await checkRateLimit(`email-change:${authenticated.uid}`, 3, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: 'Too many email-change requests.' }, { status: 429 });

  const auth = getAdminAuth();
  const user = await auth.getUser(authenticated.uid);
  const currentEmail = normalizeAuthEmail(user.email);
  if (!currentEmail) return NextResponse.json({ error: 'Account does not have an email address.' }, { status: 400 });
  if (currentEmail === newEmail) return NextResponse.json({ error: 'That is already your account email.' }, { status: 400 });

  const origin = resolveAuthActionOrigin(request.nextUrl.origin);
  const state = await createEmailChangeState({ uid: user.uid, purpose: 'change', currentEmail, targetEmail: newEmail });
  const generatedLink = await auth.generateVerifyAndChangeEmailLink(currentEmail, newEmail, {
    url: `${origin}/auth/reset-password`,
    handleCodeInApp: false,
  });
  const actionUrl = new URL(buildCustomAuthActionUrl(generatedLink, origin, 'verifyAndChangeEmail'));
  actionUrl.searchParams.set('state', state.state);
  const result = await sendEmailEventResult(newEmail, 'security.email_change_requested', {
    recipientName: user.displayName || undefined,
    actionUrl: actionUrl.toString(),
    expiresInMinutes: 60,
  }, { idempotencyKey: `email-change-${state.requestId}` });

  if (!result.ok) {
    await markEmailChangeDeliveryFailed(state.requestId).catch(() => {});
    return NextResponse.json({ error: 'The verification email could not be sent.' }, { status: 503 });
  }
  return NextResponse.json({ accepted: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
