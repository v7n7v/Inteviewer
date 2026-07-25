import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { COMMUNICATION_PREFERENCES_DOCUMENT, COMMUNICATION_PREFERENCES_VERSION } from '@/lib/communication-preferences';
import { verifyEmailUnsubscribeToken } from '@/lib/email/unsubscribe';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const claims = verifyEmailUnsubscribeToken(token);
  if (!claims) return NextResponse.json({ valid: false, error: 'This unsubscribe link is invalid or expired.' }, { status: 400 });
  return NextResponse.json({ valid: true, preference: claims.preference }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const token = request.nextUrl.searchParams.get('token') || (typeof body?.token === 'string' ? body.token : '');
  const claims = verifyEmailUnsubscribeToken(token);
  if (!claims) return NextResponse.json({ error: 'This unsubscribe link is invalid or expired.' }, { status: 400 });

  const db = getAdminDb();
  const settings = db.collection('users').doc(claims.uid).collection('settings');
  const now = new Date().toISOString();
  if (claims.preference === 'jobDigest') {
    await settings.doc('jobPreferences').set({
      jobAlertsEnabled: false,
      jobAlertsUnsubscribedAt: now,
      lastUpdated: now,
    }, { merge: true });
  } else {
    const docRef = settings.doc(COMMUNICATION_PREFERENCES_DOCUMENT);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const revision = typeof snapshot.data()?.revision === 'number' ? snapshot.data()!.revision : 0;
      transaction.set(docRef, {
        [claims.preference]: false,
        version: COMMUNICATION_PREFERENCES_VERSION,
        revision: revision + 1,
        updatedAt: now,
        updatedSource: 'signed_category_unsubscribe',
      }, { merge: true });
    });
  }

  return NextResponse.json({ success: true, preference: claims.preference }, { headers: { 'Cache-Control': 'no-store' } });
}
