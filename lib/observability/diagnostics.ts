import 'server-only';
import { randomUUID } from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { z } from 'zod';
import { hasAdminPermission, isAdminRole, type AdminRole } from '@/lib/admin-permissions';
import type { AdminActor } from '@/lib/admin-auth';
import {
  OBSERVABILITY_GRANT_MS,
  OBSERVABILITY_RECENT_AUTH_MS,
  OBSERVABILITY_STEP_UP_MS,
  observabilityAccessAuditRetentionDays,
  observabilityCaseRetentionDays,
  observabilityNoticeVersion,
} from '@/lib/observability/config';
import { bearerToken } from '@/lib/observability/http';
import { getAdminAuth } from '@/lib/firebase-admin';
import type { NextRequest } from 'next/server';
import { observabilityControlRef } from '@/lib/observability/consent';

export const DIAGNOSTIC_METADATA_SCOPE = 'observability_metadata_v1';
export const SAFE_DIAGNOSTIC_CASE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export const diagnosticCaseCreateSchema = z.object({
  category: z.enum(['tool_failure', 'unexpected_result', 'account_access', 'other']),
  shareDiagnostics: z.boolean(),
  noticeVersion: z.string().min(3).max(64).regex(/^[a-z0-9][a-z0-9._-]+$/i),
}).strict();

export const diagnosticGrantUpdateSchema = z.object({
  decision: z.enum(['grant', 'revoke']),
  noticeVersion: z.string().min(3).max(64).regex(/^[a-z0-9][a-z0-9._-]+$/i),
}).strict();

export interface DiagnosticCaseView {
  caseId: string;
  category: 'tool_failure' | 'unexpected_result' | 'account_access' | 'other';
  status: 'open' | 'resolved';
  scope: typeof DIAGNOSTIC_METADATA_SCOPE;
  grantState: 'active' | 'revoked' | 'not_granted' | 'expired';
  grantExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PreparedDiagnosticCase {
  caseId: string;
  caseData: Record<string, unknown>;
  grantData: Record<string, unknown> | null;
  view: DiagnosticCaseView;
}

function timestampMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Number((value as { toMillis: () => number }).toMillis());
  }
  return Number.NaN;
}

function isFutureTimestamp(value: unknown, nowMs: number): boolean {
  const valueMs = timestampMillis(value);
  return Number.isFinite(valueMs) && valueMs > nowMs;
}

export function sanitizeDiagnosticCase(
  caseId: string,
  value: FirebaseFirestore.DocumentData | undefined,
  now = new Date(),
): DiagnosticCaseView | null {
  if (!value) return null;
  const category = value.category;
  const status = value.status;
  const caseExpiresAtMs = timestampMillis(value.expiresAt);
  if (
    !['tool_failure', 'unexpected_result', 'account_access', 'other'].includes(category)
    || (status !== 'open' && status !== 'resolved')
    || value.scope !== DIAGNOSTIC_METADATA_SCOPE
    || !Number.isFinite(caseExpiresAtMs)
    || caseExpiresAtMs <= now.getTime()
  ) {
    return null;
  }
  const expiresAtMs = timestampMillis(value.grantExpiresAt);
  const storedGrantState = value.grantState;
  const grantState = storedGrantState === 'active' && !isFutureTimestamp(value.grantExpiresAt, now.getTime())
    ? 'expired'
    : storedGrantState === 'active' || storedGrantState === 'revoked'
      ? storedGrantState
      : 'not_granted';
  return {
    caseId,
    category,
    status,
    scope: DIAGNOSTIC_METADATA_SCOPE,
    grantState,
    grantExpiresAt: Number.isFinite(expiresAtMs) ? new Date(expiresAtMs).toISOString() : null,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
  };
}

