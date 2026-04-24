/**
 * Job Preferences API — Save/load user job search preferences from Firestore
 * Firestore path: users/{uid}/settings/jobPreferences
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { monitor } from '@/lib/monitor';

export interface JobPreferences {
  targetRoles: string[];
  preferredCities: string[];
  remotePref: 'remote' | 'hybrid' | 'onsite' | 'any';
  salaryMin: number;
  industries: string[];
  emailNotifications: boolean;
  lastUpdated: string;
}

const DEFAULT_PREFS: JobPreferences = {
  targetRoles: [],
  preferredCities: [],
  remotePref: 'any',
  salaryMin: 0,
  industries: [],
  emailNotifications: true,
  lastUpdated: new Date().toISOString(),
};

// GET — Load preferences
export async function GET(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 30, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  try {
    const db = getAdminDb();
    const docRef = db.collection('users').doc(guard.user.uid).collection('settings').doc('jobPreferences');
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ success: true, preferences: DEFAULT_PREFS, isNew: true });
    }

    return NextResponse.json({ success: true, preferences: snap.data() as JobPreferences, isNew: false });
  } catch (error) {
    console.error('[jobs/preferences] GET error:', error);
    monitor.critical('Tool: jobs/preferences', String(error));
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
  }
}

// POST — Save preferences
export async function POST(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 10, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  try {
    const body = await req.json();
    const prefs: JobPreferences = {
      targetRoles: (body.targetRoles || []).slice(0, 10),
      preferredCities: (body.preferredCities || []).slice(0, 10),
      remotePref: ['remote', 'hybrid', 'onsite', 'any'].includes(body.remotePref) ? body.remotePref : 'any',
      salaryMin: Math.max(0, Math.min(500000, parseInt(body.salaryMin) || 0)),
      industries: (body.industries || []).slice(0, 10),
      emailNotifications: body.emailNotifications !== false,
      lastUpdated: new Date().toISOString(),
    };

    const db = getAdminDb();
    const docRef = db.collection('users').doc(guard.user.uid).collection('settings').doc('jobPreferences');
    await docRef.set(prefs, { merge: true });

    // Also store user email for notification purposes
    if (guard.user.email) {
      await db.collection('users').doc(guard.user.uid).set(
        { email: guard.user.email, lastPrefsUpdate: prefs.lastUpdated },
        { merge: true }
      );
    }

    return NextResponse.json({ success: true, preferences: prefs });
  } catch (error) {
    console.error('[jobs/preferences] POST error:', error);
    monitor.critical('Tool: jobs/preferences', String(error));
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
