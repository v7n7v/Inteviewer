import { createHash } from 'crypto';
import type { UserRecord } from 'firebase-admin/auth';
import type { DocumentData } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { buildCustomAuthActionUrl, resolveAuthActionOrigin } from '@/lib/auth-action-links';
import { sendEmailEventResult } from '@/lib/email';
import {
  ADMIN_ROLE_LABELS,
  isAdminRole,
  type AdminAccountStatus,
  type AdminIdentityRecord,
  type AdminRole,
} from '@/lib/admin-permissions';
import type { AdminActor } from '@/lib/admin-auth';

const ADMIN_ACCOUNTS_COLLECTION = 'admin_accounts';
const ADMIN_AUDIT_COLLECTION = 'admin_audit_log';

export interface ProvisionAdminInput {
  email: string;
  displayName?: string;
  role: AdminRole;
  sendInvitation?: boolean;
  reason?: string;
  idempotencyKey?: string;
}

export interface ProvisionAdminOptions {
  allowOwner?: boolean;
  source: 'admin_api' | 'bootstrap_cli';
}

export interface UpdateAdminInput {
  role?: Exclude<AdminRole, 'owner'>;
  status?: Extract<AdminAccountStatus, 'active' | 'suspended'>;
  expectedVersion?: number;
  reason?: string;
  idempotencyKey?: string;
}

export interface AdminAuditEntry {
  id: string;
  action: string;
  actorUid: string;
  actorEmail: string;
  actorRole: AdminRole | 'bootstrap';
  targetUid?: string;
  targetEmail?: string;
  occurredAt: string;
  metadata: Record<string, string | number | boolean | null>;
}

type AuditActor = Pick<AdminActor, 'uid' | 'email' | 'role'> | {
  uid: 'bootstrap';
  email: string;
  role: 'bootstrap';
};

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid admin email address is required');
  }
  return email;
}

function safeDisplayName(value: string | undefined, email: string): string {
  const displayName = String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return displayName || email.split('@')[0];
}

function invitationIdempotencyKey(uid: string, version: number): string {
  const digest = createHash('sha256').update(`${uid}:${version}`).digest('hex').slice(0, 24);
  return `admin-invitation-${digest}`;
}

function publicRecord(uid: string, data: DocumentData): AdminIdentityRecord {
  return {
    uid,
    email: String(data.email || ''),
    displayName: String(data.displayName || ''),
    role: data.role,
    status: data.status,
    version: Number(data.version || 1),
    requireMfa: data.requireMfa !== false,
    createdAt: String(data.createdAt || ''),
    createdBy: String(data.createdBy || ''),
    updatedAt: String(data.updatedAt || ''),
    updatedBy: String(data.updatedBy || ''),
    invitationDelivery: data.invitationDelivery === 'sent' || data.invitationDelivery === 'failed'
      ? data.invitationDelivery
      : 'not_requested',
  };
}

async function findOrCreateFirebaseUser(email: string, displayName: string): Promise<{ user: UserRecord; created: boolean }> {
  const auth = getAdminAuth();
  try {
    const user = await auth.getUserByEmail(email);
    if (user.disabled) throw new Error('The Firebase account is disabled and must be reviewed before admin access is granted');
    if (!user.emailVerified) {
      throw new Error('An existing Firebase account must verify its email before receiving admin access');
    }
    return { user, created: false };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
    if (code !== 'auth/user-not-found') throw error;
  }

  const user = await auth.createUser({
    email,
    displayName,
    emailVerified: true,
    disabled: false,
  });
  return { user, created: true };
}

export interface AdminAccountInspection {
  email: string;
  firebaseUserExists: boolean;
  firebaseEmailVerified: boolean;
  firebaseUserDisabled: boolean;
  claimAdmin: boolean;
  claimRole: AdminRole | null;
  claimVersion: number | null;
  recordExists: boolean;
  recordRole: AdminRole | null;
  recordStatus: AdminAccountStatus | null;
  recordVersion: number | null;
}

