import { createHash, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdminMutation } from '@/lib/admin-auth';
import { readBoundedJson } from '@/lib/admin/bounded-json';
import { updateAdminAccount } from '@/lib/admin-accounts';
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

const updateAdminSchema = z.object({
  role: z.enum(['administrator', 'billing_admin', 'support_admin', 'operations_admin', 'analyst']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  expectedVersion: z.number().int().min(1),
  reason: z.string().trim().min(10).max(500),
  confirmationText: z.literal('CONFIRM ADMIN CHANGE'),
  idempotencyKey: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
}).strict().refine(value => value.role !== undefined || value.status !== undefined, {
  message: 'At least one admin account change is required',
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> },
) {
  const guard = await requireAdminMutation(request, 'admin.accounts.manage');
  if (guard.error) return guard.error;

  const body = await readBoundedJson(request, 4_096);
  const parsed = updateAdminSchema.safeParse(body.ok ? body.value : null);
  if (!parsed.success) {
    return adminJson(
      { error: 'Invalid admin account change', code: 'admin_input_invalid', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { uid } = await context.params;
  const claimRef = getAdminDb()
    .collection('admin_mutation_claims')
    .doc(`admin_change_${parsed.data.idempotencyKey}`);
  const requestFingerprint = createHash('sha256').update(JSON.stringify({
    uid,
    role: parsed.data.role || null,
    status: parsed.data.status || null,
    expectedVersion: parsed.data.expectedVersion,
    reason: parsed.data.reason,
  })).digest('hex');
  const executionId = randomUUID();
  const db = getAdminDb();
  try {
    const reservation = await db.runTransaction(async transaction => {
      const claim = await transaction.get(claimRef);
      if (claim.exists) {
        const value = claim.data() || {};
        if (
          value.actorUid !== guard.actor.uid
          || value.targetUid !== uid
          || value.requestFingerprint !== requestFingerprint
        ) return { conflict: true };
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
        kind: 'admin_account_change',
        ...adminMutationLeaseFields(executionId),
        actorUid: guard.actor.uid,
        targetUid: uid,
        requestFingerprint,
        createdAt: new Date().toISOString(),
        expiresAt: adminMutationRetentionDate(),
      });
      return { ready: true as const };
    });
    if ('conflict' in reservation) {
        return adminJson(
          { error: 'The idempotency key belongs to a different access change.', code: 'admin_mutation_conflict' },
          { status: 409 },
        );
    }
    if ('duplicate' in reservation) {
      return adminJson({ account: reservation.result, duplicate: true });
    }
    if ('running' in reservation) {
      return adminJson(
        { error: 'This access change was already claimed.', code: 'admin_mutation_duplicate' },
        { status: 409 },
      );
    }
    const account = await updateAdminAccount(guard.actor, uid, parsed.data);
    await completeAdminMutationClaim(db, claimRef, executionId, account);
    return adminJson({ account });
  } catch (error) {
    await failAdminMutationClaim(
      db,
      claimRef,
      executionId,
      'admin_account_update_failed',
    ).catch(() => {});
    const message = error instanceof Error ? error.message : '';
    const status = /not found/i.test(message) ? 404 : /owner|your own|Invalid|change is required|version changed/i.test(message) ? 409 : 500;
    return adminJson(
      {
        error: status === 404
          ? 'The administrator was not found.'
          : status === 409
            ? 'The access record changed or is protected. Refresh before retrying.'
            : 'The access change could not be completed. The account remains fail-closed.',
        code: status === 500 ? 'admin_account_update_failed' : 'admin_account_conflict',
      },
      { status },
    );
  }
}
