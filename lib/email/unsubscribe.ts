import { createHmac, timingSafeEqual } from 'crypto';
import { EMAIL_PREFERENCE_KEYS, type EmailPreferenceKey } from './contracts';

interface UnsubscribeClaims {
  v: 1;
  uid: string;
  preference: EmailPreferenceKey;
  exp: number;
}

export function createEmailUnsubscribeToken(
  uid: string,
  preference: EmailPreferenceKey,
  expiresAt = Date.now() + 180 * 24 * 60 * 60 * 1000,
): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('Invalid unsubscribe user identifier');
  if (!(EMAIL_PREFERENCE_KEYS as readonly string[]).includes(preference)) throw new Error('Invalid email preference category');
  const claims: UnsubscribeClaims = { v: 1, uid, preference, exp: Math.floor(expiresAt / 1000) };
  const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifyEmailUnsubscribeToken(token: string, now = Date.now()): UnsubscribeClaims | null {
  const [encoded, suppliedSignature, extra] = token.split('.');
  if (!encoded || !suppliedSignature || extra || encoded.length > 1_000 || suppliedSignature.length > 200) return null;
  let expectedSignature: string;
  try {
    expectedSignature = sign(encoded);
  } catch {
    return null;
  }
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<UnsubscribeClaims>;
    if (
      claims.v !== 1
      || typeof claims.uid !== 'string'
      || !/^[A-Za-z0-9_-]{1,128}$/.test(claims.uid)
      || typeof claims.preference !== 'string'
      || !(EMAIL_PREFERENCE_KEYS as readonly string[]).includes(claims.preference)
      || typeof claims.exp !== 'number'
      || !Number.isSafeInteger(claims.exp)
      || claims.exp * 1000 <= now
    ) return null;
    return claims as UnsubscribeClaims;
  } catch {
    return null;
  }
}

export function buildEmailUnsubscribeUrl(uid: string, preference: EmailPreferenceKey): string {
  const origin = process.env.EMAIL_AUTH_ACTION_ORIGIN?.trim() || 'https://talentconsulting.io';
  const url = new URL('/email/unsubscribe', origin);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'development' && url.hostname === 'localhost')) {
    throw new Error('Email unsubscribe origin must use HTTPS');
  }
  url.searchParams.set('token', createEmailUnsubscribeToken(uid, preference));
  return url.toString();
}

function sign(value: string): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET?.trim();
  if (!secret || secret.length < 32 || /replace|placeholder|example/i.test(secret)) {
    throw new Error('EMAIL_UNSUBSCRIBE_SECRET must be a non-placeholder secret of at least 32 characters');
  }
  return createHmac('sha256', secret).update(value).digest('base64url');
}
