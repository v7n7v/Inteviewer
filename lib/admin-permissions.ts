export const ADMIN_ROLES = [
  'owner',
  'administrator',
  'billing_admin',
  'support_admin',
  'operations_admin',
  'analyst',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  'admin.access',
  'admin.accounts.read',
  'admin.accounts.manage',
  'admin.audit.read',
  'users.read',
  'users.manage',
  'billing.read',
  'billing.manage',
  'support.read',
  'support.manage',
  'operations.read',
  'operations.manage',
  'settings.read',
  'settings.manage',
  'email.send',
  'analytics.read',
  'diagnostics.metadata.read',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  owner: 'Owner',
  administrator: 'Administrator',
  billing_admin: 'Billing administrator',
  support_admin: 'Support administrator',
  operations_admin: 'Operations administrator',
  analyst: 'Analyst',
};

const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: ADMIN_PERMISSIONS,
  administrator: [
    'admin.access',
    'admin.accounts.read',
    'admin.audit.read',
    'users.read',
    'users.manage',
    'billing.read',
    'billing.manage',
    'support.read',
    'support.manage',
    'operations.read',
    'operations.manage',
    'settings.read',
    'settings.manage',
    'email.send',
    'analytics.read',
    'diagnostics.metadata.read',
  ],
  billing_admin: [
    'admin.access',
    'admin.audit.read',
    'users.read',
    'billing.read',
    'billing.manage',
    'support.read',
    'support.manage',
    'analytics.read',
  ],
  support_admin: [
    'admin.access',
    'admin.audit.read',
    'users.read',
    'support.read',
    'support.manage',
    'email.send',
    'diagnostics.metadata.read',
  ],
  operations_admin: [
    'admin.access',
    'admin.audit.read',
    'users.read',
    'billing.read',
    'operations.read',
    'operations.manage',
    'settings.read',
    'settings.manage',
    'analytics.read',
  ],
  analyst: [
    'admin.access',
    'analytics.read',
  ],
};

export type AdminAccountStatus = 'provisioning' | 'active' | 'suspended';

export interface AdminIdentityRecord {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  status: AdminAccountStatus;
  version: number;
  requireMfa: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  invitationDelivery?: 'not_requested' | 'sent' | 'failed';
}

export interface AdminIdentityClaims {
  admin?: unknown;
  adminRole?: unknown;
  adminVersion?: unknown;
}

export type AdminIdentityDecision =
  | { allowed: true; role: AdminRole; permissions: readonly AdminPermission[] }
  | {
      allowed: false;
      reason:
        | 'email_unverified'
        | 'claims_missing'
        | 'record_missing'
        | 'record_inactive'
        | 'identity_mismatch'
        | 'version_mismatch'
        | 'mfa_required';
    };

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function permissionsForAdminRole(role: AdminRole): readonly AdminPermission[] {
  return ADMIN_ROLE_PERMISSIONS[role];
}

export function hasAdminPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ADMIN_ROLE_PERMISSIONS[role].includes(permission);
}

export function evaluateAdminIdentity(input: {
  claims: AdminIdentityClaims;
  record: AdminIdentityRecord | null;
  tokenEmail: string | null;
  emailVerified: boolean;
  mfaSatisfied: boolean;
  enforceMfa: boolean;
}): AdminIdentityDecision {
  if (!input.emailVerified || !input.tokenEmail) return { allowed: false, reason: 'email_unverified' };
  if (
    input.claims.admin !== true
    || !isAdminRole(input.claims.adminRole)
    || !Number.isInteger(input.claims.adminVersion)
  ) {
    return { allowed: false, reason: 'claims_missing' };
  }
  if (!input.record) return { allowed: false, reason: 'record_missing' };
  if (input.record.status !== 'active') return { allowed: false, reason: 'record_inactive' };

  const tokenEmail = input.tokenEmail.trim().toLowerCase();
  if (
    input.record.uid.trim() === ''
    || input.record.email.trim().toLowerCase() !== tokenEmail
    || input.record.role !== input.claims.adminRole
  ) {
    return { allowed: false, reason: 'identity_mismatch' };
  }
  if (input.record.version !== input.claims.adminVersion) {
    return { allowed: false, reason: 'version_mismatch' };
  }
  if (input.enforceMfa && input.record.requireMfa && !input.mfaSatisfied) {
    return { allowed: false, reason: 'mfa_required' };
  }

  return {
    allowed: true,
    role: input.record.role,
    permissions: permissionsForAdminRole(input.record.role),
  };
}
