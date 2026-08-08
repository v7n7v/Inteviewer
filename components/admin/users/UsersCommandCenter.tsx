'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { AdminButton } from '@/components/admin/primitives/AdminButton';
import { AdminConfirmationDialog } from '@/components/admin/primitives/AdminConfirmationDialog';
import {
  AdminDataTable,
  type AdminDataColumn,
} from '@/components/admin/primitives/AdminDataTable';
import { AdminDetailDrawer } from '@/components/admin/primitives/AdminDetailDrawer';
import { AdminFilterBar } from '@/components/admin/primitives/AdminFilterBar';
import { AdminMetricCard } from '@/components/admin/primitives/AdminMetricCard';
import { AdminPanel } from '@/components/admin/primitives/AdminPanel';
import { AdminStateBoundary } from '@/components/admin/primitives/AdminStateBoundary';
import { AdminStatusBadge, type AdminStatusTone } from '@/components/admin/primitives/AdminStatusBadge';
import { useAdminSession } from '@/components/admin/shell/AdminSessionProvider';

type UserPlan = 'free' | 'pro' | 'studio';
type BillingEvidenceStatus = 'complete' | 'incomplete' | 'unknown';

interface DirectoryUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  plan: UserPlan;
  subscriptionStatus: string;
  billingEvidenceStatus: BillingEvidenceStatus;
}

interface UserDetail extends DirectoryUser {
  billingSupportStatus: 'new' | 'reviewing' | 'resolved' | null;
}

interface DirectoryResponse {
  users: DirectoryUser[];
  nextPageToken: string | null;
  meta: {
    generatedAt: string;
    staleAfterMs: number;
    partial: boolean;
    truncated: boolean;
  };
}

interface UsageMeter {
  key: string;
  label: string;
  used: number;
  /** null means unmetered on this plan. Never render it as a limit of zero. */
  cap: number | null;
  unit: 'count' | 'minutes' | 'words';
}

interface UserActivity {
  onboardingCompleted: boolean;
  applications: number;
  resumeVersions: number;
  meters: UsageMeter[];
}

interface DetailResponse {
  user: UserDetail;
  activity?: UserActivity;
}

function meterValue(meter: UsageMeter) {
  const unit = meter.unit === 'count' ? '' : ` ${meter.unit}`;
  if (meter.cap === null) return `${meter.used.toLocaleString()}${unit} · no limit`;
  return `${meter.used.toLocaleString()} of ${meter.cap.toLocaleString()}${unit}`;
}

/** Only a real cap can be "at" or "near" it. An unmetered counter is neither. */
function meterTone(meter: UsageMeter) {
  if (meter.cap === null || meter.cap === 0) return 'info' as const;
  if (meter.used >= meter.cap) return 'critical' as const;
  if (meter.used >= meter.cap * 0.8) return 'degraded' as const;
  return 'healthy' as const;
}

interface PendingUserChange {
  user: UserDetail;
  disabled: boolean;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No evidence';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'No evidence'
    : new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
}

function relativeSignIn(value: string | null) {
  if (!value) return 'Never signed in';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Unknown';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(value);
}

function planTone(plan: UserPlan): AdminStatusTone {
  if (plan === 'studio') return 'pending';
  if (plan === 'pro') return 'info';
  return 'unknown';
}

function billingTone(status: BillingEvidenceStatus): AdminStatusTone {
  if (status === 'complete') return 'healthy';
  if (status === 'incomplete') return 'degraded';
  return 'unknown';
}

function isDirectoryResponse(value: unknown): value is DirectoryResponse {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<DirectoryResponse>;
  return Array.isArray(payload.users)
    && (typeof payload.nextPageToken === 'string' || payload.nextPageToken === null)
    && Boolean(payload.meta && typeof payload.meta.generatedAt === 'string');
}

