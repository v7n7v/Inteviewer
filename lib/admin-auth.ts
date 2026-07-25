import { NextRequest, NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentData } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, checkRateLimitStrict } from '@/lib/rate-limit';
import {
  evaluateAdminIdentity,
  hasAdminPermission,
  isAdminRole,
  type AdminIdentityRecord,
  type AdminPermission,
  type AdminRole,
} from '@/lib/admin-permissions';

export interface AdminActor {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: readonly AdminPermission[];
  mfaSatisfied: boolean;
}

type AdminGuardSuccess = { actor: AdminActor; error?: never };
type AdminGuardFailure = { actor?: never; error: NextResponse };

function adminError(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: message, code },
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        Vary: 'Authorization',
      },
    },
  );
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function mfaSatisfied(token: DecodedIdToken): boolean {
  const firebase = token.firebase as { sign_in_second_factor?: unknown } | undefined;
  return typeof firebase?.sign_in_second_factor === 'string' && firebase.sign_in_second_factor.length > 0;
}

function adminRecord(uid: string, value: DocumentData | undefined): AdminIdentityRecord | null {
  if (!value || !isAdminRole(value.role)) return null;
  const status = value.status;
  if (status !== 'provisioning' && status !== 'active' && status !== 'suspended') return null;
  const version = Number(value.version);
  if (!Number.isInteger(version) || version < 1) return null;

  return {
    uid,
    email: typeof value.email === 'string' ? value.email : '',
    displayName: typeof value.displayName === 'string' ? value.displayName : '',
    role: value.role,
    status,
    version,
    requireMfa: value.requireMfa !== false,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    createdBy: typeof value.createdBy === 'string' ? value.createdBy : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : '',
    invitationDelivery: value.invitationDelivery === 'sent' || value.invitationDelivery === 'failed'
      ? value.invitationDelivery
      : 'not_requested',
  };
}

export async function requireAdmin(
  request: NextRequest,
  permission: AdminPermission = 'admin.access',
): Promise<AdminGuardSuccess | AdminGuardFailure> {
  const tokenValue = bearerToken(request);
  if (!tokenValue) {
    return { error: adminError(401, 'admin_auth_required', 'Sign in with an authorized admin account.') };
  }

  let token: DecodedIdToken;
  try {
    token = await getAdminAuth().verifyIdToken(tokenValue, true);
  } catch {
    return { error: adminError(401, 'admin_token_invalid', 'Your admin session is invalid or expired.') };
  }

  const uid = token.uid;
  const tokenEmail = typeof token.email === 'string' ? token.email : null;
  let snapshot: FirebaseFirestore.DocumentSnapshot;
  try {
    snapshot = await getAdminDb().collection('admin_accounts').doc(uid).get();
  } catch (error) {
    console.error('[admin-auth] account evidence unavailable', error);
    return {
      error: adminError(
        503,
        'admin_identity_unavailable',
        'Admin identity evidence is temporarily unavailable.',
      ),
    };
  }
  const record = adminRecord(uid, snapshot.exists ? snapshot.data() : undefined);
  const identity = evaluateAdminIdentity({
    claims: {
      admin: token.admin,
      adminRole: token.adminRole,
      adminVersion: token.adminVersion,
    },
    record,
    tokenEmail,
    emailVerified: token.email_verified === true,
    mfaSatisfied: mfaSatisfied(token),
    enforceMfa: process.env.ADMIN_MFA_ENFORCED === 'true',
  });

  if (!identity.allowed) {
    const isMfaFailure = identity.reason === 'mfa_required';
    return {
      error: adminError(
        403,
        isMfaFailure ? 'admin_mfa_required' : 'admin_access_denied',
        isMfaFailure
          ? 'Multi-factor authentication is required before using admin tools.'
          : 'This account does not have active admin access.',
      ),
    };
  }

  if (!hasAdminPermission(identity.role, permission)) {
    return { error: adminError(403, 'admin_permission_denied', 'Your admin role cannot perform this action.') };
  }

  const rateLimit = await checkRateLimit(`admin-read:${uid}:${new URL(request.url).pathname}`, 120, 60_000);
  if (!rateLimit.allowed) {
    return {
      error: adminError(429, 'admin_rate_limited', 'Too many admin requests. Wait a moment and try again.'),
    };
  }

  return {
    actor: {
      uid,
      email: tokenEmail!,
      displayName: record?.displayName || token.name || tokenEmail!.split('@')[0],
      role: identity.role,
      permissions: identity.permissions,
      mfaSatisfied: mfaSatisfied(token),
    },
  };
}

export async function requireAdminMutation(
  request: NextRequest,
  permission: AdminPermission,
): Promise<AdminGuardSuccess | AdminGuardFailure> {
  const guard = await requireAdmin(request, permission);
  if (guard.error) return guard;

  if (
    process.env.ADMIN_MUTATIONS_V2_ENABLED !== 'true'
    || process.env.ADMIN_MFA_ENFORCED !== 'true'
    || process.env.ADMIN_RECOVERY_OWNERS_VERIFIED !== 'true'
  ) {
    return {
      error: adminError(
        409,
        'admin_mutations_disabled',
        'Admin changes remain locked until MFA enforcement and two-owner recovery are verified.',
      ),
    };
  }
  if (!guard.actor.mfaSatisfied) {
    return {
      error: adminError(403, 'admin_mfa_required', 'A verified second factor is required for Admin changes.'),
    };
  }

  const limit = await checkRateLimitStrict(`admin-mutation:${guard.actor.uid}`, 20, 60_000);
  if (limit.unavailable && process.env.NODE_ENV === 'production') {
    return {
      error: adminError(503, 'admin_rate_limit_unavailable', 'Admin mutations are temporarily unavailable.'),
    };
  }
  if (!limit.unavailable && !limit.allowed) {
    return {
      error: adminError(429, 'admin_rate_limited', 'Too many admin changes. Wait a moment and try again.'),
    };
  }
  return guard;
}
