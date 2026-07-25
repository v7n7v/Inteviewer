import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireAdminMutation } from '@/lib/admin-auth';
import { readBoundedJson } from '@/lib/admin/bounded-json';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import {
  adminMutationClaimIsRunning,
  adminMutationLeaseFields,
  adminMutationRetentionDate,
  failAdminMutationClaim,
} from '@/lib/admin/mutation-claims';

export const dynamic = 'force-dynamic';

const SAFE_UID = /^[A-Za-z0-9:_-]{1,128}$/;
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};
const statusSchema = z.object({
  disabled: z.boolean(),
  reason: z.string().trim().min(10).max(500),
  confirmationText: z.string().trim().min(1).max(120),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

function statusFingerprint(uid: string, disabled: boolean, reason: string) {
  return createHash('sha256').update(JSON.stringify({ uid, disabled, reason })).digest('hex');
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> },
) {
  const guard = await requireAdmin(request, 'users.read');
  if (guard.error) return guard.error;
  const { uid } = await context.params;
  if (!SAFE_UID.test(uid)) {
    return NextResponse.json({ error: 'Invalid user.', code: 'ADMIN_USER_INVALID' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  try {
    const [user, subscription, supportReceipt] = await Promise.all([
      getAdminAuth().getUser(uid),
      getAdminDb().collection('users').doc(uid).collection('subscription').doc('current').get(),
      getAdminDb().collection('users').doc(uid).collection('billingSupport').doc('current').get(),
    ]);
    const subscriptionData = subscription.data() || {};
    const receipt = supportReceipt.data() || {};
    return NextResponse.json(
      {
        user: {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          emailVerified: user.emailVerified,
          disabled: user.disabled,
          createdAt: user.metadata.creationTime || null,
          lastSignInAt: user.metadata.lastSignInTime || null,
          plan: subscriptionData.plan === 'pro' || subscriptionData.plan === 'studio' ? subscriptionData.plan : 'free',
          subscriptionStatus: typeof subscriptionData.status === 'string' ? subscriptionData.status : 'none',
          billingEvidenceStatus: subscriptionData.billingEvidenceStatus || 'unknown',
          billingSupportStatus: receipt.status === 'new' || receipt.status === 'reviewing' || receipt.status === 'resolved'
            ? receipt.status
            : null,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    const notFound = (error as { code?: string })?.code === 'auth/user-not-found';
    if (!notFound) console.error('[admin/users] detail failed', error);
    return NextResponse.json(
      {
        error: notFound ? 'User not found.' : 'The user record is temporarily unavailable.',
        code: notFound ? 'ADMIN_USER_NOT_FOUND' : 'ADMIN_USER_UNAVAILABLE',
      },
      { status: notFound ? 404 : 503, headers: PRIVATE_HEADERS },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> },
) {
  const guard = await requireAdminMutation(request, 'users.manage');
  if (guard.error) return guard.error;
  const { uid } = await context.params;
  if (!SAFE_UID.test(uid) || uid === guard.actor.uid) {
    return NextResponse.json(
      { error: 'This account state cannot be changed here.', code: 'ADMIN_USER_CHANGE_REJECTED' },
      { status: 409, headers: PRIVATE_HEADERS },
    );
  }
  const body = await readBoundedJson(request, 4_096);
  const parsed = statusSchema.safeParse(body.ok ? body.value : null);
  const expectedConfirmation = parsed.success && parsed.data.disabled ? 'DISABLE USER' : 'ENABLE USER';
  if (
    !parsed.success
    || parsed.data.confirmationText !== expectedConfirmation
    || process.env.ADMIN_MUTATIONS_V2_ENABLED !== 'true'
    || process.env.ADMIN_MFA_ENFORCED !== 'true'
    || !guard.actor.mfaSatisfied
  ) {
    return NextResponse.json(
      {
        error: 'Expanded user mutations require the verified MFA rollout and exact confirmation.',
        code: 'ADMIN_USER_MUTATION_DISABLED',
      },
      { status: 409, headers: PRIVATE_HEADERS },
    );
  }

  const db = getAdminDb();
  const auth = getAdminAuth();
  const claimRef = db.collection('admin_mutation_claims').doc(`user_status_${parsed.data.idempotencyKey}`);
  const fingerprint = statusFingerprint(uid, parsed.data.disabled, parsed.data.reason);
  const executionId = randomUUID();
  try {
    const [adminPrincipal, before] = await Promise.all([
      db.collection('admin_accounts').doc(uid).get(),
      auth.getUser(uid),
    ]);
    if (adminPrincipal.exists || before.customClaims?.admin === true) {
      return NextResponse.json(
        {
          error: 'Administrator principals can only be changed through the protected Access workflow.',
          code: 'ADMIN_PRINCIPAL_PROTECTED',
        },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }

    const reservation = await db.runTransaction(async transaction => {
      const claim = await transaction.get(claimRef);
      if (claim.exists) {
        const value = claim.data() || {};
        if (
          value.actorUid !== guard.actor.uid
          || value.targetUid !== uid
          || value.requestFingerprint !== fingerprint
        ) return { conflict: true as const };
        if (value.status === 'complete' && value.result) {
          return { duplicate: true as const, result: value.result };
        }
        if (adminMutationClaimIsRunning(value)) return { running: true as const };
        transaction.update(claimRef, {
          ...adminMutationLeaseFields(
            executionId,
            Date.now(),
            Math.max(1, Number(value.attempts || 0) + 1),
          ),
          retriedAt: new Date().toISOString(),
        });
        return { ready: true as const };
      }
      const now = new Date().toISOString();
      transaction.create(claimRef, {
        kind: 'user_status_change',
        ...adminMutationLeaseFields(executionId),
        actorUid: guard.actor.uid,
        targetUid: uid,
        requestFingerprint: fingerprint,
        createdAt: now,
        expiresAt: adminMutationRetentionDate(),
      });
      transaction.create(db.collection('admin_audit_log').doc(), {
        action: 'user.status_change_requested',
        actorUid: guard.actor.uid,
        actorEmail: guard.actor.email,
        actorRole: guard.actor.role,
        targetUid: uid,
        occurredAt: now,
        metadata: {
          reason: parsed.data.reason,
          idempotencyKey: parsed.data.idempotencyKey,
          requestFingerprint: fingerprint,
          beforeDisabled: before.disabled,
          requestedDisabled: parsed.data.disabled,
        },
      });
      return { ready: true as const };
    });
    if ('duplicate' in reservation) {
      return NextResponse.json({ user: reservation.result, duplicate: true }, { headers: PRIVATE_HEADERS });
    }
    if ('conflict' in reservation) {
      return NextResponse.json(
        { error: 'The idempotency key belongs to a different user change.', code: 'ADMIN_USER_CHANGE_CONFLICT' },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }

    if ('running' in reservation && before.disabled !== parsed.data.disabled) {
      return NextResponse.json(
        { error: 'This user change is already running.', code: 'ADMIN_USER_CHANGE_RUNNING' },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }
    const updated = before.disabled === parsed.data.disabled
      ? before
      : await auth.updateUser(uid, { disabled: parsed.data.disabled });
    const now = new Date().toISOString();
    const result = { uid, disabled: updated.disabled, updatedAt: now };
    await db.runTransaction(async transaction => {
      const claim = await transaction.get(claimRef);
      const value = claim.data() || {};
      if (value.status === 'complete') return;
      if (
        value.status !== 'running'
        || value.executionId !== executionId
        || value.actorUid !== guard.actor.uid
        || value.requestFingerprint !== fingerprint
      ) throw new Error('ADMIN_USER_CHANGE_CLAIM_CHANGED');
      transaction.update(claimRef, {
        status: 'complete',
        completedAt: now,
        leaseUntil: null,
        result,
      });
      transaction.create(db.collection('admin_audit_log').doc(), {
        action: parsed.data.disabled ? 'user.disabled' : 'user.enabled',
        actorUid: guard.actor.uid,
        actorEmail: guard.actor.email,
        actorRole: guard.actor.role,
        targetUid: uid,
        occurredAt: now,
        metadata: {
          reason: parsed.data.reason,
          idempotencyKey: parsed.data.idempotencyKey,
          requestFingerprint: fingerprint,
          beforeDisabled: before.disabled,
          afterDisabled: updated.disabled,
        },
      });
    });
    return NextResponse.json({ user: result, duplicate: before.disabled === parsed.data.disabled }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    await failAdminMutationClaim(
      db,
      claimRef,
      executionId,
      'ADMIN_USER_CHANGE_UNAVAILABLE',
    ).catch(() => {});
    console.error('[admin/users] status change failed', error);
    return NextResponse.json(
      { error: 'The user state could not be changed.', code: 'ADMIN_USER_CHANGE_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
