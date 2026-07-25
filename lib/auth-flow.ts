'use client';

export type AuthMethod = 'email' | 'google' | 'mfa';
export type AuthLifecycleResult = 'success' | 'cancelled' | 'redirecting' | 'error';
export type AuthHostnameClass = 'localhost' | 'production' | 'firebase-hosting' | 'other';

export interface NormalizedAuthError {
  code: string;
  message: string;
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/account-exists-with-different-credential':
    'This email is already linked to another sign-in method. Sign in with email first, then connect Google in settings.',
  'auth/email-already-in-use': 'An account already exists for this email. Try signing in instead.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/network-request-failed': 'A network error interrupted sign-in. Check your connection and try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled right now.',
  'auth/popup-blocked': 'Your browser blocked Google sign-in. Allow popups for this site and try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
  'auth/unauthorized-domain': 'Google sign-in is not configured for this domain yet.',
  'auth/user-disabled': 'This account has been disabled. Contact support for help.',
  'auth/user-not-found': 'Invalid email or password.',
  'auth/weak-password': 'Choose a stronger password and try again.',
  'auth/web-storage-unsupported':
    'Your browser is blocking the secure storage sign-in needs. Enable site storage or use email sign-in.',
  'auth/wrong-password': 'Invalid email or password.',
};

const POPUP_CANCELLATION_CODES = new Set([
  'auth/cancelled-popup-request',
  'auth/popup-closed-by-user',
]);

const REDIRECT_FALLBACK_CODES = new Set([
  'auth/operation-not-supported-in-this-environment',
  'auth/popup-blocked',
]);

export const mfaEnrollmentEnabled = process.env.NEXT_PUBLIC_MFA_ENABLED === 'true';

export function getAuthErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'auth/unknown';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && /^auth\/[a-z0-9-]+$/i.test(code)
    ? code.toLowerCase()
    : 'auth/unknown';
}

export function normalizeAuthError(error: unknown): NormalizedAuthError {
  const code = getAuthErrorCode(error);
  return {
    code,
    message: AUTH_MESSAGES[code] || 'Authentication could not finish. Please try again.',
  };
}

export function isPopupCancellation(error: unknown): boolean {
  return POPUP_CANCELLATION_CODES.has(getAuthErrorCode(error));
}

export function shouldUseRedirectFallback(error: unknown): boolean {
  return REDIRECT_FALLBACK_CODES.has(getAuthErrorCode(error));
}

export function canUseSameOriginAuthRedirect(
  configuredAuthDomain: string | null | undefined,
  currentHostname: string | null | undefined,
): boolean {
  if (!configuredAuthDomain || !currentHostname) return false;
  const authDomain = configuredAuthDomain.trim().toLowerCase();
  const hostname = currentHostname.trim().toLowerCase();
  if (!authDomain || !hostname || authDomain.includes('/') || authDomain.includes(':')) return false;
  return authDomain === hostname;
}

export function classifyAuthHostname(hostname: string | null | undefined): AuthHostnameClass {
  const normalized = hostname?.trim().toLowerCase() || '';
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
    return 'localhost';
  }
  if (normalized === 'talentconsulting.io') {
    return 'production';
  }
  if (normalized.endsWith('.firebaseapp.com') || normalized.endsWith('.web.app')) {
    return 'firebase-hosting';
  }
  return 'other';
}

export function reportSanitizedAuthIssue(scope: string, error: unknown) {
  // Firebase error objects may include identifiers or credentials. Only emit the normalized code.
  console.warn(`[auth:${scope}]`, { code: getAuthErrorCode(error) });
}
