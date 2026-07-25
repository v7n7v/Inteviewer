import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { hashAuthIdentifier, normalizeAuthEmail } from '@/lib/auth-action-links';
import { sendEmailEventResult } from '@/lib/email';

export const runtime = 'nodejs';

interface FirebaseResetResponse {
  email?: unknown;
  requestType?: unknown;
  error?: { message?: unknown };
}

export async function POST(request: NextRequest) {
  let body: { oobCode?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return resetError('auth/invalid-action-code', 400);
  }

  const oobCode = typeof body.oobCode === 'string' ? body.oobCode.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!oobCode || oobCode.length > 2_048) return resetError('auth/invalid-action-code', 400);
  if (newPassword.length < 6 || newPassword.length > 4_096) return resetError('auth/weak-password', 400);

  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const [ipLimit, codeLimit] = await Promise.all([
    checkRateLimit(`password-reset-complete:ip:${hashAuthIdentifier(ip)}`, 8, 15 * 60 * 1000),
    checkRateLimit(`password-reset-complete:code:${hashAuthIdentifier(oobCode)}`, 5, 60 * 60 * 1000),
  ]);
  if (!ipLimit.allowed || !codeLimit.allowed) return resetError('auth/too-many-requests', 429);

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: 'Password reset is temporarily unavailable.' }, { status: 503 });

  let provider: FirebaseResetResponse;
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oobCode, newPassword }),
      cache: 'no-store',
    });
    provider = await response.json() as FirebaseResetResponse;
    if (!response.ok) return resetError(mapFirebaseResetError(provider.error?.message), 400);
  } catch {
    return NextResponse.json({ error: 'Password reset is temporarily unavailable.' }, { status: 503 });
  }

  const email = normalizeAuthEmail(provider.email);
  if (!email || provider.requestType !== 'PASSWORD_RESET') {
    return resetError('auth/invalid-action-code', 400);
  }

  try {
    const user = await getAdminAuth().getUserByEmail(email);
    if (user.email) {
      const delivery = await sendEmailEventResult(user.email, 'security.password_changed', {
        recipientName: user.displayName || undefined,
        changedAt: new Date().toISOString(),
        secureAccountUrl: 'https://talentconsulting.io/auth/reset-password',
      }, { idempotencyKey: `password-changed-${hashAuthIdentifier(oobCode)}` });
      if (!delivery.ok) console.warn('[auth:password-reset-complete] Password changed, but its confirmation email was not accepted.');
    }
  } catch {
    // The reset has already succeeded. Never turn that success into a retry that
    // would make the now-single-use Firebase code look invalid to the customer.
    console.warn('[auth:password-reset-complete] Password changed, but confirmation processing failed.');
  }

  return NextResponse.json({ complete: true }, { headers: { 'Cache-Control': 'no-store' } });
}

function mapFirebaseResetError(value: unknown): string {
  const code = typeof value === 'string' ? value.split(' : ')[0].trim() : '';
  if (code === 'EXPIRED_OOB_CODE') return 'auth/expired-action-code';
  if (code === 'USER_DISABLED') return 'auth/user-disabled';
  if (code === 'WEAK_PASSWORD' || code === 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS') return 'auth/weak-password';
  return 'auth/invalid-action-code';
}

function resetError(code: string, status: number) {
  return NextResponse.json({ error: 'This secure action could not be completed.', code }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
