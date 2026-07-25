import type { AdminPermission, AdminRole } from '@/lib/admin-permissions';

export interface AdminNavigationItem {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  permission: AdminPermission;
  anyOfPermissions?: readonly AdminPermission[];
  roles?: readonly AdminRole[];
  exact?: boolean;
  keywords: readonly string[];
  feature?: 'observability';
}

export const ADMIN_NAVIGATION: readonly AdminNavigationItem[] = [
  {
    href: '/suite/admin',
    label: 'Overview',
    shortLabel: 'Overview',
    description: 'Live platform evidence and priority signals',
    icon: 'home',
    permission: 'admin.access',
    exact: true,
    keywords: ['dashboard', 'health', 'signals', 'incident'],
  },
  {
    href: '/suite/admin/users',
    label: 'Users',
    shortLabel: 'Users',
    description: 'Customer accounts and support posture',
    icon: 'group',
    permission: 'users.read',
    keywords: ['customer', 'account', 'search'],
  },
  {
    href: '/suite/admin/access',
    label: 'Access',
    shortLabel: 'Access',
    description: 'Admin identities, roles, and MFA posture',
    icon: 'shield_person',
    permission: 'admin.accounts.read',
    keywords: ['admin', 'roles', 'permissions', 'mfa'],
  },
  {
    href: '/suite/admin/finance',
    label: 'Finance',
    shortLabel: 'Finance',
    description: 'Verified revenue, costs, and billing evidence',
    icon: 'paid',
    permission: 'billing.read',
    keywords: ['stripe', 'billing', 'revenue', 'costs', 'reconciliation'],
  },
  {
    href: '/suite/admin/support',
    label: 'Support',
    shortLabel: 'Support',
    description: 'Billing review cases and account recovery',
    icon: 'forum',
    permission: 'support.read',
    keywords: ['cases', 'review', 'customer', 'billing support'],
  },
  {
    href: '/suite/admin/operations',
    label: 'Operations',
    shortLabel: 'Operations',
    description: 'Provider readiness and platform controls',
    icon: 'settings',
    permission: 'operations.read',
    keywords: ['providers', 'jobs', 'notifications', 'security'],
  },
  {
    href: '/suite/admin/email',
    label: 'Email',
    shortLabel: 'Email',
    description: 'Delivery readiness and communications evidence',
    icon: 'mail',
    permission: 'email.send',
    anyOfPermissions: ['operations.read'],
    keywords: ['resend', 'delivery', 'templates', 'communications'],
  },
  {
    href: '/suite/admin/calibration',
    label: 'Calibration',
    shortLabel: 'Calibration',
    description: 'Recommendation outcome evidence',
    icon: 'model_training',
    permission: 'analytics.read',
    roles: ['owner'],
    keywords: ['recommendations', 'outcomes', 'scoring', 'evidence'],
  },
  {
    href: '/suite/admin/observability',
    label: 'Observability',
    shortLabel: 'Observe',
    description: 'Privacy-suppressed product signals and case-bound diagnostics',
    icon: 'query_stats',
    permission: 'analytics.read',
    anyOfPermissions: ['diagnostics.metadata.read'],
    feature: 'observability',
    keywords: ['observe', 'activity', 'adoption', 'reliability', 'diagnostics', 'privacy'],
  },
  {
    href: '/suite/admin/audit',
    label: 'Audit',
    shortLabel: 'Audit',
    description: 'Immutable administrative activity',
    icon: 'assignment',
    permission: 'admin.audit.read',
    keywords: ['history', 'events', 'changes', 'compliance'],
  },
] as const;

export function adminRouteIsActive(pathname: string, item: AdminNavigationItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function adminNavigationAllowed(
  item: AdminNavigationItem,
  permissions: readonly AdminPermission[],
  role?: AdminRole,
  features?: { observability: boolean },
): boolean {
  const permissionAllowed = permissions.includes(item.permission)
    || item.anyOfPermissions?.some(permission => permissions.includes(permission)) === true;
  const featureAllowed = !item.feature || features?.[item.feature] === true;
  return permissionAllowed
    && featureAllowed
    && (!item.roles || Boolean(role && item.roles.includes(role)));
}
