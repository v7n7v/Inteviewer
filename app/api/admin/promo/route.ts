/**
 * Admin Promo API
 * GET  /api/admin/promo — Read current promo state (public)
 * POST /api/admin/promo — Toggle promo on/off (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { monitor } from '@/lib/monitor';

const MASTER_EMAILS = ['alula2006@gmail.com'];
const PROMO_DOC = 'settings/promo';

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.doc(PROMO_DOC).get();
    const data = snap.exists ? snap.data() : { active: false };
    return NextResponse.json(data);
  } catch (err) {
    console.error('[admin/promo] GET error:', err);
    return NextResponse.json({ active: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!decoded.email || !MASTER_EMAILS.includes(decoded.email.toLowerCase())) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { active, headline, code, ctaText } = body;

    const db = getAdminDb();
    await db.doc(PROMO_DOC).set({
      active: !!active,
      headline: headline || '🚀 Limited Time — 50% off Pro for 3 months!',
      code: code || 'LAUNCH50',
      ctaText: ctaText || 'Claim Offer',
      updatedAt: new Date().toISOString(),
      updatedBy: decoded.email,
    }, { merge: true });

    monitor.info(
      active ? 'Promo Enabled' : 'Promo Disabled',
      `${decoded.email} ${active ? 'activated' : 'deactivated'} promo: ${code || 'LAUNCH50'}`
    );

    return NextResponse.json({ success: true, active: !!active });
  } catch (err) {
    console.error('[admin/promo] POST error:', err);
    monitor.critical('Tool: admin/promo', String(err));
    return NextResponse.json({ error: 'Failed to update promo' }, { status: 500 });
  }
}
