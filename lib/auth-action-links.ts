import { createHash } from 'crypto';

const forwardedActionParameters = ['apiKey', 'lang'] as const;

export function normalizeAuthEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function hashAuthIdentifier(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export function resolveAuthActionOrigin(requestOrigin?: string): string {
  const configured = process.env.EMAIL_AUTH_ACTION_ORIGIN?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || (process.env.NODE_ENV === 'development' ? requestOrigin : undefined)
    || 'https://talentconsulting.io';

  const url = new URL(configured);
  const isLocalDevelopment = process.env.NODE_ENV === 'development'
    && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !(isLocalDevelopment && url.protocol === 'http:')) {
    throw new Error('Auth action origin must use HTTPS');
  }
  return url.origin;
}

export function buildCustomAuthActionUrl(
  generatedLink: string,
  actionOrigin: string,
  expectedMode: 'resetPassword' | 'verifyEmail' | 'recoverEmail' | 'verifyAndChangeEmail',
  targetMode = expectedMode,
): string {
  const generated = new URL(generatedLink);
  const oobCode = generated.searchParams.get('oobCode');
  const generatedMode = generated.searchParams.get('mode');
  if (!oobCode || (generatedMode && generatedMode !== expectedMode)) {
    throw new Error('Firebase generated an invalid auth action link');
  }

  const target = new URL('/auth/reset-password', resolveAuthActionOrigin(actionOrigin));
  target.searchParams.set('mode', targetMode);
  target.searchParams.set('oobCode', oobCode);
  for (const parameter of forwardedActionParameters) {
    const value = generated.searchParams.get(parameter);
    if (value) target.searchParams.set(parameter, value);
  }
  return target.toString();
}
