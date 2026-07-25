'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLE_LABELS,
  ADMIN_ROLES,
  permissionsForAdminRole,
  type AdminRole,
} from '@/lib/admin-permissions';
import { useAdminResource } from '@/hooks/useAdminResource';
import { AdminButton } from '@/components/admin/primitives/AdminButton';
import { AdminConfirmationDialog } from '@/components/admin/primitives/AdminConfirmationDialog';
import {
  AdminDataTable,
  type AdminDataColumn,
} from '@/components/admin/primitives/AdminDataTable';
import { AdminFreshnessMeter } from '@/components/admin/primitives/AdminFreshnessMeter';
import { AdminMetricCard } from '@/components/admin/primitives/AdminMetricCard';
import { AdminPanel } from '@/components/admin/primitives/AdminPanel';
import { AdminStateBoundary } from '@/components/admin/primitives/AdminStateBoundary';
import { AdminStatusBadge, type AdminStatusTone } from '@/components/admin/primitives/AdminStatusBadge';
import { useAdminSession } from '@/components/admin/shell/AdminSessionProvider';

type AdminStatus = 'provisioning' | 'active' | 'suspended';
type AssignableRole = Exclude<AdminRole, 'owner'>;

interface AdminAccount {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  status: AdminStatus;
  version: number;
  requireMfa: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  invitationDelivery?: 'not_requested' | 'sent' | 'failed';
}

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string;
  actorRole: AdminRole | 'bootstrap' | 'unknown';
  targetEmail?: string | null;
  occurredAt: string;
}

interface AccountsPayload {
  accounts: AdminAccount[];
}

interface AuditPayload {
  audit: AuditEntry[];
  meta?: {
    generatedAt?: string;
    staleAfterMs?: number;
  };
}

type PendingAccountChange =
  | { kind: 'role'; account: AdminAccount; role: AssignableRole }
  | { kind: 'status'; account: AdminAccount; status: 'active' | 'suspended' };

const ASSIGNABLE_ROLES = ADMIN_ROLES.filter((role): role is AssignableRole => role !== 'owner');

const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  owner: 'Full control. Owner creation and transfer remain CLI-protected.',
  administrator: 'Runs platform, users, billing, support, settings, and communications.',
  billing_admin: 'Reviews billing evidence and account reconciliation without platform control.',
  support_admin: 'Handles support cases and approved communications.',
  operations_admin: 'Operates reliability, settings, and aggregate platform workflows.',
  analyst: 'Reads aggregate analytics without user or mutation access.',
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
}

function accountStatusTone(status: AdminStatus): AdminStatusTone {
  if (status === 'active') return 'healthy';
  if (status === 'suspended') return 'critical';
  return 'pending';
}

function roleTone(role: AdminRole): AdminStatusTone {
  if (role === 'owner') return 'degraded';
  if (role === 'administrator') return 'pending';
  if (role === 'billing_admin') return 'healthy';
  if (role === 'support_admin') return 'info';
  if (role === 'operations_admin') return 'info';
  return 'unknown';
}

function parseAccounts(payload: unknown): AccountsPayload {
  const value = payload as Partial<AccountsPayload>;
  return { accounts: Array.isArray(value.accounts) ? value.accounts : [] };
}

function parseAudit(payload: unknown): AuditPayload {
  const value = payload as Partial<AuditPayload>;
  return {
    audit: Array.isArray(value.audit) ? value.audit : [],
    meta: value.meta,
  };
}

function safeChangeLabel(change: PendingAccountChange | null) {
  if (!change) return '';
  if (change.kind === 'role') {
    return `Change ${change.account.email} to ${ADMIN_ROLE_LABELS[change.role]}`;
  }
  return `${change.status === 'suspended' ? 'Suspend' : 'Reactivate'} ${change.account.email}`;
}