export function UsersCommandCenter() {
  const { session, hasPermission } = useAdminSession();
  const canRead = hasPermission('users.read');
  const canManage = hasPermission('users.manage');
  const mutationEligible = canManage
    && session?.mfaEnforced === true
    && session.mfaSatisfied;
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | UserPlan>('all');
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'disabled' | 'unverified'>('all');
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [loading, setLoading] = useState(canRead);
  const [refreshing, setRefreshing] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [pendingChange, setPendingChange] = useState<PendingUserChange | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [reason, setReason] = useState('');
  const [mutationIdempotencyKey, setMutationIdempotencyKey] = useState('');
  const [mutationBusy, setMutationBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [mutationError, setMutationError] = useState('');
  const directoryRequest = useRef(0);
  const directoryController = useRef<AbortController | null>(null);
  const hasDirectory = useRef(false);
  const detailRequest = useRef(0);
  const detailController = useRef<AbortController | null>(null);


  const loadDirectory = useCallback(async (background = false) => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    const sequence = directoryRequest.current + 1;
    directoryRequest.current = sequence;
    directoryController.current?.abort();
    const controller = new AbortController();
    directoryController.current = controller;
    if (background || hasDirectory.current) setRefreshing(true);
    else setLoading(true);
    setDirectoryError('');
    /* Never sends `pageToken`. The route rejects it outright with
       ADMIN_USER_ENUMERATION_BLOCKED, so sending one is a guaranteed 400. */
    const params = new URLSearchParams({ limit: '25' });
    if (appliedQuery) params.set('search', appliedQuery);

    try {
      const response = await authFetch(`/api/admin/users?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok || !isDirectoryResponse(payload)) {
        throw new Error(payload.error || 'The user directory could not be loaded.');
      }
      if (sequence !== directoryRequest.current) return;
      setDirectory(payload);
      hasDirectory.current = true;
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      if (controller.signal.aborted || sequence !== directoryRequest.current) return;
      setDirectoryError(error instanceof Error ? error.message : 'The user directory could not be loaded.');
    } finally {
      if (sequence === directoryRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [appliedQuery, canRead]);

  useEffect(() => {
    void loadDirectory(false);
    return () => directoryController.current?.abort();
  }, [loadDirectory]);

  const loadDetail = useCallback(async (uid: string, background = false) => {
    if (!canRead) return;
    const sequence = detailRequest.current + 1;
    detailRequest.current = sequence;
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    if (!background) {
      setDetail(null);
      setActivity(null);
      setDetailLoading(true);
    }
    setDetailError('');
    try {
      const response = await authFetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as Partial<DetailResponse> & { error?: string };
      if (!response.ok || !payload.user) {
        throw new Error(payload.error || 'The user evidence could not be loaded.');
      }
      if (sequence !== detailRequest.current) return;
      setDetail(payload.user);
      /* Optional on purpose. An older deployment of the route returns no `activity`, and
         the drawer degrades to the evidence sections rather than rendering empty meters. */
      setActivity(payload.activity ?? null);
    } catch (error) {
      if (controller.signal.aborted || sequence !== detailRequest.current) return;
      setDetailError(error instanceof Error ? error.message : 'The user evidence could not be loaded.');
    } finally {
      if (sequence === detailRequest.current) setDetailLoading(false);
    }
  }, [canRead]);

  useEffect(() => () => detailController.current?.abort(), []);

  const visibleUsers = useMemo(() => {
    const users = directory?.users || [];
    return users.filter(user => {
      if (planFilter !== 'all' && user.plan !== planFilter) return false;
      if (stateFilter === 'active' && (user.disabled || !user.emailVerified)) return false;
      if (stateFilter === 'disabled' && !user.disabled) return false;
      if (stateFilter === 'unverified' && user.emailVerified) return false;
      return true;
    });
  }, [directory?.users, planFilter, stateFilter]);

  const pageMetrics = useMemo(() => ({
    loaded: directory?.users.length || 0,
    active: (directory?.users || []).filter(user => !user.disabled).length,
    verified: (directory?.users || []).filter(user => user.emailVerified).length,
    paid: (directory?.users || []).filter(user => user.plan !== 'free').length,
  }), [directory?.users]);

  function openUser(user: DirectoryUser) {
    setSelectedUid(user.uid);
    void loadDetail(user.uid);
  }

  function applySearch() {
    const nextQuery = query.trim().slice(0, 160);
    if (nextQuery === appliedQuery) {
      void loadDirectory(true);
      return;
    }
    setAppliedQuery(nextQuery);
  }

  function clearFilters() {
    setQuery('');
    setAppliedQuery('');
    setPlanFilter('all');
    setStateFilter('all');
  }

  async function applyStatusChange() {
    if (!pendingChange || !mutationEligible || !mutationIdempotencyKey) return;
    const exactText = pendingChange.disabled ? 'DISABLE USER' : 'ENABLE USER';
    if (confirmationText !== exactText || reason.trim().length < 10) return;
    setMutationBusy(true);
    setMutationError('');
    setNotice('');
    try {
      const response = await authFetch(`/api/admin/users/${encodeURIComponent(pendingChange.user.uid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disabled: pendingChange.disabled,
          reason: reason.trim(),
          confirmationText,
          idempotencyKey: mutationIdempotencyKey,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The user state could not be changed.');
      setNotice(
        pendingChange.disabled
          ? 'The user was disabled. This action is recorded in the administrative audit trail.'
          : 'The user was enabled. This action is recorded in the administrative audit trail.',
      );
      const uid = pendingChange.user.uid;
      setPendingChange(null);
      setConfirmationText('');
      setReason('');
      setMutationIdempotencyKey('');
      await Promise.all([loadDirectory(true), loadDetail(uid, true)]);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'The user state could not be changed.');
    } finally {
      setMutationBusy(false);
    }
  }

  const columns = useMemo<readonly AdminDataColumn<DirectoryUser>[]>(() => [
    {
      key: 'identity',
      header: 'User',
      render: user => (
        <div className="users-identity-cell">
          <span className="users-avatar" aria-hidden="true">
            {(user.displayName || user.email || '?').slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{user.displayName || user.email.split('@')[0] || 'Unnamed user'}</strong>
            <small>{user.email || 'No verified email'}</small>
          </span>
        </div>
      ),
    },
    {
      key: 'account',
      header: 'Account state',
      render: user => (
        <div className="users-badge-stack">
          <AdminStatusBadge tone={user.disabled ? 'critical' : 'healthy'}>
            {user.disabled ? 'Disabled' : 'Active'}
          </AdminStatusBadge>
          <span>{user.emailVerified ? 'Email verified' : 'Email unverified'}</span>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: user => (
        <div className="users-badge-stack">
          <AdminStatusBadge tone={planTone(user.plan)}>{user.plan}</AdminStatusBadge>
          <span>{user.subscriptionStatus || 'No status'}</span>
        </div>
      ),
    },
    {
      key: 'billing',
      header: 'Billing evidence',
      render: user => (
        <AdminStatusBadge tone={billingTone(user.billingEvidenceStatus)}>
          {user.billingEvidenceStatus}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'lastSignIn',
      header: 'Last sign-in',
      render: user => (
        <span className="users-date-cell">
          <strong>{relativeSignIn(user.lastSignInAt)}</strong>
          <small>{formatDate(user.lastSignInAt)}</small>
        </span>
      ),
    },
    {
      key: 'open',
      header: 'Evidence',
      align: 'right',
      render: () => (
        <span className="users-open-label">
          Inspect
          <span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
        </span>
      ),
    },
  ], []);

  const directoryState = !canRead
    ? 'unauthorized'
    : loading
      ? 'loading'
      : directoryError && !directory
        ? 'error'
        : visibleUsers.length === 0
          ? 'empty'
          : 'ready';
  const stale = Boolean(directory && (
    directoryError
    || (lastUpdatedAt && Date.now() - new Date(lastUpdatedAt).getTime() > (directory.meta.staleAfterMs || 60_000))
  ));
  const expectedConfirmation = pendingChange?.disabled ? 'DISABLE USER' : 'ENABLE USER';

  return (
    <div className="users-module">
      <header className="admin-module-hero users-module-hero">
        <div>
          <p className="admin-module-kicker">Private identity workspace</p>
          <h1>User directory</h1>
          <p>
            Inspect bounded account, subscription, and support evidence. Personally identifiable
            information stays inside this permissioned module.
          </p>
        </div>
        <div className="users-hero-actions">
          <div className="users-page-evidence">
            <span>Bounded read</span>
            <strong>25 records per page</strong>
          </div>
          <AdminButton
            icon="refresh"
            busy={refreshing}
            onClick={() => void loadDirectory(true)}
            disabled={!canRead}
          >
            Refresh page
          </AdminButton>
        </div>
      </header>

      {mutationError ? <div className="admin-module-alert is-error" role="alert">{mutationError}</div> : null}
      {notice ? <div className="admin-module-alert is-success" role="status">{notice}</div> : null}
      {stale ? (
        <div className="admin-module-alert is-warning" role="status">
          Showing the last verified page. The newest directory read has not replaced it.
        </div>
      ) : null}

      <section className="users-metric-grid" aria-label="Current page evidence">
        <AdminMetricCard
          label="Loaded records"
          value={canRead ? pageMetrics.loaded : '—'}
          icon="group"
          detail="Current Firebase Auth page only"
          status={directory?.meta.truncated ? 'More available' : 'End of bounded read'}
          statusTone={directory?.meta.truncated ? 'info' : 'healthy'}
          loading={loading}
        />
        <AdminMetricCard
          label="Enabled accounts"
          value={canRead ? pageMetrics.active : '—'}
          icon="person_check"
          detail="Not a platform-wide total"
          status="Page sample"
          statusTone="unknown"
          loading={loading}
        />
        <AdminMetricCard
          label="Verified emails"
          value={canRead ? pageMetrics.verified : '—'}
          icon="mark_email_read"
          detail="Authoritative Firebase identity evidence"
          status="Page sample"
          statusTone="info"
          loading={loading}
        />
        <AdminMetricCard
          label="Paid plans"
          value={canRead ? pageMetrics.paid : '—'}
          icon="workspace_premium"
          detail="Subscription receipts joined for loaded users"
          status="Page sample"
          statusTone="pending"
          loading={loading}
        />
      </section>

      <AdminPanel
        className="users-directory-panel"
        eyebrow="Bounded private read"
        title="User evidence"
        description="Exact email or UID lookup uses Firebase authority. Name matching and browsing stay bounded; plan and state filters refine loaded records."
        toolbar={(
          <AdminStatusBadge tone={stale ? 'degraded' : 'healthy'} live={!stale}>
            {stale ? 'Last good evidence' : 'Verified page'}
          </AdminStatusBadge>
        )}
        /* No pagination. `GET /api/admin/users` returns `nextPageToken: null`
           unconditionally and rejects any `pageToken` with
           ADMIN_USER_ENUMERATION_BLOCKED - directory enumeration is deliberately
           disabled. The Previous/Next buttons that used to sit here predated that
           decision and could never advance; a disabled control that can never enable
           reads as a broken feature rather than an absent one. */
        footer={(
          <div className="users-pagination">
            <div>
              <strong>Exact lookup only</strong>
              <span>Directory enumeration is disabled. Search by full email address or Firebase UID.</span>
            </div>
          </div>
        )}
      >
        <AdminFilterBar
          searchValue={query}
          searchPlaceholder="Email, name, or UID"
          searchLabel="Look up an exact email or UID, or search the bounded user page"
          onSearchChange={setQuery}
          actions={(
            <>
              <AdminButton size="sm" variant="primary" icon="search" onClick={applySearch}>
                Search page
              </AdminButton>
              <AdminButton size="sm" variant="ghost" onClick={clearFilters}>
                Clear
              </AdminButton>
            </>
          )}
        >
          <label className="admin-compact-field">
            <span className="sr-only">Filter by plan</span>
            <select value={planFilter} onChange={event => setPlanFilter(event.target.value as typeof planFilter)}>
              <option value="all">All plans</option>
              <option value="free">Free</option>
              <option value="pro">Standard</option>
              <option value="studio">Max / Studio</option>
            </select>
          </label>
          <label className="admin-compact-field">
            <span className="sr-only">Filter by account state</span>
            <select value={stateFilter} onChange={event => setStateFilter(event.target.value as typeof stateFilter)}>
              <option value="all">All states</option>
              <option value="active">Active + verified</option>
              <option value="disabled">Disabled</option>
              <option value="unverified">Email unverified</option>
            </select>
          </label>
        </AdminFilterBar>

        {directory?.meta.partial ? (
          <div className="users-scope-note" role="status">
            <span className="material-symbols-rounded" aria-hidden="true">filter_alt</span>
            This fuzzy result is partial because display-name matching is bounded to the current Firebase Auth page. Use an exact email or UID for authoritative lookup.
          </div>
        ) : null}

        <AdminStateBoundary
          state={directoryState}
          title={directoryState === 'empty' ? 'No users match this bounded view' : undefined}
          message={directoryError || (directoryState === 'empty'
            ? 'Clear the filters, search another term, or move to another provider page.'
            : undefined)}
          onRetry={directoryState === 'error' ? () => void loadDirectory(true) : undefined}
        >
          <AdminDataTable
            columns={columns}
            rows={visibleUsers}
            rowKey={user => user.uid}
            caption="Private user identity, subscription, and billing evidence"
            onRowActivate={openUser}
            rowLabel={user => `Open private evidence for ${user.displayName || user.email}`}
          />
        </AdminStateBoundary>
      </AdminPanel>

      <AdminDetailDrawer
        open={selectedUid !== null}
        title={detail?.displayName || detail?.email || 'User evidence'}
        description="Private account and billing receipt evidence"
        size="md"
        onClose={() => {
          setSelectedUid(null);
          setDetail(null);
          setActivity(null);
          setDetailError('');
        }}
        footer={detail ? (
          <div className="users-drawer-actions">
            <span className="users-mutation-posture">
              <span className="material-symbols-rounded" aria-hidden="true">
                {mutationEligible ? 'verified_user' : 'lock'}
              </span>
              {mutationEligible ? 'MFA mutation posture verified' : 'Status mutation locked'}
            </span>
            {canManage ? (
              <AdminButton
                variant={detail.disabled ? 'secondary' : 'danger'}
                icon={detail.disabled ? 'person_check' : 'person_off'}
                disabled={!mutationEligible}
                onClick={() => {
                  setPendingChange({ user: detail, disabled: !detail.disabled });
                  setConfirmationText('');
                  setReason('');
                  setMutationIdempotencyKey(`user-status-${crypto.randomUUID()}`);
                  setMutationError('');
                }}
              >
                {detail.disabled ? 'Enable user' : 'Disable user'}
              </AdminButton>
            ) : null}
          </div>
        ) : undefined}
      >
        <AdminStateBoundary
          state={detailLoading ? 'loading' : detailError ? 'error' : detail ? 'ready' : 'empty'}
          message={detailError || undefined}
          onRetry={detailError && selectedUid ? () => void loadDetail(selectedUid) : undefined}
        >
          {detail ? (
            <div className="users-detail">
              <section className="users-detail-identity">
                <span className="users-detail-avatar" aria-hidden="true">
                  {(detail.displayName || detail.email || '?').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{detail.displayName || 'No display name'}</strong>
                  <p>{detail.email || 'No email evidence'}</p>
                  <code>{detail.uid}</code>
                </div>
              </section>

              <section className="users-detail-section">
                <header>
                  <span className="material-symbols-rounded" aria-hidden="true">badge</span>
                  <h3>Identity evidence</h3>
                </header>
                <dl className="users-detail-list">
                  <div><dt>Account state</dt><dd><AdminStatusBadge tone={detail.disabled ? 'critical' : 'healthy'}>{detail.disabled ? 'Disabled' : 'Active'}</AdminStatusBadge></dd></div>
                  <div><dt>Email</dt><dd><AdminStatusBadge tone={detail.emailVerified ? 'healthy' : 'degraded'}>{detail.emailVerified ? 'Verified' : 'Unverified'}</AdminStatusBadge></dd></div>
                  <div><dt>Created</dt><dd>{formatDate(detail.createdAt)}</dd></div>
                  <div><dt>Last sign-in</dt><dd>{formatDate(detail.lastSignInAt)}</dd></div>
                </dl>
              </section>

              <section className="users-detail-section">
                <header>
                  <span className="material-symbols-rounded" aria-hidden="true">receipt_long</span>
                  <h3>Billing evidence</h3>
                </header>
                <dl className="users-detail-list">
                  <div><dt>Plan</dt><dd><AdminStatusBadge tone={planTone(detail.plan)}>{detail.plan}</AdminStatusBadge></dd></div>
                  <div><dt>Subscription</dt><dd>{detail.subscriptionStatus}</dd></div>
                  <div><dt>Receipt completeness</dt><dd><AdminStatusBadge tone={billingTone(detail.billingEvidenceStatus)}>{detail.billingEvidenceStatus}</AdminStatusBadge></dd></div>
                  <div><dt>Support review</dt><dd>{detail.billingSupportStatus || 'No current case'}</dd></div>
                </dl>
              </section>

              {activity ? (
                <section className="users-detail-section">
                  <header>
                    <span className="material-symbols-rounded" aria-hidden="true">monitoring</span>
                    <h3>Product activity</h3>
                  </header>
                  <dl className="users-detail-list">
                    <div><dt>Onboarding</dt><dd>{activity.onboardingCompleted ? 'Completed' : 'Not completed'}</dd></div>
                    <div><dt>Applications</dt><dd>{activity.applications.toLocaleString()}</dd></div>
                    <div><dt>Resume versions</dt><dd>{activity.resumeVersions.toLocaleString()}</dd></div>
                  </dl>
                  {/* Counts, never contents. `applications` carries employer names, job
                      descriptions and offer amounts, and `profile/main` carries the full
                      resume in plaintext - none of it belongs on a support operator's
                      screen just because an admin token can read it. */}
                  <p className="users-detail-note">
                    Counts only. Resume text, application contents and contacts are not read by this console.
                  </p>
                </section>
              ) : null}

              {activity && activity.meters.length > 0 ? (
                <section className="users-detail-section">
                  <header>
                    <span className="material-symbols-rounded" aria-hidden="true">speed</span>
                    <h3>Usage against caps</h3>
                  </header>
                  <dl className="users-detail-list">
                    {activity.meters.map(meter => (
                      <div key={meter.key}>
                        <dt>{meter.label}</dt>
                        <dd>
                          <AdminStatusBadge tone={meterTone(meter)}>{meterValue(meter)}</AdminStatusBadge>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}

              {!mutationEligible && canManage ? (
                <div className="users-rollout-lock">
                  <span className="material-symbols-rounded" aria-hidden="true">shield_lock</span>
                  <div>
                    <strong>Status controls are safely locked</strong>
                    <p>Verified MFA enforcement and a second-factor session are required before expanded user mutations appear.</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : <span />}
        </AdminStateBoundary>
      </AdminDetailDrawer>

      <AdminConfirmationDialog
        open={pendingChange !== null}
        title={`${pendingChange?.disabled ? 'Disable' : 'Enable'} this user?`}
        message={(
          <p>
            This changes the authoritative Firebase Auth status for{' '}
            <strong>{pendingChange?.user.email || pendingChange?.user.uid}</strong>.
            Administrator principals are protected by the API and cannot be changed here.
          </p>
        )}
        confirmLabel={pendingChange?.disabled ? 'Disable user' : 'Enable user'}
        tone={pendingChange?.disabled ? 'danger' : 'primary'}
        busy={mutationBusy}
        onCancel={() => {
          setPendingChange(null);
          setConfirmationText('');
          setReason('');
          setMutationIdempotencyKey('');
        }}
        onConfirm={() => void applyStatusChange()}
      >
        <label className="admin-confirmation-field">
          <span>Operational reason</span>
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            minLength={10}
            maxLength={500}
            rows={3}
            placeholder="At least 10 characters; written to the audit record"
          />
        </label>
        <label className="admin-confirmation-field">
          <span>Type <strong>{expectedConfirmation}</strong> to continue</span>
          <input
            type="text"
            value={confirmationText}
            onChange={event => setConfirmationText(event.target.value)}
            autoComplete="off"
          />
        </label>
        {reason.trim().length < 10 || confirmationText !== expectedConfirmation ? (
          <p className="admin-confirmation-hint">A reason and exact confirmation are required.</p>
        ) : null}
      </AdminConfirmationDialog>
    </div>
  );
}
