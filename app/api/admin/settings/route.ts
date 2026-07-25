import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireAdminMutation } from '@/lib/admin-auth';
import { readBoundedJson } from '@/lib/admin/bounded-json';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};
const DEFAULTS = {
  version: 1,
  maintenance: false,
  maintenanceMessage: 'We are upgrading the platform. Please try again shortly.',
  announcement: '',
  announcementActive: false,
  features: {
    liveVoice: true,
    humanizer: true,
    marketOracle: true,
    jobSearch: true,
    skillBridge: true,
  },
  updatedAt: null,
  updatedBy: null,
};
const updateSchema = z.object({
  expectedVersion: z.number().int().min(1),
  reason: z.string().trim().min(10).max(500),
  confirmationText: z.literal('APPLY PLATFORM SETTINGS'),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
  maintenance: z.boolean().optional(),
  maintenanceMessage: z.string().trim().min(5).max(500).optional(),
  announcement: z.string().trim().max(500).optional(),
  announcementActive: z.boolean().optional(),
  features: z.object({
    liveVoice: z.boolean(),
    humanizer: z.boolean(),
    marketOracle: z.boolean(),
    jobSearch: z.boolean(),
    skillBridge: z.boolean(),
  }).strict().optional(),
}).strict();

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'settings.read');
  if (guard.error) return guard.error;
  try {
    const snapshot = await getAdminDb().doc('settings/platform').get();
    return NextResponse.json(
      { settings: snapshot.exists ? { ...DEFAULTS, ...snapshot.data() } : DEFAULTS },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error('[admin/settings] read failed', error);
    return NextResponse.json(
      { error: 'Platform settings are temporarily unavailable.', code: 'ADMIN_SETTINGS_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdminMutation(request, 'settings.manage');
  if (guard.error) return guard.error;
  const body = await readBoundedJson(request, 8_192);
  const parsed = updateSchema.safeParse(body.ok ? body.value : null);
  if (
    !parsed.success
    || process.env.ADMIN_MUTATIONS_V2_ENABLED !== 'true'
    || process.env.ADMIN_MFA_ENFORCED !== 'true'
    || !guard.actor.mfaSatisfied
  ) {
    return NextResponse.json(
      { error: 'Expanded settings mutations require verified MFA and exact confirmation.', code: 'ADMIN_SETTINGS_MUTATION_DISABLED' },
      { status: 409, headers: PRIVATE_HEADERS },
    );
  }
  const db = getAdminDb();
  const settingsRef = db.doc('settings/platform');
  const claimRef = db.collection('admin_mutation_claims').doc(`settings_${parsed.data.idempotencyKey}`);
  const requestFingerprint = createHash('sha256').update(JSON.stringify({
    expectedVersion: parsed.data.expectedVersion,
    reason: parsed.data.reason,
    maintenance: parsed.data.maintenance ?? null,
    maintenanceMessage: parsed.data.maintenanceMessage ?? null,
    announcement: parsed.data.announcement ?? null,
    announcementActive: parsed.data.announcementActive ?? null,
    features: parsed.data.features ?? null,
  })).digest('hex');
  try {
    const result = await db.runTransaction(async transaction => {
      const [snapshot, claim] = await Promise.all([
        transaction.get(settingsRef),
        transaction.get(claimRef),
      ]);
      if (claim.exists) {
        const value = claim.data() || {};
        if (
          value.actorUid !== guard.actor.uid
          || value.requestFingerprint !== requestFingerprint
          || value.status !== 'complete'
          || !value.result
        ) throw new Error('CLAIM_CONFLICT');
        return { settings: value.result, duplicate: true };
      }
      const current = snapshot.exists ? { ...DEFAULTS, ...snapshot.data() } : DEFAULTS;
      if (current.version !== parsed.data.expectedVersion) throw new Error('STALE_VERSION');
      const now = new Date().toISOString();
      const settings = {
        ...current,
        ...(parsed.data.maintenance !== undefined ? { maintenance: parsed.data.maintenance } : {}),
        ...(parsed.data.maintenanceMessage !== undefined ? { maintenanceMessage: parsed.data.maintenanceMessage } : {}),
        ...(parsed.data.announcement !== undefined ? { announcement: parsed.data.announcement } : {}),
        ...(parsed.data.announcementActive !== undefined ? { announcementActive: parsed.data.announcementActive } : {}),
        ...(parsed.data.features ? { features: parsed.data.features } : {}),
        version: current.version + 1,
        updatedAt: now,
        updatedBy: guard.actor.email,
      };
      transaction.set(settingsRef, settings);
      transaction.create(claimRef, {
        kind: 'platform_settings_change',
        status: 'complete',
        actorUid: guard.actor.uid,
        requestFingerprint,
        createdAt: now,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
        result: settings,
      });
      transaction.set(db.collection('admin_audit_log').doc(), {
        action: 'settings.platform.updated',
        actorUid: guard.actor.uid,
        actorEmail: guard.actor.email,
        actorRole: guard.actor.role,
        occurredAt: now,
        metadata: {
          reason: parsed.data.reason,
          idempotencyKey: parsed.data.idempotencyKey,
          previousVersion: current.version,
          nextVersion: settings.version,
        },
      });
      return { settings, duplicate: false };
    });
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    const stale = error instanceof Error && (
      error.message === 'STALE_VERSION'
      || error.message === 'CLAIM_CONFLICT'
    );
    if (!stale) console.error('[admin/settings] update failed', error);
    return NextResponse.json(
      {
        error: stale ? 'Settings changed since this view loaded. Refresh before applying.' : 'Platform settings could not be updated.',
        code: stale ? 'ADMIN_SETTINGS_STALE' : 'ADMIN_SETTINGS_UPDATE_UNAVAILABLE',
      },
      { status: stale ? 409 : 503, headers: PRIVATE_HEADERS },
    );
  }
}
