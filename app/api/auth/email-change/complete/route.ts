import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { buildCustomAuthActionUrl, resolveAuthActionOrigin } from '@/lib/auth-action-links';
import { consumeEmailChangeState, createEmailChangeState, markEmailChangeDeliveryFailed } from '@/lib/email-change-state';
import { sendEmailEventResult } from '@/lib/email';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { state?: unknown } | null;
  const state = typeof body?.state === 'string' ? body.state : '';
  let completed: Awaited<ReturnType<typeof consumeEmailChangeState>>;
  try {
    completed = await consumeEmailChangeState(state);
  } catch {
    return NextResponse.json({ error: 'Email change confirmation is invalid, expired, or already used.' }, { status: 400 });
  }

  const auth = getAdminAuth();
  const user = await auth.getUser(completed.uid);
  const occurredAt = new Date().toISOString();
  const notices: Array<Promise<unknown>> = [
    sendEmailEventResult(completed.currentEmail, 'security.email_changed', {
      recipientName: user.displayName || undefined,
      occurredAt,
      securityUrl: 'https://talentconsulting.io/suite/settings',
    }, { idempotencyKey: `email-changed-${completed.requestId}` }),
  ];

  if (completed.purpose === 'change') {
    try {
      const recovery = await createEmailChangeState({
        uid: completed.uid,
        purpose: 'recovery',
        currentEmail: completed.currentEmail,
        targetEmail: completed.previousEmail,
      });
      const origin = resolveAuthActionOrigin(request.nextUrl.origin);
      const generatedLink = await auth.generateVerifyAndChangeEmailLink(completed.currentEmail, completed.previousEmail, {
        url: `${origin}/auth/reset-password`,
        handleCodeInApp: false,
      });
      const recoveryUrl = new URL(buildCustomAuthActionUrl(generatedLink, origin, 'verifyAndChangeEmail', 'recoverEmail'));
      recoveryUrl.searchParams.set('state', recovery.state);
      notices.push(sendEmailEventResult(completed.previousEmail, 'security.email_recovery_requested', {
        recipientName: user.displayName || undefined,
        actionUrl: recoveryUrl.toString(),
        expiresInMinutes: 60,
      }, { idempotencyKey: `email-recovery-${recovery.requestId}` }).then(async result => {
        if (!result.ok) await markEmailChangeDeliveryFailed(recovery.requestId).catch(() => {});
        return result;
      }));
    } catch {
      console.warn('[auth:email-change-complete] Email changed, but the recovery action could not be prepared.');
    }
  }

  await Promise.all(notices).catch(() => {
    console.warn('[auth:email-change-complete] Email changed, but one or more security notices were not accepted.');
  });
  return NextResponse.json({ complete: true, purpose: completed.purpose }, { headers: { 'Cache-Control': 'no-store' } });
}
