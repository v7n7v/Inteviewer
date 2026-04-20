import { NextRequest } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 30, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  const db = getAdminDb();

  try {
    // Get latest resume from vault or resume-versions
    const vaultSnap = await db.collection('users').doc(uid).collection('vault')
      .orderBy('createdAt', 'desc').limit(1).get();

    if (vaultSnap.empty) {
      // Try resume-versions as fallback
      const versionsSnap = await db.collection('users').doc(uid).collection('resume-versions')
        .orderBy('createdAt', 'desc').limit(1).get();
      if (versionsSnap.empty) {
        return new Response(JSON.stringify({ resume: null }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const data = versionsSnap.docs[0].data();
      return new Response(JSON.stringify({ resume: data.resume || data }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = vaultSnap.docs[0].data();
    return new Response(JSON.stringify({ resume: data.resume || data.parsed || data }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, resume: null }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