export function prepareDiagnosticCase(
  uid: string,
  input: z.infer<typeof diagnosticCaseCreateSchema>,
  caseId: string,
  now = new Date(),
): PreparedDiagnosticCase {
  if (input.noticeVersion !== observabilityNoticeVersion()) {
    throw new Error('OBSERVABILITY_NOTICE_VERSION_CHANGED');
  }
  if (!SAFE_DIAGNOSTIC_CASE_ID.test(caseId)) throw new Error('DIAGNOSTIC_CASE_INVALID');
  const nowIso = now.toISOString();
  const grantExpiresAt = Timestamp.fromMillis(now.getTime() + OBSERVABILITY_GRANT_MS);
  const caseExpiresAt = Timestamp.fromMillis(
    now.getTime() + observabilityCaseRetentionDays() * 24 * 60 * 60_000,
  );
  const grantState = input.shareDiagnostics ? 'active' : 'not_granted';

  const caseData = {
    version: 1,
    targetUid: uid,
    category: input.category,
    status: 'open',
    scope: DIAGNOSTIC_METADATA_SCOPE,
    grantState,
    grantExpiresAt: input.shareDiagnostics ? grantExpiresAt : null,
    noticeVersion: input.noticeVersion,
    createdAt: nowIso,
    updatedAt: nowIso,
    expiresAt: caseExpiresAt,
  };
  const grantData = input.shareDiagnostics ? {
    version: 1,
    caseId,
    targetUid: uid,
    state: 'active',
    scope: DIAGNOSTIC_METADATA_SCOPE,
    noticeVersion: input.noticeVersion,
    grantedAt: nowIso,
    revokedAt: null,
    expiresAt: grantExpiresAt,
    updatedAt: nowIso,
  } : null;
  return {
    caseId,
    caseData,
    grantData,
    view: {
      caseId,
      category: input.category,
      status: 'open',
      scope: DIAGNOSTIC_METADATA_SCOPE,
      grantState,
      grantExpiresAt: input.shareDiagnostics ? grantExpiresAt.toDate().toISOString() : null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  };
}

export async function createDiagnosticCase(
  db: Firestore,
  uid: string,
  input: z.infer<typeof diagnosticCaseCreateSchema>,
  now = new Date(),
): Promise<DiagnosticCaseView> {
  const caseRef = db.collection('diagnostic_support_cases').doc();
  const prepared = prepareDiagnosticCase(uid, input, caseRef.id, now);
  const grantRef = db
    .collection('users')
    .doc(uid)
    .collection('diagnosticGrants')
    .doc(caseRef.id);
  await db.runTransaction(async transaction => {
    transaction.create(caseRef, prepared.caseData);
    if (prepared.grantData) {
      transaction.create(grantRef, prepared.grantData);
    }
  });
  return prepared.view;
}

export async function updateDiagnosticGrant(
  db: Firestore,
  uid: string,
  caseId: string,
  input: z.infer<typeof diagnosticGrantUpdateSchema>,
  now = new Date(),
): Promise<DiagnosticCaseView> {
  if (!SAFE_DIAGNOSTIC_CASE_ID.test(caseId)) throw new Error('DIAGNOSTIC_CASE_NOT_FOUND');
  if (input.noticeVersion !== observabilityNoticeVersion()) {
    throw new Error('OBSERVABILITY_NOTICE_VERSION_CHANGED');
  }
  const caseRef = db.collection('diagnostic_support_cases').doc(caseId);
  const grantRef = db.collection('users').doc(uid).collection('diagnosticGrants').doc(caseId);
  const controlRef = observabilityControlRef(db, uid);
  const nowIso = now.toISOString();
  let grantExpiresAt = Timestamp.fromMillis(now.getTime() + OBSERVABILITY_GRANT_MS);

  return db.runTransaction(async transaction => {
    const [caseSnapshot, controlSnapshot] = await Promise.all([
      transaction.get(caseRef),
      transaction.get(controlRef),
    ]);
    const data = caseSnapshot.data();
    const resetCutoffMs = Date.parse(String(controlSnapshot.data()?.resetCutoffAt || ''));
    const caseCreatedAtMs = Date.parse(String(data?.createdAt || ''));
    if (
      !caseSnapshot.exists
      || data?.targetUid !== uid
      || data?.status !== 'open'
      || data?.scope !== DIAGNOSTIC_METADATA_SCOPE
      || !isFutureTimestamp(data?.expiresAt, now.getTime())
      || (
        Number.isFinite(resetCutoffMs)
        && (!Number.isFinite(caseCreatedAtMs) || caseCreatedAtMs <= resetCutoffMs)
      )
    ) {
      throw new Error('DIAGNOSTIC_CASE_NOT_FOUND');
    }
    const caseExpiresAtMs = timestampMillis(data.expiresAt);
    grantExpiresAt = Timestamp.fromMillis(
      Math.min(now.getTime() + OBSERVABILITY_GRANT_MS, caseExpiresAtMs),
    );
    if (input.decision === 'grant') {
      transaction.set(grantRef, {
        version: 1,
        caseId,
        targetUid: uid,
        state: 'active',
        scope: DIAGNOSTIC_METADATA_SCOPE,
        noticeVersion: input.noticeVersion,
        grantedAt: nowIso,
        revokedAt: null,
        expiresAt: grantExpiresAt,
        updatedAt: nowIso,
      });
      transaction.update(caseRef, {
        grantState: 'active',
        grantExpiresAt,
        noticeVersion: input.noticeVersion,
        updatedAt: nowIso,
      });
    } else {
      transaction.set(grantRef, {
        version: 1,
        caseId,
        targetUid: uid,
        state: 'revoked',
        scope: DIAGNOSTIC_METADATA_SCOPE,
        noticeVersion: input.noticeVersion,
        revokedAt: nowIso,
        expiresAt: Timestamp.fromMillis(now.getTime()),
        updatedAt: nowIso,
      }, { merge: true });
      transaction.update(caseRef, {
        grantState: 'revoked',
        grantExpiresAt: Timestamp.fromMillis(now.getTime()),
        noticeVersion: input.noticeVersion,
        updatedAt: nowIso,
      });
    }
    const next = {
      ...data,
      grantState: input.decision === 'grant' ? 'active' : 'revoked',
      grantExpiresAt: input.decision === 'grant'
        ? grantExpiresAt
        : Timestamp.fromMillis(now.getTime()),
      updatedAt: nowIso,
    };
    const view = sanitizeDiagnosticCase(caseId, next, now);
    if (!view) throw new Error('DIAGNOSTIC_CASE_INVALID');
    return view;
  });
}

export interface ObservabilityAdminTokenEvidence {
  uid: string;
  adminVersion: number;
  role: AdminRole;
  email: string;
  authTimeMs: number;
  secondFactor: string;
}

export async function readObservabilityAdminToken(
  request: NextRequest,
): Promise<ObservabilityAdminTokenEvidence> {
  const value = bearerToken(request);
  if (!value) throw new Error('ADMIN_TOKEN_INVALID');
  const token: DecodedIdToken = await getAdminAuth().verifyIdToken(value, true);
  const firebase = token.firebase as { sign_in_second_factor?: unknown } | undefined;
  if (
    token.admin !== true
    || !isAdminRole(token.adminRole)
    || !Number.isInteger(token.adminVersion)
    || typeof token.email !== 'string'
    || typeof firebase?.sign_in_second_factor !== 'string'
    || !firebase.sign_in_second_factor
  ) {
    throw new Error('ADMIN_TOKEN_INVALID');
  }
  return {
    uid: token.uid,
    adminVersion: Number(token.adminVersion),
    role: token.adminRole,
    email: token.email,
    authTimeMs: Number(token.auth_time) * 1000,
    secondFactor: firebase.sign_in_second_factor,
  };
}

function adminRecordAllowsDiagnostics(
  data: FirebaseFirestore.DocumentData | undefined,
  evidence: ObservabilityAdminTokenEvidence,
): boolean {
  return Boolean(
    data
    && data.status === 'active'
    && data.version === evidence.adminVersion
    && data.role === evidence.role
    && isAdminRole(data.role)
    && typeof data.email === 'string'
    && data.email.trim().toLowerCase() === evidence.email.trim().toLowerCase()
    && hasAdminPermission(data.role, 'diagnostics.metadata.read'),
  );
}

export async function createObservabilityAdminStepUp(
  db: Firestore,
  actor: AdminActor,
  evidence: ObservabilityAdminTokenEvidence,
  now = new Date(),
): Promise<{ expiresAt: string }> {
  if (
    process.env.ADMIN_MFA_ENFORCED !== 'true'
    || !actor.mfaSatisfied
    || actor.uid !== evidence.uid
    || actor.role !== evidence.role
    || !Number.isFinite(evidence.authTimeMs)
    || evidence.authTimeMs > now.getTime() + 30_000
    || now.getTime() - evidence.authTimeMs > OBSERVABILITY_RECENT_AUTH_MS
  ) {
    throw new Error('OBSERVABILITY_RECENT_MFA_REQUIRED');
  }
  const adminRef = db.collection('admin_accounts').doc(actor.uid);
  const leaseRef = adminRef.collection('stepUpLeases').doc('observability');
  const nowIso = now.toISOString();
  const expiresAt = Timestamp.fromMillis(now.getTime() + OBSERVABILITY_STEP_UP_MS);
  await db.runTransaction(async transaction => {
    const adminSnapshot = await transaction.get(adminRef);
    if (!adminRecordAllowsDiagnostics(adminSnapshot.data(), evidence)) {
      throw new Error('OBSERVABILITY_ADMIN_REVOKED');
    }
    transaction.set(leaseRef, {
      version: 1,
      scope: DIAGNOSTIC_METADATA_SCOPE,
      state: 'active',
      adminUid: actor.uid,
      adminVersion: evidence.adminVersion,
      secondFactor: true,
      authTime: new Date(evidence.authTimeMs).toISOString(),
      issuedAt: nowIso,
      expiresAt,
      leaseId: randomUUID(),
    });
  });
  return { expiresAt: expiresAt.toDate().toISOString() };
}

export async function assertDiagnosticAccessPreflight(
  db: Firestore,
  input: {
    actor: AdminActor;
    evidence: ObservabilityAdminTokenEvidence;
    caseId: string;
    expectedTargetUid: string;
  },
  now = new Date(),
): Promise<void> {
  const caseRef = db.collection('diagnostic_support_cases').doc(input.caseId);
  const grantRef = db
    .collection('users')
    .doc(input.expectedTargetUid)
    .collection('diagnosticGrants')
    .doc(input.caseId);
  const adminRef = db.collection('admin_accounts').doc(input.actor.uid);
  const leaseRef = adminRef.collection('stepUpLeases').doc('observability');
  const controlRef = observabilityControlRef(db, input.expectedTargetUid);
  const [caseSnapshot, grantSnapshot, adminSnapshot, leaseSnapshot, controlSnapshot] = await Promise.all([
    caseRef.get(),
    grantRef.get(),
    adminRef.get(),
    leaseRef.get(),
    controlRef.get(),
  ]);
  const diagnosticCase = caseSnapshot.data();
  const grant = grantSnapshot.data();
  const lease = leaseSnapshot.data();
  const nowMs = now.getTime();
  const resetCutoffMs = Date.parse(String(controlSnapshot.data()?.resetCutoffAt || ''));
  const caseCreatedAtMs = Date.parse(String(diagnosticCase?.createdAt || ''));
  if (
    input.actor.uid !== input.evidence.uid
    || input.actor.role !== input.evidence.role
    || !adminRecordAllowsDiagnostics(adminSnapshot.data(), input.evidence)
    || !caseSnapshot.exists
    || diagnosticCase?.targetUid !== input.expectedTargetUid
    || diagnosticCase?.status !== 'open'
    || diagnosticCase?.scope !== DIAGNOSTIC_METADATA_SCOPE
    || !isFutureTimestamp(diagnosticCase?.expiresAt, nowMs)
    || (
      Number.isFinite(resetCutoffMs)
      && (!Number.isFinite(caseCreatedAtMs) || caseCreatedAtMs <= resetCutoffMs)
    )
    || !grantSnapshot.exists
    || grant?.targetUid !== input.expectedTargetUid
    || grant?.caseId !== input.caseId
    || grant?.state !== 'active'
    || grant?.scope !== DIAGNOSTIC_METADATA_SCOPE
    || !isFutureTimestamp(grant?.expiresAt, nowMs)
    || !leaseSnapshot.exists
    || lease?.state !== 'active'
    || lease?.scope !== DIAGNOSTIC_METADATA_SCOPE
    || lease?.adminUid !== input.actor.uid
    || lease?.adminVersion !== input.evidence.adminVersion
    || lease?.secondFactor !== true
    || !isFutureTimestamp(lease?.expiresAt, nowMs)
  ) {
    throw new Error('OBSERVABILITY_DIAGNOSTIC_ACCESS_DENIED');
  }
}

export async function createDiagnosticAccessReceipt(
  db: Firestore,
  input: {
    actor: AdminActor;
    evidence: ObservabilityAdminTokenEvidence;
    caseId: string;
    expectedTargetUid: string;
    returnedEvents: number;
    cursorUsed: boolean;
  },
  now = new Date(),
): Promise<{
  caseStatus: 'open';
  grantExpiresAt: string;
  stepUpExpiresAt: string;
}> {
  const caseRef = db.collection('diagnostic_support_cases').doc(input.caseId);
  const grantRef = db
    .collection('users')
    .doc(input.expectedTargetUid)
    .collection('diagnosticGrants')
    .doc(input.caseId);
  const adminRef = db.collection('admin_accounts').doc(input.actor.uid);
  const leaseRef = adminRef.collection('stepUpLeases').doc('observability');
  const receiptRef = db.collection('diagnostic_access_receipts').doc();
  const controlRef = observabilityControlRef(db, input.expectedTargetUid);
  const nowMs = now.getTime();
  const nowIso = now.toISOString();

  return db.runTransaction(async transaction => {
    const [caseSnapshot, grantSnapshot, adminSnapshot, leaseSnapshot, controlSnapshot] = await Promise.all([
      transaction.get(caseRef),
      transaction.get(grantRef),
      transaction.get(adminRef),
      transaction.get(leaseRef),
      transaction.get(controlRef),
    ]);
    const diagnosticCase = caseSnapshot.data();
    const grant = grantSnapshot.data();
    const lease = leaseSnapshot.data();
    const resetCutoffMs = Date.parse(String(controlSnapshot.data()?.resetCutoffAt || ''));
    const caseCreatedAtMs = Date.parse(String(diagnosticCase?.createdAt || ''));
    if (
      input.actor.uid !== input.evidence.uid
      || input.actor.role !== input.evidence.role
      || !adminRecordAllowsDiagnostics(adminSnapshot.data(), input.evidence)
      || !caseSnapshot.exists
      || diagnosticCase?.targetUid !== input.expectedTargetUid
      || diagnosticCase?.status !== 'open'
      || diagnosticCase?.scope !== DIAGNOSTIC_METADATA_SCOPE
      || !isFutureTimestamp(diagnosticCase?.expiresAt, nowMs)
      || (
        Number.isFinite(resetCutoffMs)
        && (!Number.isFinite(caseCreatedAtMs) || caseCreatedAtMs <= resetCutoffMs)
      )
      || !grantSnapshot.exists
      || grant?.targetUid !== input.expectedTargetUid
      || grant?.caseId !== input.caseId
      || grant?.state !== 'active'
      || grant?.scope !== DIAGNOSTIC_METADATA_SCOPE
      || !isFutureTimestamp(grant?.expiresAt, nowMs)
      || !leaseSnapshot.exists
      || lease?.state !== 'active'
      || lease?.scope !== DIAGNOSTIC_METADATA_SCOPE
      || lease?.adminUid !== input.actor.uid
      || lease?.adminVersion !== input.evidence.adminVersion
      || lease?.secondFactor !== true
      || !isFutureTimestamp(lease?.expiresAt, nowMs)
    ) {
      throw new Error('OBSERVABILITY_DIAGNOSTIC_ACCESS_DENIED');
    }
    transaction.create(receiptRef, {
      version: 1,
      purpose: 'admin_access_audit',
      scope: DIAGNOSTIC_METADATA_SCOPE,
      actorUid: input.actor.uid,
      actorRole: input.actor.role,
      adminVersion: input.evidence.adminVersion,
      caseId: input.caseId,
      targetUid: input.expectedTargetUid,
      returnedEvents: input.returnedEvents,
      cursorUsed: input.cursorUsed,
      occurredAt: nowIso,
      expiresAt: Timestamp.fromMillis(
        nowMs + observabilityAccessAuditRetentionDays() * 24 * 60 * 60_000,
      ),
    });
    return {
      caseStatus: 'open' as const,
      grantExpiresAt: new Date(timestampMillis(grant.expiresAt)).toISOString(),
      stepUpExpiresAt: new Date(timestampMillis(lease.expiresAt)).toISOString(),
    };
  });
}
