import { after, NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendEmailEventResult } from '@/lib/email';
import {
  buildCustomAuthActionUrl,
  hashAuthIdentifier,
  normalizeAuthEmail,
  resolveAuthActionOrigin,
} from '@/lib/auth-action-links';

export const runtime = 'nodejs';

const GENERIC_RESPONSE = {
  accepted: true,
  message: 'If an account exists for that email, a password reset link will arrive shortly.',
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const email = normalizeAuthEmail((body as { email?: unknown } | null)?.email);
  if (!email) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit(`password-reset:ip:${hashAuthIdentifier(ip)}`, 5, 15 * 60 * 1000),
    checkRateLimit(`password-reset:email:${hashAuthIdentifier(email)}`, 3, 60 * 60 * 1000),
  ]);

  if (!ipLimit.allowed || !emailLimit.allowed) {
    const resetIn = Math.max(ipLimit.resetIn, emailLimit.resetIn);
    return NextResponse.json(
      { error: 'Too many reset requests. Wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil(resetIn / 1000))) } },
    );
  }

  const actionOrigin = resolveAuthActionOrigin(request.nextUrl.origin);
  after(async () => {
    try {
      const auth = getAdminAuth();
      const user = await auth.getUserByEmail(email);
      if (!user.email) return;
      const generatedLink = await auth.generatePasswordResetLink(user.email, {
        url: `${actionOrigin}/auth/reset-password`,
        handleCodeInApp: false,
      });
      const actionUrl = buildCustomAuthActionUrl(generatedLink, actionOrigin, 'resetPassword');
      const result = await sendEmailEventResult(
        user.email,
        'security.password_reset_requested',
        {
          recipientName: user.displayName || undefined,
          actionUrl,
          expiresInMinutes: 60,
        },
        { idempotencyKey: `password-reset-${hashAuthIdentifier(actionUrl)}` },
      );
      if (!result.ok) {
        console.warn('[auth:password-reset] Branded email was not accepted by the provider.');
      }
    } catch (error: unknown) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
      if (code !== 'auth/user-not-found') {
        console.warn('[auth:password-reset] Reset work could not be completed.', { code: code || 'unknown' });
      }
    }
  });

  return NextResponse.json(GENERIC_RESPONSE, {
    status: 202,
    headers: { 'Cache-Control': 'no-store' },
  });
}
