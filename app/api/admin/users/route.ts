/**
 * Admin API — User Management
 * Only accessible by MASTER_EMAILS accounts.
 * GET  — List users from Firebase Auth
 * POST — Update user tier in Firestore
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { isMasterAccount } from '@/lib/pricing-tiers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { validateBody } from '@/lib/validate';
import { AdminActionSchema } from '@/lib/schemas';

export async function GET(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req);
    if (guard.error) return guard.error;
    if (!isMasterAccount(guard.user.email)) {
      return NextResponse.json({ error: 'Access denied. Admin only.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const pageToken = searchParams.get('pageToken') || undefined;
    const search = searchParams.get('search')?.toLowerCase() || '';
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

    const auth = getAdminAuth();
    const listResult = await auth.listUsers(limit, pageToken);

    let users = listResult.users.map(u => ({
      uid: u.uid,
      email: u.email || '',
      displayName: u.displayName || '',
      createdAt: u.metadata.creationTime,
      lastSignIn: u.metadata.lastSignInTime,
      disabled: u.disabled,
    }));

    // Client-side search filter
    if (search) {
      users = users.filter(u =>
        u.email.toLowerCase().includes(search) ||
        u.displayName.toLowerCase().includes(search) ||
        u.uid.toLowerCase().includes(search)
      );
    }

    // Fetch tiers from Firestore for each user
    const db = getAdminDb();
    const usersWithTier = await Promise.all(
      users.map(async (u) => {
        try {
          const subDoc = await db.collection('users').doc(u.uid).collection('subscription').doc('current').get();
          let tier: string = 'free';
          if (isMasterAccount(u.email)) {
            tier = 'admin';
          } else if (subDoc.exists && subDoc.data()?.status === 'active') {
            const plan = subDoc.data()?.plan;
            if (plan === 'studio') tier = 'max';
            else if (plan === 'pro') tier = 'pro';
          }
          return { ...u, tier };
        } catch {
          return { ...u, tier: isMasterAccount(u.email) ? 'admin' : 'free' };
        }
      })
    );

    return NextResponse.json({
      users: usersWithTier,
      nextPageToken: listResult.pageToken || null,
      total: users.length,
    });
  } catch (error: unknown) {
    console.error('[api/admin/users] GET error:', error);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req);
    if (guard.error) return guard.error;
    if (!isMasterAccount(guard.user.email)) {
      return NextResponse.json({ error: 'Access denied. Admin only.' }, { status: 403 });
    }

    const validated = await validateBody(req, AdminActionSchema);
    if (!validated.success) return validated.error;
    const { action, uid, email } = validated.data;

    const db = getAdminDb();
    const auth = getAdminAuth();

    switch (action) {
      case 'set_max': {
        await db.collection('users').doc(uid).collection('subscription').doc('current').set({
          plan: 'studio',
          status: 'active',
          grantedBy: guard.user.email,
          grantedAt: new Date().toISOString(),
          source: 'admin',
        }, { merge: true });
        return NextResponse.json({ success: true, message: `User ${email || uid} upgraded to Max` });
      }

      case 'set_pro': {
        await db.collection('users').doc(uid).collection('subscription').doc('current').set({
          plan: 'pro',
          status: 'active',
          grantedBy: guard.user.email,
          grantedAt: new Date().toISOString(),
          source: 'admin',
        }, { merge: true });
        return NextResponse.json({ success: true, message: `User ${email || uid} upgraded to Pro` });
      }

      case 'set_free': {
        await db.collection('users').doc(uid).collection('subscription').doc('current').set({
          plan: 'free',
          status: 'inactive',
          revokedBy: guard.user.email,
          revokedAt: new Date().toISOString(),
          source: 'admin',
        }, { merge: true });
        return NextResponse.json({ success: true, message: `User ${email || uid} set to Free tier` });
      }

      case 'disable': {
        await auth.updateUser(uid, { disabled: true });
        return NextResponse.json({ success: true, message: `User ${email || uid} disabled` });
      }

      case 'enable': {
        await auth.updateUser(uid, { disabled: false });
        return NextResponse.json({ success: true, message: `User ${email || uid} enabled` });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('[api/admin/users] POST error:', error);
    return NextResponse.json({ error: 'Admin action failed' }, { status: 500 });
  }
}
