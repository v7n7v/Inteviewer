import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  COMMUNICATION_PREFERENCES_DOCUMENT,
  COMMUNICATION_PREFERENCES_VERSION,
  communicationPreferencePatchSchema,
  readCommunicationPreferences,
} from '@/lib/communication-preferences';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const guard = await guardApiRoute(request, { rateLimit: 30, rateLimitWindow: 60_000, skipUsageCap: true });
  if (guard.error) return guard.error;

  try {
    const preferences = await readCommunicationPreferences(guard.user.uid);
    return NextResponse.json({ success: true, preferences }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[communication-preferences] Read failed.', { code: providerCode(error) });
    return NextResponse.json({ error: 'Email preferences could not be loaded.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await guardApiRoute(request, { rateLimit: 20, rateLimitWindow: 60_000, skipUsageCap: true });
  if (guard.error) return guard.error;

  const parsed = communicationPreferencePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email preference update.' }, { status: 400 });
  }
  if (parsed.data.marketing === true) {
    return NextResponse.json({
      error: 'Marketing email is not available yet. Transactional and opted-in product email remain separate.',
      code: 'MARKETING_EMAIL_DISABLED',
    }, { status: 409 });
  }

  try {
    const db = getAdminDb();
    const docRef = db.collection('users').doc(guard.user.uid).collection('settings').doc(COMMUNICATION_PREFERENCES_DOCUMENT);
    const now = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(docRef);
      const revision = typeof current.data()?.revision === 'number' ? current.data()!.revision : 0;
      transaction.set(docRef, {
        ...parsed.data,
        marketing: false,
        version: COMMUNICATION_PREFERENCES_VERSION,
        revision: revision + 1,
        updatedAt: now,
        updatedSource: 'suite_settings',
      }, { merge: true });
    });

    const preferences = await readCommunicationPreferences(guard.user.uid);
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('[communication-preferences] Update failed.', { code: providerCode(error) });
    return NextResponse.json({ error: 'Email preferences could not be saved.' }, { status: 500 });
  }
}

function providerCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'unknown';
  return String((error as { code?: unknown }).code || 'unknown').slice(0, 80);
}
