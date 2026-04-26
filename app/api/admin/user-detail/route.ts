/**
 * Admin User Detail API — Deep-dive into a single user
 * GET /api/admin/user-detail?uid=X
 * 
 * Returns: profile, subscription, usage (lifetime + voice + writing), debrief count
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { isMasterAccount } from '@/lib/pricing-tiers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req);
    if (guard.error) return guard.error;
    if (!isMasterAccount(guard.user.email)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const uid = new URL(req.url).searchParams.get('uid');
    if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });

    const auth = getAdminAuth();
    const db = getAdminDb();

    // Auth record
    let authUser;
    try {
      authUser = await auth.getUser(uid);
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Subscription
    let subscription = null;
    try {
      const subDoc = await db.collection('users').doc(uid).collection('subscription').doc('current').get();
      if (subDoc.exists) subscription = subDoc.data();
    } catch { /* no sub */ }

    // Lifetime usage
    let usage = null;
    try {
      const usageDoc = await db.collection('users').doc(uid).collection('usage').doc('lifetime').get();
      if (usageDoc.exists) usage = usageDoc.data();
    } catch { /* no usage */ }

    // Voice monthly
    let voice = null;
    try {
      const voiceDoc = await db.collection('users').doc(uid).collection('usage').doc('voice_monthly').get();
      if (voiceDoc.exists) voice = voiceDoc.data();
    } catch { /* no voice */ }

    // Writing monthly
    let writing = null;
    try {
      const writingDoc = await db.collection('users').doc(uid).collection('usage').doc('writing_monthly').get();
      if (writingDoc.exists) writing = writingDoc.data();
    } catch { /* no writing */ }

    // Profile
    let profile = null;
    try {
      const profileDoc = await db.collection('users').doc(uid).get();
      if (profileDoc.exists) profile = profileDoc.data();
    } catch { /* no profile */ }

    // Debrief count
    let debriefCount = 0;
    try {
      const debriefSnap = await db.collection('users').doc(uid).collection('debriefs').count().get();
      debriefCount = debriefSnap.data().count;
    } catch { /* no debriefs */ }

    return NextResponse.json({
      auth: {
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
        createdAt: authUser.metadata.creationTime,
        lastSignIn: authUser.metadata.lastSignInTime,
        disabled: authUser.disabled,
        emailVerified: authUser.emailVerified,
        providerData: authUser.providerData?.map(p => ({ providerId: p.providerId, email: p.email })),
      },
      subscription,
      usage,
      voice,
      writing,
      profile,
      debriefCount,
    });
  } catch (error) {
    console.error('[api/admin/user-detail] error:', error);
    return NextResponse.json({ error: 'Failed to fetch user detail' }, { status: 500 });
  }
}