export async function inspectAdminAccount(emailValue: string): Promise<AdminAccountInspection> {
  const email = normalizeEmail(emailValue);
  let user: UserRecord | null = null;
  try {
    user = await getAdminAuth().getUserByEmail(email);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== 'auth/user-not-found') throw error;
  }

  const recordSnapshot = user
    ? await getAdminDb().collection(ADMIN_ACCOUNTS_COLLECTION).doc(user.uid).get()
    : null;
  const recordData = recordSnapshot?.exists ? recordSnapshot.data() : undefined;
  const claimRole = isAdminRole(user?.customClaims?.adminRole) ? user!.customClaims!.adminRole : null;
  const claimVersionValue = Number(user?.customClaims?.adminVersion);
  const recordRole = isAdminRole(recordData?.role) ? recordData.role : null;
  const recordStatus = recordData?.status === 'provisioning'
    || recordData?.status === 'active'
    || recordData?.status === 'suspended'
    ? recordData.status
    : null;
  const recordVersionValue = Number(recordData?.version);

  return {
    email,
    firebaseUserExists: Boolean(user),
    firebaseEmailVerified: user?.emailVerified === true,
    firebaseUserDisabled: user?.disabled === true,
    claimAdmin: user?.customClaims?.admin === true,
    claimRole,
    claimVersion: Number.isInteger(claimVersionValue) ? claimVersionValue : null,
    recordExists: recordSnapshot?.exists === true,
    recordRole,
    recordStatus,
    recordVersion: Number.isInteger(recordVersionValue) ? recordVersionValue : null,
  };
}

async function writeAdminAudit(input: Omit<AdminAuditEntry, 'id' | 'occurredAt'>): Promise<string> {
  const occurredAt = new Date().toISOString();
  const ref = await getAdminDb().collection(ADMIN_AUDIT_COLLECTION).add({
    ...input,
    occurredAt,
  });
  return ref.id;
}

async function invitationActionUrl(user: UserRecord, created: boolean): Promise<string> {
  const origin = resolveAuthActionOrigin();
  if (!created) return new URL('/suite/admin', origin).toString();

  const generated = await getAdminAuth().generatePasswordResetLink(user.email!, {
    url: new URL('/suite/admin', origin).toString(),
    handleCodeInApp: false,
  });
  return buildCustomAuthActionUrl(generated, origin, 'resetPassword');
}

async function sendAdminInvitation(input: {
  user: UserRecord;
  created: boolean;
  displayName: string;
  role: AdminRole;
  actorEmail: string;
  version: number;
}) {
  const actionUrl = await invitationActionUrl(input.user, input.created);
  return sendEmailEventResult(
    input.user.email!,
    'security.admin_invitation',
    {
      recipientName: input.displayName,
      roleName: ADMIN_ROLE_LABELS[input.role],
      invitedBy: input.actorEmail,
      actionUrl,
      expiresInMinutes: input.created ? 60 : undefined,
    },
    {
      idempotencyKey: invitationIdempotencyKey(input.user.uid, input.version),
      additionalTags: [
        { name: 'purpose', value: 'admin_invitation' },
        { name: 'admin_role', value: input.role },
      ],
    },
  );
}

export async function listAdminAccounts(limit = 100): Promise<AdminIdentityRecord[]> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
  const snapshot = await getAdminDb()
    .collection(ADMIN_ACCOUNTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(safeLimit)
    .get();
  return snapshot.docs.map(doc => publicRecord(doc.id, doc.data()));
}