export function AccessCommandCenter() {
  const { session, hasPermission } = useAdminSession();
  const canReadAccounts = hasPermission('admin.accounts.read');
  const canManageAccounts = hasPermission('admin.accounts.manage');
  const canReadAudit = hasPermission('admin.audit.read');
  const accountsResource = useAdminResource<AccountsPayload>('/api/admin/accounts', {
    enabled: canReadAccounts,
    staleAfterMs: 60_000,
    parse: parseAccounts,
  });
  const auditResource = useAdminResource<AuditPayload>('/api/admin/audit?limit=30&includeIdentities=1', {
    enabled: canReadAudit,
    staleAfterMs: 60_000,
    parse: parseAudit,
  });
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    role: 'administrator' as AssignableRole,
  });
  const [inviteConfirmation, setInviteConfirmation] = useState('');
  const [inviteReason, setInviteReason] = useState('');
  const [inviteIdempotencyKey, setInviteIdempotencyKey] = useState('');
  const [pendingChange, setPendingChange] = useState<PendingAccountChange | null>(null);
  const [changeConfirmation, setChangeConfirmation] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [changeIdempotencyKey, setChangeIdempotencyKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [mutationError, setMutationError] = useState('');

  const accounts = accountsResource.data?.accounts || [];
  const metrics = useMemo(() => ({
    active: accounts.filter(account => account.status === 'active').length,
    owners: accounts.filter(account => account.role === 'owner' && account.status === 'active').length,
    mfa: accounts.filter(account => account.requireMfa).length,
    attention: accounts.filter(account => (
      account.status !== 'active' || account.invitationDelivery === 'failed'
    )).length,
  }), [accounts]);

  const accountColumns = useMemo<readonly AdminDataColumn<AdminAccount>[]>(() => [
    {
      key: 'identity',
      header: 'Admin identity',
      render: account => (
        <div className="access-identity-cell">
          <span className="access-avatar" aria-hidden="true">
            {(account.displayName || account.email || '?').slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{account.displayName || account.email.split('@')[0]}</strong>
            <small>{account.email}</small>
          </span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role boundary',
      render: account => (
        <AdminStatusBadge tone={roleTone(account.role)}>
          {ADMIN_ROLE_LABELS[account.role]}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'status',
      header: 'Access',
      render: account => (
        <div className="access-status-stack">
          <AdminStatusBadge tone={accountStatusTone(account.status)}>
            {account.status}
          </AdminStatusBadge>
          {account.invitationDelivery === 'failed' ? <small>Invitation failed</small> : null}
        </div>
      ),
    },
    {
      key: 'mfa',
      header: 'MFA',
      render: account => (
        <span className="access-inline-evidence">
          <span className="material-symbols-rounded" aria-hidden="true">
            {account.requireMfa ? 'phonelink_lock' : 'lock_open'}
          </span>
          {account.requireMfa ? 'Required' : 'Not required'}
        </span>
      ),
    },
    {
      key: 'version',
      header: 'Claim version',
      render: account => <code>v{account.version}</code>,
    },
    {
      key: 'updated',
      header: 'Last verified change',
      render: account => (
        <span className="access-date-cell">
          <strong>{formatDate(account.updatedAt)}</strong>
          <small>{account.updatedBy || 'System evidence'}</small>
        </span>
      ),
    },
    {
      key: 'controls',
      header: 'Guarded controls',
      align: 'right',
      render: account => {
        const protectedAccount = account.role === 'owner' || account.uid === session?.uid;
        if (!canManageAccounts || protectedAccount) {
          return (
            <span className="access-protected-label">
              <span className="material-symbols-rounded" aria-hidden="true">shield_lock</span>
              {account.uid === session?.uid ? 'Current session' : account.role === 'owner' ? 'CLI protected' : 'Read only'}
            </span>
          );
        }
        return (
          <div className="access-row-controls" onClick={event => event.stopPropagation()}>
            <label>
              <span className="sr-only">Change role for {account.email}</span>
              <select
                value={account.role}
                disabled={busy}
                onChange={event => {
                  const role = event.target.value as AssignableRole;
                  if (role !== account.role) {
                    setPendingChange({ kind: 'role', account, role });
                    setChangeConfirmation('');
                    setChangeIdempotencyKey(`access-change-${crypto.randomUUID()}`);
                  }
                }}
              >
                {ASSIGNABLE_ROLES.map(role => (
                  <option key={role} value={role}>{ADMIN_ROLE_LABELS[role]}</option>
                ))}
              </select>
            </label>
            <AdminButton
              size="sm"
              variant={account.status === 'suspended' ? 'secondary' : 'ghost'}
              icon={account.status === 'suspended' ? 'person_check' : 'person_off'}
              onClick={() => {
                setPendingChange({
                  kind: 'status',
                  account,
                  status: account.status === 'suspended' ? 'active' : 'suspended',
                });
                setChangeConfirmation('');
                setChangeIdempotencyKey(`access-change-${crypto.randomUUID()}`);
              }}
            >
              {account.status === 'suspended' ? 'Reactivate' : 'Suspend'}
            </AdminButton>
          </div>
        );
      },
    },
  ], [busy, canManageAccounts, session?.uid]);

  async function refreshAccessEvidence() {
    await Promise.all([
      accountsResource.refresh(),
      canReadAudit ? auditResource.refresh() : Promise.resolve(),
    ]);
  }

  async function createAccount() {
    if (
      !canManageAccounts
      || !inviteIdempotencyKey
      || inviteConfirmation !== 'INVITE ADMIN'
      || inviteReason.trim().length < 10
    ) return;
    setBusy(true);
    setNotice('');
    setMutationError('');
    try {
      const response = await authFetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          displayName: form.displayName || undefined,
          role: form.role,
          sendInvitation: true,
          reason: inviteReason.trim(),
          confirmationText: inviteConfirmation,
          idempotencyKey: inviteIdempotencyKey,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        invitationDelivery?: 'sent' | 'failed';
      };
      if (!response.ok) throw new Error(payload.error || 'The admin account could not be created.');
      setNotice(
        payload.invitationDelivery === 'sent'
          ? 'Admin access was created and the secure invitation was accepted by the delivery provider.'
          : 'Admin access was created. Invitation delivery still needs review.',
      );
      setForm({ email: '', displayName: '', role: 'administrator' });
      setInviteConfirmation('');
      setInviteReason('');
      setInviteIdempotencyKey('');
      await refreshAccessEvidence();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'The admin account could not be created.');
    } finally {
      setBusy(false);
    }
  }

  function stageInvite(event: FormEvent) {
    event.preventDefault();
    if (!canManageAccounts) return;
    setInviteConfirmation('PENDING');
    setInviteIdempotencyKey(`access-invite-${crypto.randomUUID()}`);
    setMutationError('');
  }

  async function applyAccountChange() {
    if (
      !pendingChange
      || !canManageAccounts
      || changeConfirmation !== 'CONFIRM ADMIN CHANGE'
      || changeReason.trim().length < 10
      || !changeIdempotencyKey
    ) return;
    setBusy(true);
    setNotice('');
    setMutationError('');
    try {
      const body = {
        ...(pendingChange.kind === 'role'
          ? { role: pendingChange.role }
          : { status: pendingChange.status }),
        expectedVersion: pendingChange.account.version,
        reason: changeReason.trim(),
        confirmationText: changeConfirmation,
        idempotencyKey: changeIdempotencyKey,
      };
      const response = await authFetch(`/api/admin/accounts/${encodeURIComponent(pendingChange.account.uid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The admin access change could not be applied.');
      setNotice(
        pendingChange.kind === 'status' && pendingChange.status === 'suspended'
          ? 'Admin access was suspended and active sessions were revoked.'
          : 'Admin access was updated. New claims take effect after the affected admin signs in again.',
      );
      setPendingChange(null);
      setChangeIdempotencyKey('');
      setChangeConfirmation('');
      setChangeReason('');
      await refreshAccessEvidence();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'The admin access change could not be applied.');
    } finally {
      setBusy(false);
    }
  }

  const accountsState = !canReadAccounts
    ? 'unauthorized'
    : accountsResource.loading
      ? 'loading'
      : accountsResource.error && !accountsResource.data
        ? 'error'
        : accounts.length === 0
          ? 'empty'
          : 'ready';

  return (
    <div className="access-module">
      <header className="admin-module-hero access-module-hero">
        <div>
          <p className="admin-module-kicker">Identity perimeter</p>
          <h1>Access control</h1>
          <p>
            Manage the people trusted to operate Talent Consulting. Every route re-verifies
            revoked Firebase tokens, database identity, role, and claim version.
          </p>
        </div>
        <div className="access-hero-actions">
          <AdminFreshnessMeter
            ageSeconds={accountsResource.lastUpdatedAt
              ? Math.max(0, (Date.now() - new Date(accountsResource.lastUpdatedAt).getTime()) / 1_000)
              : null}
            freshForSeconds={60}
            label="Directory evidence"
          />
          <AdminButton
            icon="refresh"
            busy={accountsResource.refreshing || auditResource.refreshing}
            onClick={() => void refreshAccessEvidence()}
          >
            Refresh evidence
          </AdminButton>
        </div>
      </header>

      {mutationError ? <div className="admin-module-alert is-error" role="alert">{mutationError}</div> : null}
      {notice ? <div className="admin-module-alert is-success" role="status">{notice}</div> : null}
      {accountsResource.stale && accountsResource.data ? (
        <div className="admin-module-alert is-warning" role="status">
          Showing the last verified directory evidence while a newer read is unavailable.
        </div>
      ) : null}

      <section className="access-metric-grid" aria-label="Access posture">
        <AdminMetricCard
          label="Active administrators"
          value={canReadAccounts ? metrics.active : '—'}
          icon="shield_person"
          detail={canReadAccounts ? `${accounts.length} bounded records loaded` : 'Permission required'}
          status={canReadAccounts ? 'Verified directory' : 'Restricted'}
          statusTone={canReadAccounts ? 'healthy' : 'unknown'}
          loading={accountsResource.loading}
        />
        <AdminMetricCard
          label="Recovery owners"
          value={canReadAccounts ? metrics.owners : '—'}
          icon="workspace_premium"
          detail="Owner changes remain outside the web surface"
          status={metrics.owners >= 2 ? 'Redundant' : 'Review recovery'}
          statusTone={metrics.owners >= 2 ? 'healthy' : 'degraded'}
          loading={accountsResource.loading}
        />
        <AdminMetricCard
          label="MFA-bound identities"
          value={canReadAccounts ? metrics.mfa : '—'}
          icon="phonelink_lock"
          detail={session?.mfaEnforced ? 'Enforcement enabled' : 'Enforcement rollout pending'}
          status={session?.mfaSatisfied ? 'This session verified' : 'This session single factor'}
          statusTone={session?.mfaSatisfied ? 'healthy' : 'degraded'}
          loading={accountsResource.loading}
        />
        <AdminMetricCard
          label="Needs attention"
          value={canReadAccounts ? metrics.attention : '—'}
          icon="policy_alert"
          detail="Suspended, provisioning, or failed invitation"
          status={metrics.attention ? 'Review queue' : 'Clear'}
          statusTone={metrics.attention ? 'degraded' : 'healthy'}
          loading={accountsResource.loading}
        />
      </section>

      <div className="access-primary-grid">
        <AdminPanel
          className="access-directory-panel"
          eyebrow="Versioned principals"
          title="Administrative directory"
          description="Owners and the current session are protected from web-based status or role changes."
          toolbar={<AdminStatusBadge tone="info">{accounts.length} loaded</AdminStatusBadge>}
        >
          <AdminStateBoundary
            state={accountsState}
            title={accountsState === 'unauthorized' ? 'Directory permission required' : undefined}
            message={accountsState === 'error' ? accountsResource.error : undefined}
            onRetry={accountsState === 'error' ? () => void accountsResource.refresh() : undefined}
          >
            <AdminDataTable
              columns={accountColumns}
              rows={accounts}
              rowKey={account => account.uid}
              caption="Administrative identities and guarded access controls"
              emptyMessage="No administrative identities were returned."
            />
          </AdminStateBoundary>
        </AdminPanel>

        <aside className="access-side-stack">
          <AdminPanel
            className="access-session-panel"
            eyebrow="Current operator"
            title="Session evidence"
            description="The browser receives a bounded identity receipt, never authorization authority."
          >
            <div className="access-session-card">
              <span className="access-session-icon" aria-hidden="true">
                <span className="material-symbols-rounded">verified_user</span>
              </span>
              <div>
                <strong>{session?.displayName || 'Administrator'}</strong>
                <small>{session?.email}</small>
              </div>
              <AdminStatusBadge tone={roleTone(session?.role || 'analyst')}>
                {session ? ADMIN_ROLE_LABELS[session.role] : 'Unknown'}
              </AdminStatusBadge>
            </div>
            <dl className="access-evidence-list">
              <div><dt>Token revocation</dt><dd>Checked on every route</dd></div>
              <div><dt>Claim version</dt><dd>Must match database</dd></div>
              <div><dt>MFA enforcement</dt><dd>{session?.mfaEnforced ? 'Enabled' : 'Rollout pending'}</dd></div>
              <div><dt>Second factor</dt><dd>{session?.mfaSatisfied ? 'Verified' : 'Not present'}</dd></div>
            </dl>
          </AdminPanel>

          <AdminPanel
            className="access-invite-panel"
            eyebrow="Owner only"
            title="Invite an administrator"
            description="Creates a non-owner identity and requests a secure invitation."
          >
            {canManageAccounts ? (
              <form className="access-invite-form" onSubmit={stageInvite}>
                <label>
                  <span>Work email</span>
                  <input
                    type="email"
                    required
                    maxLength={320}
                    value={form.email}
                    onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
                    placeholder="operator@company.com"
                  />
                </label>
                <label>
                  <span>Display name</span>
                  <input
                    type="text"
                    maxLength={120}
                    value={form.displayName}
                    onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))}
                    placeholder="Optional"
                  />
                </label>
                <label>
                  <span>Role</span>
                  <select
                    value={form.role}
                    onChange={event => setForm(current => ({
                      ...current,
                      role: event.target.value as AssignableRole,
                    }))}
                  >
                    {ASSIGNABLE_ROLES.map(role => (
                      <option key={role} value={role}>{ADMIN_ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </label>
                <p className="access-role-description">{ROLE_DESCRIPTIONS[form.role]}</p>
                <AdminButton
                  type="submit"
                  variant="primary"
                  icon="person_add"
                  disabled={!form.email}
                >
                  Review invitation
                </AdminButton>
              </form>
            ) : (
              <AdminStateBoundary
                state="unauthorized"
                compact
                title="Owner permission required"
                message="Only the owner role can create administrative identities."
              >
                <span />
              </AdminStateBoundary>
            )}
          </AdminPanel>
        </aside>
      </div>

      <div className="access-secondary-grid">
        <AdminPanel
          eyebrow="Explicit authorization"
          title="Role and permission matrix"
          description="Permissions are evaluated on the server. Hiding navigation is only a usability layer."
          className="access-role-matrix-panel"
        >
          <div className="access-role-matrix">
            {ADMIN_ROLES.map(role => {
              const permissions = permissionsForAdminRole(role);
              return (
                <article key={role} className={role === session?.role ? 'is-current' : ''}>
                  <header>
                    <AdminStatusBadge tone={roleTone(role)}>{ADMIN_ROLE_LABELS[role]}</AdminStatusBadge>
                    {role === session?.role ? <span>Current role</span> : null}
                  </header>
                  <p>{ROLE_DESCRIPTIONS[role]}</p>
                  <div className="access-permission-count">
                    <strong>{permissions.length}</strong>
                    <span>of {ADMIN_PERMISSIONS.length} explicit permissions</span>
                  </div>
                  <ul>
                    {permissions.slice(0, 5).map(permission => <li key={permission}>{permission}</li>)}
                    {permissions.length > 5 ? <li>+{permissions.length - 5} more</li> : null}
                  </ul>
                </article>
              );
            })}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Immutable evidence"
          title="Recent access changes"
          description="Server-written audit entries for provisioning, role changes, and suspensions."
          toolbar={canReadAudit ? <AdminStatusBadge tone={auditResource.stale ? 'degraded' : 'healthy'}>{auditResource.stale ? 'Stale' : 'Current'}</AdminStatusBadge> : undefined}
        >
          <AdminStateBoundary
            state={!canReadAudit
              ? 'unauthorized'
              : auditResource.loading
                ? 'loading'
                : auditResource.error && !auditResource.data
                  ? 'error'
                  : (auditResource.data?.audit.length || 0) === 0
                    ? 'empty'
                    : 'ready'}
            message={auditResource.error || undefined}
            onRetry={auditResource.error ? () => void auditResource.refresh() : undefined}
          >
            <ol className="access-audit-list">
              {(auditResource.data?.audit || []).slice(0, 10).map(entry => (
                <li key={entry.id}>
                  <span className="access-audit-icon" aria-hidden="true">
                    <span className="material-symbols-rounded">history</span>
                  </span>
                  <div>
                    <strong>{entry.action.replaceAll('.', ' ')}</strong>
                    <p>{entry.actorEmail || 'Bootstrap process'}{entry.targetEmail ? ` → ${entry.targetEmail}` : ''}</p>
                  </div>
                  <time dateTime={entry.occurredAt}>{formatDate(entry.occurredAt)}</time>
                </li>
              ))}
            </ol>
          </AdminStateBoundary>
        </AdminPanel>
      </div>

      <AdminConfirmationDialog
        open={inviteConfirmation !== ''}
        title="Create administrative access?"
        message={(
          <p>
            This will provision <strong>{form.email}</strong> as{' '}
            <strong>{ADMIN_ROLE_LABELS[form.role]}</strong> and request an invitation.
            Owner access cannot be created here.
          </p>
        )}
        confirmLabel="Create and invite"
        busy={busy}
        onCancel={() => {
          setInviteConfirmation('');
          setInviteReason('');
          setInviteIdempotencyKey('');
        }}
        onConfirm={() => void createAccount()}
      >
        <label className="admin-confirmation-field">
          <span>Operational reason</span>
          <textarea
            value={inviteReason}
            onChange={event => setInviteReason(event.target.value)}
            minLength={10}
            maxLength={500}
            rows={3}
            placeholder="At least 10 characters; written to the audit trail"
          />
        </label>
        <label className="admin-confirmation-field">
          <span>Type <strong>INVITE ADMIN</strong> to continue</span>
          <input
            type="text"
            value={inviteConfirmation === 'PENDING' ? '' : inviteConfirmation}
            onChange={event => setInviteConfirmation(event.target.value)}
            autoComplete="off"
          />
        </label>
        {inviteReason.trim().length < 10 || inviteConfirmation !== 'INVITE ADMIN'
          ? <p className="admin-confirmation-hint">A reason and exact confirmation are required.</p>
          : null}
      </AdminConfirmationDialog>

      <AdminConfirmationDialog
        open={pendingChange !== null}
        title="Apply guarded access change?"
        message={(
          <p>
            {safeChangeLabel(pendingChange)}. The affected identity will receive a new claim
            version and active sessions may be revoked.
          </p>
        )}
        confirmLabel="Apply access change"
        tone={pendingChange?.kind === 'status' && pendingChange.status === 'suspended' ? 'danger' : 'primary'}
        busy={busy}
        onCancel={() => {
          setPendingChange(null);
          setChangeConfirmation('');
          setChangeReason('');
          setChangeIdempotencyKey('');
        }}
        onConfirm={() => void applyAccountChange()}
      >
        <label className="admin-confirmation-field">
          <span>Operational reason</span>
          <textarea
            value={changeReason}
            onChange={event => setChangeReason(event.target.value)}
            minLength={10}
            maxLength={500}
            rows={3}
            placeholder="At least 10 characters; written to the audit trail"
          />
        </label>
        <label className="admin-confirmation-field">
          <span>Type <strong>CONFIRM ADMIN CHANGE</strong> to continue</span>
          <input
            type="text"
            value={changeConfirmation}
            onChange={event => setChangeConfirmation(event.target.value)}
            autoComplete="off"
          />
        </label>
        {changeReason.trim().length < 10 || changeConfirmation !== 'CONFIRM ADMIN CHANGE'
          ? <p className="admin-confirmation-hint">A reason and exact confirmation are required.</p>
          : null}
      </AdminConfirmationDialog>
    </div>
  );
}
