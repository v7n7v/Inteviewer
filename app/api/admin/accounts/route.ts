import { createHash, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireAdminMutation } from '@/lib/admin-auth';
import { readBoundedJson } from '@/lib/admin/bounded-json';
import { listAdminAccounts, provisionAdminAccount } from '@/lib/admin-accounts';
import { ADMIN_ROLES } from '@/lib/admin-permissions';
import { adminJson } from '@/lib/admin/http';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  adminMutationClaimIsRunning,
  adminMutationLeaseFields,
  adminMutationRetentionDate,
  completeAdminMutationClaim,
  failAdminMutationClaim,
} from '@/lib/admin/mutation-claims';

export const dynamic = 'force-dynamic';

const createAdminSchema = z.object({
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ADMIN_ROLES).exclude(['owner']),
  sendInvitation: z.boolean().default(true),
  reason: z.string().trim().min(10).max(500),
  confirmationText: z.literal('INVITE ADMIN'),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'admin.accounts.read');
  if (guard.error) return guard.error;

  const accounts = await listAdminAccounts();
  return adminJson({ accounts });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminMutation(request, 'admin.accounts.manage');
  if (guard.error) return guard.error;

  const body = await readBoundedJson(request, 4_096);
  const parsed = createAdminSchema.safeParse(body.ok ? body.value : null);
  if (!parsed.success) {
    return adminJson(
      { error: 'Invalid admin account request', code: 'admin_input_invalid', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const claimRef = getAdminDb()
    .collection('admin_mutation_claims')
    .doc(`admin_invite_${parsed.data.idempotencyKey}`);
  const requestFingerprint = createHash('sha256').update(JSON.stringify({
    email: parsed.data.email.toLowerCase(),
    displayName: parsed.data.displayName || null,
    role: parsed.data.role,
    sendInvitation: parsed.data.sendInvitation,
    reason: parsed.data.reason,
  })).digest('hex');
  const executionId = randomUUID();
  const db = getAdminDb();
  try {
    const reservation = await db.runTransaction(async transaction => {
      const claim = await transaction.get(claimRef);
      if (claim.exists) {
        const value = claim.data() || {};
        if (value.actorUid !== guard.actor.uid || value.requestFingerprint !== requestFingerprint) {
          return { conflict: true };
        }
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
      transaction.create(claimRef, {
        kind: 'admin_account_invitation',
        ...adminMutationLeaseFields(executionId),
        actorUid: guard.actor.uid,
        requestFingerprint,
        createdAt: new Date().toISOString(),
        expiresAt: adminMutationRetentionDate(),
      });
      return { ready: true as const };
    });
    if ('conflict' in reservation) {
        return adminJson(
          { error: 'The idempotency key belongs to a different invitation.', code: 'admin_mutation_conflict' },
          { status: 409 },
        );
    }
    if ('duplicate' in reservation) {
      return adminJson({ ...reservation.result, duplicate: true });
    }
    if ('running' in reservation) {
      return adminJson(
        { error: 'This invitation request was already claimed.', code: 'admin_mutation_duplicate' },
        { status: 409 },
      );
    }
    const result = await provisionAdminAccount(
      guard.actor,
      parsed.data,
      { source: 'admin_api', allowOwner: false },
    );
    await completeAdminMutationClaim(db, claimRef, executionId, result);
    return adminJson(result, { status: 201 });
  } catch (error) {
    await failAdminMutationClaim(
      db,
      claimRef,
      executionId,
      'admin_account_create_failed',
    ).catch(() => {});
    const message = error instanceof Error ? error.message : '';
    const status = /already exists|disabled|Owner accounts/i.test(message) ? 409 : 500;
    return adminJson(
      {
        error: status === 409
          ? 'The requested administrator cannot be provisioned in its current state.'
          : 'The administrator could not be provisioned. The account remains fail-closed.',
        code: status === 409 ? 'admin_account_conflict' : 'admin_account_create_failed',
      },
      { status },
    );
  }
}