export async function listAdminAudit(limit = 100): Promise<AdminAuditEntry[]> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
  const snapshot = await getAdminDb()
    .collection(ADMIN_AUDIT_COLLECTION)
    .orderBy('occurredAt', 'desc')
    .limit(safeLimit)
    .get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    action: String(doc.data().action || ''),
    actorUid: String(doc.data().actorUid || ''),
    actorEmail: String(doc.data().actorEmail || ''),
    actorRole: doc.data().actorRole,
    targetUid: doc.data().targetUid ? String(doc.data().targetUid) : undefined,
    targetEmail: doc.data().targetEmail ? String(doc.data().targetEmail) : undefined,
    occurredAt: String(doc.data().occurredAt || ''),
    metadata: typeof doc.data().metadata === 'object' && doc.data().metadata ? doc.data().metadata : {},
  }));
}

export async function provisionAdminAccount(
  actor: AuditActor,
  input: ProvisionAdminInput,
  options: ProvisionAdminOptions,
): Promise<{ account: AdminIdentityRecord; firebaseUserCreated: boolean; invitationDelivery: 'not_requested' | 'sent' | 'failed' }> {
  if (!isAdminRole(input.role)) throw new Error('Invalid admin role');
  if (input.role === 'owner' && !options.allowOwner) {
    throw new Error('Owner accounts can only be provisioned through the guarded bootstrap workflow');
  }

  const email = normalizeEmail(input.email);
  const requestedDisplayName = safeDisplayName(input.displayName, email);
  await writeAdminAudit({
    action: 'admin.account.provisioning_requested',
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetEmail: email,
    metadata: {
      role: input.role,
      source: options.source,
      reason: input.reason || null,
      idempotencyKey: input.idempotencyKey || null,
    },
  });
  const { user, created } = await findOrCreateFirebaseUser(email, requestedDisplayName);
  const displayName = safeDisplayName(input.displayName || user.displayName || undefined, email);
  const db = getAdminDb();
  const accountRef = db.collection(ADMIN_ACCOUNTS_COLLECTION).doc(user.uid);
  const now = new Date().toISOString();
  const provisioned = await db.runTransaction(async transaction => {
    const current = await transaction.get(accountRef);
    const currentData = current.data() || {};
    const sameOperation = Boolean(
      input.idempotencyKey
      && (
        currentData.provisioningOperation === input.idempotencyKey
        || currentData.lastProvisioningOperation === input.idempotencyKey
      ),
    );
    if (current.exists && options.source === 'admin_api' && !sameOperation) {
      throw new Error('An admin account already exists for this Firebase identity');
    }
    const currentVersion = current.exists ? Number(current.data()?.version || 0) : 0;
    const version = sameOperation
      ? Math.max(1, currentVersion)
      : Math.max(1, currentVersion + 1);
    const createdAt = current.exists ? String(current.data()?.createdAt || now) : now;
    const createdBy = current.exists ? String(current.data()?.createdBy || actor.email) : actor.email;
    transaction.set(accountRef, {
      email,
      displayName,
      role: input.role,
      status: 'provisioning',
      version,
      requireMfa: true,
      createdAt,
      createdBy,
      updatedAt: now,
      updatedBy: actor.email,
      source: options.source,
      invitationDelivery: 'not_requested',
      provisioningOperation: input.idempotencyKey || null,
      lastProvisioningOperation: input.idempotencyKey || null,
    }, { merge: true });
    transaction.create(db.collection(ADMIN_AUDIT_COLLECTION).doc(), {
      action: current.exists ? 'admin.account.reprovisioning_started' : 'admin.account.provisioning_started',
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetUid: user.uid,
      targetEmail: email,
      occurredAt: now,
      metadata: {
        role: input.role,
        version,
        source: options.source,
        reason: input.reason || null,
        idempotencyKey: input.idempotencyKey || null,
      },
    });
    return { version, existed: current.exists };
  });
  const version = provisioned.version;

  const existingClaims = user.customClaims || {};
  try {
    await getAdminAuth().setCustomUserClaims(user.uid, {
      ...existingClaims,
      admin: true,
      adminRole: input.role,
      adminVersion: version,
    });
    await db.runTransaction(async transaction => {
      const current = await transaction.get(accountRef);
      const value = current.data() || {};
      if (
        !current.exists
        || value.status !== 'provisioning'
        || Number(value.version) !== version
        || value.role !== input.role
      ) throw new Error('Admin provisioning state changed before activation');
      transaction.update(accountRef, {
        status: 'active',
        activatedAt: now,
        updatedAt: now,
        updatedBy: actor.email,
        provisioningOperation: null,
        lastProvisioningOperation: input.idempotencyKey || null,
      });
      transaction.create(db.collection(ADMIN_AUDIT_COLLECTION).doc(), {
        action: provisioned.existed ? 'admin.account.reprovisioned' : 'admin.account.created',
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.role,
        targetUid: user.uid,
        targetEmail: email,
        occurredAt: now,
        metadata: {
          role: input.role,
          firebaseUserCreated: created,
          version,
          source: options.source,
          reason: input.reason || null,
          idempotencyKey: input.idempotencyKey || null,
        },
      });
    });
    await getAdminAuth().revokeRefreshTokens(user.uid);
  } catch (error) {
    await db.runTransaction(async transaction => {
      const current = await transaction.get(accountRef);
      if (!current.exists || current.data()?.status !== 'provisioning') return;
      transaction.create(db.collection(ADMIN_AUDIT_COLLECTION).doc(), {
        action: 'admin.account.provisioning_failed_closed',
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.role,
        targetUid: user.uid,
        targetEmail: email,
        occurredAt: new Date().toISOString(),
        metadata: {
          role: input.role,
          version,
          idempotencyKey: input.idempotencyKey || null,
        },
      });
    }).catch(() => {});
    throw error;
  }

  let delivery: 'not_requested' | 'sent' | 'failed' = 'not_requested';
  if (input.sendInvitation !== false) {
    try {
      const result = await sendAdminInvitation({
        user,
        created,
        displayName,
        role: input.role,
        actorEmail: actor.email,
        version,
      });
      delivery = result.ok ? 'sent' : 'failed';
    } catch {
      delivery = 'failed';
    }
    const invitationUpdatedAt = new Date().toISOString();
    await db.runTransaction(async transaction => {
      transaction.update(accountRef, {
        invitationDelivery: delivery,
        invitationUpdatedAt,
      });
      transaction.create(db.collection(ADMIN_AUDIT_COLLECTION).doc(), {
        action: 'admin.account.invitation_delivery_recorded',
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.role,
        targetUid: user.uid,
        targetEmail: email,
        occurredAt: invitationUpdatedAt,
        metadata: {
          invitationDelivery: delivery,
          version,
          idempotencyKey: input.idempotencyKey || null,
        },
      });
    });
  }

  const snapshot = await accountRef.get();
  return {
    account: publicRecord(snapshot.id, snapshot.data() || {}),
    firebaseUserCreated: created,
    invitationDelivery: delivery,
  };
}

