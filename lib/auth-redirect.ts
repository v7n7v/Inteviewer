'use client';

const PENDING_AUTH_REDIRECT_KEY = 'talentconsulting.pendingAuthRedirect';

export function isSafeLocalPath(path: string | null | undefined): path is string {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path) || /%(?![0-9a-f]{2})/i.test(path)) return false;

  try {
    const origin = 'https://talentconsulting.invalid';
    const resolved = new URL(path, origin);
    return resolved.origin === origin
      && resolved.username === ''
      && resolved.password === ''
      && resolved.pathname.startsWith('/');
  } catch {
    return false;
  }
}

export function setPendingAuthRedirect(path: string | null | undefined) {
  if (typeof window === 'undefined') return;
  try {
    if (!isSafeLocalPath(path)) {
      window.sessionStorage.removeItem(PENDING_AUTH_REDIRECT_KEY);
      return;
    }
    window.sessionStorage.setItem(PENDING_AUTH_REDIRECT_KEY, path);
  } catch {
    // Redirect preservation is best-effort when browser storage is blocked.
  }
}

export function clearPendingAuthRedirect() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_AUTH_REDIRECT_KEY);
  } catch {
    // Browser storage may be unavailable in privacy-restricted contexts.
  }
}

export function consumePendingAuthRedirect() {
  if (typeof window === 'undefined') return null;

  try {
    const path = window.sessionStorage.getItem(PENDING_AUTH_REDIRECT_KEY);
    window.sessionStorage.removeItem(PENDING_AUTH_REDIRECT_KEY);
    return isSafeLocalPath(path) ? path : null;
  } catch {
    return null;
  }
}
