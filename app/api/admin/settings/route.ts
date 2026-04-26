/**
 * Admin Settings API — Feature flags, maintenance mode, announcements
 * GET  /api/admin/settings — Read current settings
 * POST /api/admin/settings — Update settings
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { isMasterAccount } from '@/lib/pricing-tiers';
import { getAdminDb } from '@/lib/firebase-admin';
import { monitor } from '@/lib/monitor';

const SETTINGS_DOC = 'settings/platform';

export interface PlatformSettings {
  maintenance: boolean;
  maintenanceMessage: string;
  announcement: string;
  announcementActive: boolean;
  features: {
    liveVoice: boolean;
    humanizer: boolean;
    marketOracle: boolean;
    jobSearch: boolean;
    skillBridge: boolean;
  };
  updatedAt: string;
  updatedBy: string;
}

const DEFAULTS: PlatformSettings = {
  maintenance: false,
  maintenanceMessage: 'We\'re upgrading the platform. Back in a few minutes.',
  announcement: '',
  announcementActive: false,
  features: {
    liveVoice: true,
    humanizer: true,
    marketOracle: true,
    jobSearch: true,
    skillBridge: true,
  },
  updatedAt: '',
  updatedBy: '',
};

export async function GET(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req);
    if (guard.error) return guard.error;
    if (!isMasterAccount(guard.user.email)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const db = getAdminDb();
    const snap = await db.doc(SETTINGS_DOC).get();
    const data = snap.exists ? { ...DEFAULTS, ...snap.data() } : DEFAULTS;
    return NextResponse.json(data);
  } catch (error) {
    console.error('[api/admin/settings] GET error:', error);
    return NextResponse.json(DEFAULTS);
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req);
    if (guard.error) return guard.error;
    if (!isMasterAccount(guard.user.email)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const db = getAdminDb();

    const update: Partial<PlatformSettings> = {
      updatedAt: new Date().toISOString(),
      updatedBy: guard.user.email || 'admin',
    };

    if (body.maintenance !== undefined) update.maintenance = !!body.maintenance;
    if (body.maintenanceMessage) update.maintenanceMessage = body.maintenanceMessage;
    if (body.announcement !== undefined) update.announcement = body.announcement;
    if (body.announcementActive !== undefined) update.announcementActive = !!body.announcementActive;
    if (body.features) update.features = body.features;

    await db.doc(SETTINGS_DOC).set(update, { merge: true });

    // Log significant actions
    if (body.maintenance !== undefined) {
      monitor.send(body.maintenance ? 'warning' : 'info', {
        title: body.maintenance ? '🔧 Maintenance Mode ON' : '✅ Maintenance Mode OFF',
        details: `Toggled by ${guard.user.email}`,
        unique: true,
      });
    }
    if (body.features) {
      const disabled = Object.entries(body.features).filter(([, v]) => !v).map(([k]) => k);
      if (disabled.length > 0) {
        monitor.warn('Feature Flags Updated', `Disabled: ${disabled.join(', ')}`, [
          { name: 'By', value: guard.user.email || 'admin' },
        ]);
      }
    }

    // Append to admin activity log
    try {
      await db.collection('settings').doc('admin_log').collection('entries').add({
        action: 'settings_update',
        changes: body,
        by: guard.user.email,
        at: new Date().toISOString(),
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/admin/settings] POST error:', error);
    monitor.critical('Admin Settings Update Failed', String(error));
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