export async function updateAdminAccount(
  actor: AdminActor,
  targetUid: string,
  input: UpdateAdminInput,
): Promise<AdminIdentityRecord> {
  const uid = targetUid.trim();
  if (!uid || uid.length > 128) throw new Error('Invalid admin account identifier');
  if (uid === actor.uid) throw new Error('Use a second owner or the bootstrap CLI to change your own admin access');
  if (!input.role && !input.status) throw new Error('At least one admin account change is required');

  const db = getAdminDb();
  const ref = db.collection(ADMIN_ACCOUNTS_COLLECTION).doc(uid);
  const now = new Date().toISOString();
  const auth = getAdminAuth();
  const user = await auth.getUser(uid);
  const staged = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error('Admin account not found');
    const currentData = snapshot.data() || {};
    const current = publicRecord(snapshot.id, currentData);
    if (current.role === 'owner') {
      throw new Error('Owner accounts can only be changed through the guarded bootstrap workflow');
    }
    const sameOperation = Boolean(
      input.idempotencyKey
      && (
        currentData.provisioningOperation === input.idempotencyKey
        || currentData.lastMutationOperation === input.idempotencyKey
      ),
    );
    if (!sameOperation && input.expectedVersion !== current.version) {
      throw new Error('Admin account version changed; refresh before applying this change');
    }
    const nextRole = input.role || current.role;
    const nextStatus = input.status || current.status;
    const version = sameOperation ? current.version : current.version + 1;
    const stagedStatus = nextStatus === 'suspended' ? 'suspended' : 'provisioning';
    transaction.update(ref, {
      role: nextRole,
      status: stagedStatus,
      version,
      updatedAt: now,
      updatedBy: actor.email,
      provisioningOperation: nextStatus === 'active' ? input.idempotencyKey || null : null,
      lastMutationOperation: input.idempotencyKey || null,
    });
    transaction.create(db.collection(ADMIN_AUDIT_COLLECTION).doc(), {
      action: nextStatus === 'suspended'
        ? 'admin.account.suspended'
        : 'admin.account.change_started',
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetUid: uid,
      targetEmail: current.email,
      occurredAt: now,
      metadata: {
        previousRole: current.role,
        role: nextRole,
        previousStatus: current.status,
        status: nextStatus,
        version,
        reason: input.reason || null,
        idempotencyKey: input.idempotencyKey || null,
      },
    });
    return { current, nextRole, nextStatus, version };
  });
  const { current, nextRole, nextStatus, version } = staged;

  const existingClaims = user.customClaims || {};
  if (nextStatus === 'suspended') {
    const { admin: _admin, adminRole: _adminRole, adminVersion: _adminVersion, ...remainingClaims } = existingClaims;
    void _admin;
    void _adminRole;
    void _adminVersion;
    await auth.setCustomUserClaims(uid, remainingClaims);
  } else {
    try {
      await auth.setCustomUserClaims(uid, {
        ...existingClaims,
        admin: true,
        adminRole: nextRole,
        adminVersion: version,
      });
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const value = snapshot.data() || {};
        if (
          !snapshot.exists
          || value.status !== 'provisioning'
          || Number(value.version) !== version
          || value.role !== nextRole
        ) throw new Error('Admin account changed before activation');
        transaction.update(ref, {
          status: 'active',
          activatedAt: now,
          updatedAt: now,
          updatedBy: actor.email,
          provisioningOperation: null,
          lastMutationOperation: input.idempotencyKey || null,
        });
        transaction.create(db.collection(ADMIN_AUDIT_COLLECTION).doc(), {
          action: 'admin.account.updated',
          actorUid: actor.uid,
          actorEmail: actor.email,
          actorRole: actor.role,
          targetUid: uid,
          targetEmail: current.email,
          occurredAt: now,
          metadata: {
            previousRole: current.role,
            role: nextRole,
            previousStatus: current.status,
            status: nextStatus,
            version,
            reason: input.reason || null,
            idempotencyKey: input.idempotencyKey || null,
          },
        });
      });
    } catch (error) {
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists || snapshot.data()?.status !== 'provisioning') return;
        transaction.create(db.collection(ADMIN_AUDIT_COLLECTION).doc(), {
          action: 'admin.account.change_failed_closed',
          actorUid: actor.uid,
          actorEmail: actor.email,
          actorRole: actor.role,
          targetUid: uid,
          targetEmail: current.email,
          occurredAt: new Date().toISOString(),
          metadata: {
            role: nextRole,
            version,
            reason: input.reason || null,
            idempotencyKey: input.idempotencyKey || null,
          },
        });
      }).catch(() => {});
      throw error;
    }
  }
  await auth.revokeRefreshTokens(uid);

  const updated = await ref.get();
  return publicRecord(updated.id, updated.data() || {});
}

export function bootstrapActor(email: string): AuditActor {
  return {
    uid: 'bootstrap',
    email: normalizeEmail(email),
    role: 'bootstrap',
  };
}
