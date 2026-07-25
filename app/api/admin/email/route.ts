import { createHash, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireAdminMutation } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendEmailEventResult } from '@/lib/email';
import { fingerprintResendApiKey } from '@/lib/job-notification-readiness';
import { adminJson, adminReadFailure } from '@/lib/admin/http';
import { operationalSecretConfigured } from '@/lib/admin/evidence';
import type { AdminEmailOperationsResponse } from '@/lib/admin/contracts';
import { checkRateLimitStrict } from '@/lib/rate-limit';
import { readAdminAggregateCache } from '@/lib/admin/aggregate-cache';
import { ADMIN_EMAIL_CACHE_KEY } from '@/lib/admin/aggregate-materializer';
import { isAdminEmailSnapshot } from '@/lib/admin/aggregate-contracts';
import {
  adminMutationClaimIsRunning,
  adminMutationLeaseFields,
  adminMutationRetentionDate,
  failAdminMutationClaim,
} from '@/lib/admin/mutation-claims';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const canaryRequestSchema = z.object({}).strict();

async function sendCustomEmailResult(toEmail: string, actorUid: string, requestedAt: string) {
  const bucket = Math.floor(Date.parse(requestedAt) / (15 * 60 * 1_000));
  return sendEmailEventResult(
    toEmail,
    'internal.security_anomaly',
    {
      referenceId: `resend-canary-${createHash('sha256').update(`${actorUid}:${bucket}`).digest('hex').slice(0, 16)}`,
      summary: 'An authorized administrator requested a Resend delivery and signed-webhook verification canary.',
      severity: 'info',
      occurredAt: requestedAt,
      dashboardUrl: 'https://talentconsulting.io/suite/admin/email',
      details: [
        { label: 'Purpose', value: 'Provider sending and signed receipt verification' },
        { label: 'Requested by', value: 'Authenticated Admin operator' },
      ],
    },
    { idempotencyKey: `admin-resend-canary-${actorUid}-${bucket}` },
  );
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'admin.access');
  if (guard.error) return guard.error;
  if (
    !guard.actor.permissions.includes('operations.read')
    && !guard.actor.permissions.includes('email.send')
  ) {
    return adminReadFailure(
      'admin_permission_denied',
      'Your admin role cannot view email operations.',
      403,
    );
  }

  const cached = await readAdminAggregateCache<AdminEmailOperationsResponse>(
    getAdminDb(),
    ADMIN_EMAIL_CACHE_KEY,
    isAdminEmailSnapshot,
  );
  if (!cached.payload) {
    return adminReadFailure(
      'admin_email_snapshot_unavailable',
      'The scheduled email operations snapshot is not available yet.',
      503,
    );
  }
  return adminJson({
    ...cached.payload,
    meta: {
      ...cached.payload.meta,
      requestId: crypto.randomUUID(),
      partial: cached.payload.meta.partial || !cached.fresh,
    },
    evidence: {
      ...cached.payload.evidence,
      limitations: [
        ...cached.payload.evidence.limitations,
        ...(!cached.fresh
          ? ['The scheduled email snapshot is stale; no live outbox aggregation was triggered.']
          : []),
      ],
    },
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminMutation(request, 'email.send');
  if (guard.error) return guard.error;
  const rawBody = await request.text();
  let body: unknown = {};
  if (Buffer.byteLength(rawBody, 'utf8') > 1_024) {
    return adminReadFailure(
      'admin_email_canary_input_invalid',
      'The email verification request is too large.',
      413,
    );
  }
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return adminReadFailure(
        'admin_email_canary_input_invalid',
        'The email verification request is not valid JSON.',
        400,
      );
    }
  }
  const parsed = canaryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return adminReadFailure(
      'admin_email_canary_input_invalid',
      'The email verification request must not include a recipient or message payload.',
      400,
    );
  }

  const strictLimit = await checkRateLimitStrict(
    `admin-email-canary:${guard.actor.uid}`,
    2,
    15 * 60 * 1_000,
  );
  if (strictLimit.unavailable) {
    return adminReadFailure(
      'admin_email_canary_rate_limit_unavailable',
      'Email verification is temporarily unavailable.',
      503,
      60,
    );
  }
  if (!strictLimit.allowed) {
    return adminReadFailure(
      'admin_email_canary_rate_limited',
      'Email verification is limited. Wait before requesting another canary.',
      429,
      Math.ceil(strictLimit.resetIn / 1_000),
    );
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (
    !operationalSecretConfigured(apiKey, 're_')
    || !operationalSecretConfigured(webhookSecret, 'whsec_')
  ) {
    return adminReadFailure(
      'admin_email_canary_not_configured',
      'Resend sending and signed receipt configuration must be complete before verification.',
      503,
    );
  }

  const requestedAt = new Date().toISOString();
  const bucket = Math.floor(Date.parse(requestedAt) / (15 * 60 * 1_000));
  const requestFingerprint = createHash('sha256')
    .update(JSON.stringify({
      actorUid: guard.actor.uid,
      bucket,
      operation: 'resend_self_canary',
    }))
    .digest('hex');
  const executionId = randomUUID();
  const db = getAdminDb();
  const claimRef = db.collection('admin_mutation_claims')
    .doc(`email_canary_${createHash('sha256').update(`${guard.actor.uid}:${bucket}`).digest('hex').slice(0, 24)}`);
  const reservation = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(claimRef);
    if (snapshot.exists) {
      const value = snapshot.data() || {};
      if (
        value.actorUid !== guard.actor.uid
        || value.requestFingerprint !== requestFingerprint
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
        retriedAt: requestedAt,
      });
      return { ready: true as const };
    }
    transaction.create(claimRef, {
      kind: 'email_provider_self_canary',
      ...adminMutationLeaseFields(executionId),
      actorUid: guard.actor.uid,
      requestFingerprint,
      createdAt: requestedAt,
      expiresAt: adminMutationRetentionDate(),
    });
    return { ready: true as const };
  });
  if ('duplicate' in reservation) {
    return adminJson({ ...reservation.result, duplicate: true }, { status: 202 });
  }
  if ('conflict' in reservation || 'running' in reservation) {
    return adminReadFailure(
      'admin_email_canary_already_running',
      'An email verification canary is already running for this window.',
      409,
    );
  }

  const result = await sendCustomEmailResult(
    guard.actor.email,
    guard.actor.uid,
    requestedAt,
  );
  if (!result.ok || !result.id) {
    await failAdminMutationClaim(
      db,
      claimRef,
      executionId,
      'admin_email_canary_rejected',
    ).catch(() => undefined);
    return adminReadFailure(
      'admin_email_canary_rejected',
      'The email provider did not accept the verification canary.',
      502,
    );
  }

  try {
    const healthRef = db.doc('settings/integrationHealth');
    const auditRef = db.collection('admin_audit_log').doc();
    const publicResult = {
      accepted: true,
      provider: 'resend' as const,
      requestedAt,
      verificationPending: true,
      message: 'The canary was accepted. Readiness changes only after its signed provider receipt is verified.',
    };
    await db.runTransaction(async transaction => {
      const claim = await transaction.get(claimRef);
      const claimData = claim.data() || {};
      if (
        claimData.status !== 'running'
        || claimData.executionId !== executionId
        || claimData.actorUid !== guard.actor.uid
        || claimData.requestFingerprint !== requestFingerprint
      ) throw new Error('ADMIN_EMAIL_CANARY_CLAIM_CHANGED');
      transaction.set(healthRef, {
        resendCanaryProviderMessageId: result.id,
        resendCanaryApiKeyFingerprint: fingerprintResendApiKey(apiKey!),
        resendCanaryRequestedAt: requestedAt,
        resendCanaryRequestedBy: guard.actor.uid,
        resendCanaryVerifiedAt: null,
        resendCanaryWebhookSecretFingerprint: null,
        resendCanaryEventType: null,
      }, { merge: true });
      transaction.set(auditRef, {
        action: 'email.provider_canary_requested',
        actorUid: guard.actor.uid,
        actorEmail: guard.actor.email,
        actorRole: guard.actor.role,
        occurredAt: requestedAt,
        metadata: {
          provider: 'resend',
          recipientScope: 'requesting_admin',
          verificationPending: true,
        },
      });
      transaction.update(claimRef, {
        status: 'complete',
        completedAt: requestedAt,
        leaseUntil: null,
        result: publicResult,
      });
    });
    return adminJson(publicResult, { status: 202 });
  } catch {
    await failAdminMutationClaim(
      db,
      claimRef,
      executionId,
      'admin_email_canary_evidence_write_failed',
    ).catch(() => undefined);
    return adminReadFailure(
      'admin_email_canary_evidence_write_failed',
      'The canary was accepted, but its verification evidence could not be recorded.',
      503,
    );
  }

}
