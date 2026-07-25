import { NextRequest } from 'next/server';
import type { UserRecord } from 'firebase-admin/auth';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { adminJson } from '@/lib/admin/http';
import { checkRateLimitStrict } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function boundedLimit(value: string | null) {
  const parsed = Number(value || 25);
  return Math.min(Math.max(Number.isFinite(parsed) ? Math.floor(parsed) : 25, 1), 50);
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'users.read');
  if (guard.error) return guard.error;

  const params = new URL(request.url).searchParams;
  const limit = boundedLimit(params.get('limit'));
  const rawSearch = String(params.get('search') || '').trim().slice(0, 160);
  const normalizedSearch = rawSearch.toLowerCase();
  if (params.get('pageToken')) {
    return adminJson(
      { error: 'Directory pagination is disabled. Use an exact email or UID lookup.', code: 'ADMIN_USER_ENUMERATION_BLOCKED' },
      { status: 400 },
    );
  }
  if (guard.actor.role !== 'owner' && !rawSearch) {
    return adminJson(
      { error: 'Enter an exact email address or Firebase UID.', code: 'ADMIN_USER_EXACT_LOOKUP_REQUIRED' },
      { status: 400 },
    );
  }
  const limiter = await checkRateLimitStrict(`admin-user-directory:${guard.actor.uid}`, 30, 60_000);
  if ((limiter.unavailable && process.env.NODE_ENV === 'production') || (!limiter.unavailable && !limiter.allowed)) {
    return adminJson(
      { error: 'User lookup is temporarily rate limited.', code: 'ADMIN_USERS_RATE_LIMITED' },
      { status: limiter.unavailable ? 503 : 429 },
    );
  }
  try {
    const auth = getAdminAuth();
    let exactUser: UserRecord | null = null;
    if (rawSearch) {
      try {
        exactUser = rawSearch.includes('@')
          ? await auth.getUserByEmail(normalizedSearch)
          : /^[A-Za-z0-9:_-]{1,128}$/.test(rawSearch)
            ? await auth.getUser(rawSearch)
            : null;
      } catch (error) {
        if ((error as { code?: string })?.code !== 'auth/user-not-found') throw error;
      }
    }
    const result = !exactUser && (guard.actor.role === 'owner' || !rawSearch)
      ? await auth.listUsers(limit)
      : { users: [] as UserRecord[], pageToken: undefined };
    const visibleUsers = exactUser
      ? [exactUser]
      : rawSearch && guard.actor.role === 'owner'
        ? result.users.filter(user => (
          user.uid.toLowerCase().includes(normalizedSearch)
          || String(user.email || '').toLowerCase().includes(normalizedSearch)
          || String(user.displayName || '').toLowerCase().includes(normalizedSearch)
        ))
        : rawSearch
          ? []
          : result.users;
    const db = getAdminDb();
    const subscriptionRefs = visibleUsers.map(user => (
      db.collection('users').doc(user.uid).collection('subscription').doc('current')
    ));
    const subscriptionSnapshots = subscriptionRefs.length ? await db.getAll(...subscriptionRefs) : [];
    const subscriptions = new Map(
      subscriptionSnapshots.map(snapshot => [snapshot.ref.parent.parent?.id || '', snapshot.data() || {}]),
    );
    const users = visibleUsers.map(user => {
      const subscription = subscriptions.get(user.uid) || {};
      return {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        createdAt: user.metadata.creationTime || null,
        lastSignInAt: user.metadata.lastSignInTime || null,
        plan: subscription.plan === 'pro' || subscription.plan === 'studio' ? subscription.plan : 'free',
        subscriptionStatus: typeof subscription.status === 'string' ? subscription.status : 'none',
        billingEvidenceStatus: subscription.billingEvidenceStatus === 'complete' || subscription.billingEvidenceStatus === 'incomplete'
          ? subscription.billingEvidenceStatus
          : 'unknown',
      };
    });

    return adminJson(
      {
        users,
        nextPageToken: null,
        meta: {
          requestId: crypto.randomUUID(),
          generatedAt: new Date().toISOString(),
          staleAfterMs: 60_000,
          partial: Boolean(rawSearch && !exactUser && guard.actor.role === 'owner'),
          truncated: Boolean(!rawSearch && result.pageToken),
          searchMode: exactUser ? 'exact' : rawSearch ? 'bounded_owner_page' : 'owner_browse_window',
          enumerationBlocked: true,
        },
      },
    );
  } catch (error) {
    console.error('[admin/users] list failed', error);
    return adminJson(
      { error: 'The user directory is temporarily unavailable.', code: 'ADMIN_USERS_UNAVAILABLE' },
      { status: 503 },
    );
  }
}
