import { NextResponse, NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { guardApiRoute } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req);
    if (guard.error) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getAdminDb();
    const snapshot = await db
      .collection('study_vault')
      .where('userId', '==', guard.user?.uid || 'anonymous')
      .limit(50)
      .get();

    const notes = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      // Sort client-side: newest first (avoids composite index requirement)
      .sort((a: any, b: any) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    return NextResponse.json({ notes });
  } catch (error: unknown) {
    console.error('[api/vault/list] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch vault items' }, { status: 500 });
  }
}
