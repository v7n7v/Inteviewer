'use client';

import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import {
  STRIPE_ACCOUNT_REVIEW_CLOSE_CONFIRMATION,
  STRIPE_ACCOUNT_REVIEW_EVIDENCE_TTL_MS,
  type StripeAccountReviewEvidence,
  type StripeAccountReviewStatus,
} from '@/lib/billing/stripe-account-review-case';
import { useAdminResource } from '@/hooks/useAdminResource';
import { AdminButton } from '@/components/admin/primitives/AdminButton';
import { AdminConfirmationDialog } from '@/components/admin/primitives/AdminConfirmationDialog';
import {
  AdminDataTable,
  type AdminDataColumn,
} from '@/components/admin/primitives/AdminDataTable';
import { AdminDetailDrawer } from '@/components/admin/primitives/AdminDetailDrawer';
import { AdminFreshnessMeter } from '@/components/admin/primitives/AdminFreshnessMeter';
import { AdminMetricCard } from '@/components/admin/primitives/AdminMetricCard';
import { AdminPanel } from '@/components/admin/primitives/AdminPanel';
import { AdminStateBoundary } from '@/components/admin/primitives/AdminStateBoundary';
import {
  AdminStatusBadge,
  type AdminStatusTone,
} from '@/components/admin/primitives/AdminStatusBadge';
import { useAdminSession } from '@/components/admin/shell/AdminSessionProvider';

interface SupportHistoryEntry {
  at?: string;
  by?: string;
  action?: string;
  note?: string;
  status?: string;
  linkedCustomerCount?: number;
  prospectiveCustomerCount?: number;
}

interface BillingSupportCase {
  caseId: string;
  uid: string | null;
  email: string | null;
  name: string | null;
  issueCode: 'stripe_account_review_required';
  message: string;
  status: StripeAccountReviewStatus;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  operatorNote: string;
  checkoutAccountEvidence: StripeAccountReviewEvidence | null;
  history: SupportHistoryEntry[];
}

interface SupportCasesPayload {
  cases: BillingSupportCase[];
  meta: {
    generatedAt: string;
    staleAfterMs: number;
    partial: boolean;
    truncated: boolean;
  };
}

type CaseFilter = 'open' | StripeAccountReviewStatus | 'all';
type PendingAction = 'reviewing' | 'resolved' | null;

function parseCases(payload: unknown): SupportCasesPayload {
  const value = payload as Partial<SupportCasesPayload>;
  return {
    cases: Array.isArray(value.cases) ? value.cases : [],
    meta: {
      generatedAt: value.meta?.generatedAt || new Date().toISOString(),
      staleAfterMs: value.meta?.staleAfterMs || 60_000,
      partial: value.meta?.partial === true,
      truncated: value.meta?.truncated === true,
    },
  };
}

function dateTime(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function relativeAge(value: string | null | undefined, now: number) {
  if (!value) return 'Unknown age';
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return 'Unknown age';
  const seconds = Math.max(0, Math.floor((now - parsed) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

function statusTone(status: StripeAccountReviewStatus): AdminStatusTone {
  if (status === 'resolved') return 'healthy';
  if (status === 'reviewing') return 'degraded';
  return 'critical';
}

function evidenceFresh(evidence: StripeAccountReviewEvidence | null, now: number) {
  if (!evidence || evidence.status !== 'ready') return false;
  const verifiedAt = new Date(evidence.verifiedAt).getTime();
  return Number.isFinite(verifiedAt)
    && verifiedAt <= now
    && now - verifiedAt <= STRIPE_ACCOUNT_REVIEW_EVIDENCE_TTL_MS;
}

function evidenceAgeSeconds(evidence: StripeAccountReviewEvidence | null, now: number) {
  if (!evidence) return null;
  const verifiedAt = new Date(evidence.verifiedAt).getTime();
  return Number.isFinite(verifiedAt) ? Math.max(0, (now - verifiedAt) / 1_000) : null;
}

function identityLabel(item: BillingSupportCase) {
  return item.name || item.email || 'Customer identity unavailable';
}

function actionLabel(action: string | undefined) {
  return (action || 'evidence recorded').replaceAll('_', ' ');
}

export function SupportCommandCenter() {
  const { hasPermission } = useAdminSession();
  const canRead = hasPermission('support.read');
  const canManage = hasPermission('support.manage');
  const casesResource = useAdminResource<SupportCasesPayload>(
    '/api/admin/billing/support-cases?limit=75',
    {
      enabled: canRead,
      intervalMs: 60_000,
      staleAfterMs: 90_000,
      parse: parseCases,
    },
  );
  const [filter, setFilter] = useState<CaseFilter>('open');
  const [query, setQuery] = useState('');
  const [selectedCase, setSelectedCase] = useState<BillingSupportCase | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [note, setNote] = useState('');
  const [accountHistoryReviewed, setAccountHistoryReviewed] = useState(false);
  const [checkoutSafetyReviewed, setCheckoutSafetyReviewed] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [verificationIdempotencyKey, setVerificationIdempotencyKey] = useState('');
  const [notice, setNotice] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const cases = casesResource.data?.cases || [];
  const counts = useMemo(() => ({
    new: cases.filter(item => item.status === 'new').length,
    reviewing: cases.filter(item => item.status === 'reviewing').length,
    resolved: cases.filter(item => item.status === 'resolved').length,
    staleEvidence: cases.filter(item => (
      item.status === 'reviewing' && !evidenceFresh(item.checkoutAccountEvidence, clock)
    )).length,
  }), [cases, clock]);
  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cases.filter(item => {
      const matchesStatus = filter === 'all'
        || (filter === 'open' ? item.status !== 'resolved' : item.status === filter);
      if (!matchesStatus) return false;
      if (!normalizedQuery) return true;
      return [
        item.caseId,
        item.email,
        item.name,
        item.message,
      ].some(value => String(value || '').toLowerCase().includes(normalizedQuery));
    });
  }, [cases, filter, query]);

  const columns = useMemo<readonly AdminDataColumn<BillingSupportCase>[]>(() => [
    {
      key: 'customer',
      header: 'Customer',
      render: item => (
        <span className="support-identity-cell">
          <span className="support-avatar" aria-hidden="true">
            {identityLabel(item).slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{identityLabel(item)}</strong>
            <small>{item.email || 'Verified email unavailable'}</small>
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Review state',
      render: item => <AdminStatusBadge tone={statusTone(item.status)}>{item.status}</AdminStatusBadge>,
    },
    {
      key: 'evidence',
      header: 'Stripe evidence',
      render: item => {
        const fresh = evidenceFresh(item.checkoutAccountEvidence, clock);
        return (
          <span className="support-evidence-cell">
            <AdminStatusBadge
              tone={fresh
                ? 'healthy'
                : item.checkoutAccountEvidence?.status === 'blocked'
                  ? 'critical'
                  : 'unknown'}
            >
              {fresh
                ? 'Fresh · ready'
                : item.checkoutAccountEvidence?.status === 'blocked'
                  ? 'Blocked'
                  : item.checkoutAccountEvidence
                    ? 'Expired'
                    : 'Not checked'}
            </AdminStatusBadge>
            <small>{item.checkoutAccountEvidence
              ? relativeAge(item.checkoutAccountEvidence.verifiedAt, clock)
              : '15-minute evidence required'}</small>
          </span>
        );
      },
    },
    {
      key: 'age',
      header: 'Updated',
      render: item => (
        <span className="support-date-cell">
          <strong>{relativeAge(item.updatedAt || item.createdAt, clock)}</strong>
          <small>{dateTime(item.updatedAt || item.createdAt)}</small>
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: item => (
        <AdminButton
          size="sm"
          variant={item.status === 'resolved' ? 'ghost' : 'secondary'}
          trailingIcon="chevron_right"
          onClick={event => {
            event.stopPropagation();
            setSelectedCase(item);
          }}
        >
          {item.status === 'resolved' ? 'View history' : 'Review case'}
        </AdminButton>
      ),
    },
  ], [clock]);

  function stageAction(action: Exclude<PendingAction, null>) {
    if (!selectedCase || !canManage || selectedCase.status === 'resolved') return;
    setPendingAction(action);
    setNote(selectedCase.operatorNote || '');
    setAccountHistoryReviewed(false);
    setCheckoutSafetyReviewed(false);
    setConfirmationText('');
    setIdempotencyKey(`support-${selectedCase.caseId}-${action}-${crypto.randomUUID()}`);
    setMutationError('');
  }

  async function runTransition() {
    if (!selectedCase || !pendingAction || !canManage || !idempotencyKey) return;
    if (pendingAction === 'reviewing' && note.trim().length < 5) return;
    if (pendingAction === 'resolved' && !resolveReady) return;
    setBusyAction(pendingAction);
    setMutationError('');
    setNotice('');
    try {
      const response = await authFetch(
        `/api/admin/billing/support-cases/${encodeURIComponent(selectedCase.caseId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: pendingAction,
            note: note.trim(),
            accountHistoryReviewed: pendingAction === 'resolved' ? accountHistoryReviewed : undefined,
            checkoutSafetyReviewed: pendingAction === 'resolved' ? checkoutSafetyReviewed : undefined,
            confirmationText: pendingAction === 'resolved' ? confirmationText : undefined,
            idempotencyKey,
          }),
        },
      );
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The billing review could not be updated.');
      setNotice(pendingAction === 'reviewing'
        ? 'Account review started. The operator note and append-only history entry were recorded.'
        : 'Billing review resolved. The private customer receipt now exposes lifecycle status only.');
      setPendingAction(null);
      setSelectedCase(null);
      await casesResource.refresh();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'The billing review could not be updated.');
    } finally {
      setBusyAction('');
    }
  }

  async function verifyCustomerEvidence() {
    if (!selectedCase || !canManage || selectedCase.status === 'resolved') return;
    setBusyAction('verify');
    setMutationError('');
    setNotice('');
    const idempotencyKey = verificationIdempotencyKey
      || `support-verify-${selectedCase.caseId}-${crypto.randomUUID()}`;
    if (!verificationIdempotencyKey) setVerificationIdempotencyKey(idempotencyKey);
    try {
      const response = await authFetch(
        `/api/admin/billing/support-cases/${encodeURIComponent(selectedCase.caseId)}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idempotencyKey }),
        },
      );
      const payload = await response.json().catch(() => ({})) as {
        evidence?: StripeAccountReviewEvidence;
        error?: string;
      };
      if (!response.ok || !payload.evidence) {
        throw new Error(payload.error || 'Customer evidence could not be verified.');
      }
      setVerificationIdempotencyKey('');
      setSelectedCase(current => current ? {
        ...current,
        checkoutAccountEvidence: payload.evidence || null,
        updatedAt: new Date().toISOString(),
      } : current);
      setNotice(
        payload.evidence.status === 'ready'
          ? 'Aggregate Stripe customer evidence is ready for 15 minutes. No Stripe object was changed.'
          : 'Aggregate Stripe evidence blocked closure. No Stripe object was changed.',
      );
      await casesResource.refresh();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Customer evidence could not be verified.');
    } finally {
      setBusyAction('');
    }
  }

  const listState = !canRead
    ? 'unauthorized'
    : casesResource.loading
      ? 'loading'
      : casesResource.error && !casesResource.data
        ? 'error'
        : filteredCases.length === 0
          ? 'empty'
          : 'ready';
  const selectedEvidenceFresh = evidenceFresh(selectedCase?.checkoutAccountEvidence || null, clock);
  const resolveReady = selectedCase?.status === 'reviewing'
    && selectedEvidenceFresh
    && note.trim().length >= 10
    && accountHistoryReviewed
    && checkoutSafetyReviewed
    && confirmationText === STRIPE_ACCOUNT_REVIEW_CLOSE_CONFIRMATION;

  return (
    <div className="support-command-center">
      <header className="support-hero">
        <div>
          <p className="support-kicker">Billing recovery desk</p>
          <h1>Support cases</h1>
          <p>
            Review Stripe account-safety exceptions with aggregate provider evidence,
            append-only operator history, and a private customer lifecycle receipt.
          </p>
        </div>
        <div className="support-hero-actions">
          <AdminFreshnessMeter
            ageSeconds={casesResource.lastUpdatedAt
              ? Math.max(0, (clock - new Date(casesResource.lastUpdatedAt).getTime()) / 1_000)
              : null}
            freshForSeconds={90}
            label="Case queue"
          />
          <AdminButton
            icon="refresh"
            busy={casesResource.refreshing}
            disabled={!canRead}
            onClick={() => void casesResource.refresh()}
          >
            Refresh cases
          </AdminButton>
        </div>
      </header>

      <div className="support-safety-banner">
        <span className="material-symbols-rounded" aria-hidden="true">policy</span>
        <div>
          <strong>Review-first recovery</strong>
          <span>
            This workflow records review evidence only. It cannot create or modify Stripe
            customers, subscriptions, prices, promotions, entitlements, or Checkout Sessions.
          </span>
        </div>
        <AdminStatusBadge tone="info">Billing permission boundary</AdminStatusBadge>
      </div>

      {mutationError ? <div className="support-alert is-error" role="alert">{mutationError}</div> : null}
      {notice ? <div className="support-alert is-success" role="status">{notice}</div> : null}
      {casesResource.stale && casesResource.data ? (
        <div className="support-alert is-warning" role="status">
          Showing the last verified case queue. Refresh before a consequential review action.
        </div>
      ) : null}

      <section className="support-metric-grid" aria-label="Billing support posture">
        <AdminMetricCard
          label="New reviews"
          value={canRead ? counts.new : '—'}
          icon="priority_high"
          detail="Waiting for an operator"
          status={counts.new ? 'Needs triage' : 'Clear'}
          statusTone={counts.new ? 'critical' : 'healthy'}
          loading={casesResource.loading}
        />
        <AdminMetricCard
          label="In review"
          value={canRead ? counts.reviewing : '—'}
          icon="manage_search"
          detail="Started, not yet resolved"
          status={counts.reviewing ? 'Active queue' : 'Clear'}
          statusTone={counts.reviewing ? 'degraded' : 'healthy'}
          loading={casesResource.loading}
        />
        <AdminMetricCard
          label="Fresh evidence needed"
          value={canRead ? counts.staleEvidence : '—'}
          icon="timer_off"
          detail="Reviewing cases without ready 15-minute evidence"
          status={counts.staleEvidence ? 'Verify before closure' : 'Current'}
          statusTone={counts.staleEvidence ? 'degraded' : 'healthy'}
          loading={casesResource.loading}
        />
        <AdminMetricCard
          label="Resolved in bounded set"
          value={canRead ? counts.resolved : '—'}
          icon="task_alt"
          detail={`${cases.length} of at most 75 cases loaded`}
          status="Immutable"
          statusTone="healthy"
          loading={casesResource.loading}
        />
      </section>

      <AdminPanel
        className="support-case-panel"
        eyebrow="Stripe account review required"
        title="Billing review queue"
            description="A bounded support workspace with granular review permissions and aggregate-only Stripe evidence."
        toolbar={(
          <AdminStatusBadge tone={casesResource.data?.meta.truncated ? 'degraded' : 'info'}>
            {casesResource.data?.meta.truncated ? 'Bound reached' : 'Bounded list'}
          </AdminStatusBadge>
        )}
      >
        <div className="support-filter-bar">
          <div className="support-segments" role="group" aria-label="Filter billing review status">
            {(['open', 'new', 'reviewing', 'resolved', 'all'] as const).map(option => (
              <button
                key={option}
                type="button"
                className={filter === option ? 'is-active' : ''}
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <label className="support-search">
            <span className="material-symbols-rounded" aria-hidden="true">search</span>
            <span className="sr-only">Search billing support cases</span>
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search customer or case…"
              autoComplete="off"
            />
          </label>
        </div>
        <AdminStateBoundary
          state={listState}
          title={listState === 'unauthorized' ? 'Billing review permission required' : undefined}
          message={listState === 'error' ? casesResource.error : undefined}
          onRetry={listState === 'error' ? () => void casesResource.refresh() : undefined}
        >
          <AdminDataTable
            columns={columns}
            rows={filteredCases}
            rowKey={item => item.caseId}
            rowLabel={item => `Open billing review for ${identityLabel(item)}`}
            onRowActivate={setSelectedCase}
            caption="Stripe account review cases"
            className="support-case-table"
          />
        </AdminStateBoundary>
        {casesResource.data?.meta.truncated ? (
          <div className="support-bounded-note">
            The 75-case safety bound was reached. Results are partial; refine the server-side investigation before closure.
          </div>
        ) : null}
      </AdminPanel>

      <AdminDetailDrawer
        open={selectedCase !== null}
        size="lg"
        busy={Boolean(busyAction)}
        title="Billing account review"
        description="Private support workspace. Customer identity never appears outside this module."
        onClose={() => {
          if (busyAction) return;
          setSelectedCase(null);
        }}
      >
        {selectedCase ? (
          <div className="support-case-drawer">
            <section className="support-case-identity">
              <div className="support-customer-heading">
                <span className="support-avatar is-large" aria-hidden="true">
                  {identityLabel(selectedCase).slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <span>Customer</span>
                  <strong>{identityLabel(selectedCase)}</strong>
                  <small>{selectedCase.email || 'Verified email unavailable'}</small>
                </div>
              </div>
              <AdminStatusBadge tone={statusTone(selectedCase.status)}>
                {selectedCase.status}
              </AdminStatusBadge>
              <dl>
                <div><dt>Case</dt><dd>{selectedCase.caseId}</dd></div>
                <div><dt>Opened</dt><dd>{dateTime(selectedCase.createdAt)}</dd></div>
                <div><dt>Last update</dt><dd>{dateTime(selectedCase.updatedAt)}</dd></div>
                <div><dt>Resolved</dt><dd>{dateTime(selectedCase.resolvedAt)}</dd></div>
              </dl>
            </section>

            <section className="support-customer-message">
              <p className="support-section-kicker">Customer report</p>
              <blockquote>{selectedCase.message || 'No customer message was recorded.'}</blockquote>
            </section>

            <section className="support-provider-evidence">
              <header>
                <div>
                  <p className="support-section-kicker">Read-only provider evidence</p>
                  <h3>Stripe customer association</h3>
                </div>
                <AdminStatusBadge
                  tone={selectedEvidenceFresh
                    ? 'healthy'
                    : selectedCase.checkoutAccountEvidence?.status === 'blocked'
                      ? 'critical'
                      : 'unknown'}
                >
                  {selectedEvidenceFresh
                    ? 'Fresh · ready'
                    : selectedCase.checkoutAccountEvidence?.status === 'blocked'
                      ? 'Blocked'
                      : selectedCase.checkoutAccountEvidence
                        ? 'Expired'
                        : 'Not checked'}
                </AdminStatusBadge>
              </header>
              {selectedCase.checkoutAccountEvidence ? (
                <>
                  <div className="support-evidence-metrics">
                    <div>
                      <span>Linked customers</span>
                      <strong>{selectedCase.checkoutAccountEvidence.linkedCustomerCount}</strong>
                    </div>
                    <div>
                      <span>Prospective total</span>
                      <strong>{selectedCase.checkoutAccountEvidence.prospectiveCustomerCount}</strong>
                    </div>
                    <div>
                      <span>Safety maximum</span>
                      <strong>{selectedCase.checkoutAccountEvidence.maxAllowed}</strong>
                    </div>
                  </div>
                  <AdminFreshnessMeter
                    ageSeconds={evidenceAgeSeconds(selectedCase.checkoutAccountEvidence, clock)}
                    freshForSeconds={STRIPE_ACCOUNT_REVIEW_EVIDENCE_TTL_MS / 1_000}
                    label="Closure evidence age"
                  />
                </>
              ) : (
                <p className="support-no-evidence">
                  No aggregate Stripe evidence is attached. Verification returns counts only,
                  never customer IDs or provider errors.
                </p>
              )}
              {selectedCase.status !== 'resolved' ? (
                <AdminButton
                  icon="verified_user"
                  busy={busyAction === 'verify'}
                  disabled={!canManage || Boolean(busyAction)}
                  onClick={() => void verifyCustomerEvidence()}
                >
                  Verify customer evidence
                </AdminButton>
              ) : null}
            </section>

            <section className="support-case-actions">
              <p className="support-section-kicker">Guarded lifecycle</p>
              {selectedCase.status === 'new' ? (
                <div className="support-action-card">
                  <span className="material-symbols-rounded" aria-hidden="true">manage_search</span>
                  <div>
                    <strong>Start account review</strong>
                    <p>Add an operator note before claiming this review.</p>
                  </div>
                  <AdminButton
                    disabled={!canManage}
                    onClick={() => stageAction('reviewing')}
                  >
                    Start review
                  </AdminButton>
                </div>
              ) : null}
              {selectedCase.status === 'reviewing' ? (
                <div className="support-action-card is-warning">
                  <span className="material-symbols-rounded" aria-hidden="true">fact_check</span>
                  <div>
                    <strong>Close reviewed case</strong>
                    <p>Fresh ready evidence, two attestations, a note, and exact closure phrase are required.</p>
                  </div>
                  <AdminButton
                    variant="primary"
                    disabled={!canManage}
                    onClick={() => stageAction('resolved')}
                  >
                    Review closure
                  </AdminButton>
                </div>
              ) : null}
              {selectedCase.status === 'resolved' ? (
                <div className="support-action-card is-resolved">
                  <span className="material-symbols-rounded" aria-hidden="true">lock</span>
                  <div>
                    <strong>Resolved case is immutable</strong>
                    <p>The case can be inspected, but its status, notes, and history cannot be changed.</p>
                  </div>
                  <AdminStatusBadge tone="healthy">Closed</AdminStatusBadge>
                </div>
              ) : null}
            </section>

            <section className="support-receipt-boundary">
              <span className="material-symbols-rounded" aria-hidden="true">privacy_tip</span>
              <div>
                <strong>Private user receipt</strong>
                <p>
                  The synchronized receipt at <code>billingSupport/current</code> contains
                  case lifecycle only. Operator identity, notes, counts, and Stripe evidence
                  remain in the protected admin record.
                </p>
              </div>
            </section>

            <section className="support-history">
              <header>
                <div>
                  <p className="support-section-kicker">Append-only history</p>
                  <h3>Review timeline</h3>
                </div>
                <AdminStatusBadge tone="info">{selectedCase.history.length} entries</AdminStatusBadge>
              </header>
              {selectedCase.history.length ? (
                <ol>
                  {[...selectedCase.history].reverse().map((entry, index) => (
                    <li key={`${entry.at || 'unknown'}-${index}`}>
                      <span className="support-history-marker" aria-hidden="true">
                        <span className="material-symbols-rounded">history</span>
                      </span>
                      <div>
                        <strong>{actionLabel(entry.action)}</strong>
                        {entry.note ? <p>{entry.note}</p> : null}
                        <small>
                          {entry.by || 'Server process'} · {dateTime(entry.at)}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="support-no-history">No lifecycle entries were returned for this case.</p>
              )}
            </section>
          </div>
        ) : null}
      </AdminDetailDrawer>

      <AdminConfirmationDialog
        open={pendingAction !== null}
        title={pendingAction === 'resolved' ? 'Close reviewed billing case?' : 'Start account review?'}
        message={pendingAction === 'resolved'
          ? (
            <p>
              Closure is immutable. It updates the private user receipt with lifecycle status
              only and records the operator action in the administrative audit trail.
            </p>
          )
          : (
            <p>
              This claims the case for review and appends an append-only operator history entry.
              It does not change any Stripe object.
            </p>
          )}
        confirmLabel={pendingAction === 'resolved' ? 'Close reviewed case' : 'Start account review'}
        tone={pendingAction === 'resolved' ? 'danger' : 'primary'}
        busy={Boolean(busyAction)}
        onCancel={() => {
          if (busyAction) return;
          setPendingAction(null);
          setNote('');
          setConfirmationText('');
        }}
        onConfirm={() => void runTransition()}
      >
        <label className="support-confirmation-field">
          <span>{pendingAction === 'resolved' ? 'Resolution note' : 'Operator note'}</span>
          <textarea
            rows={4}
            maxLength={1_000}
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder={pendingAction === 'resolved'
              ? 'Summarize the verified evidence and resolution…'
              : 'Describe why this account review is starting…'}
          />
          <small>
            {pendingAction === 'resolved'
              ? 'At least 10 characters. This note remains private to administrators.'
                  : 'At least 5 characters. This note is appended to the case history.'}
          </small>
        </label>

        {pendingAction === 'resolved' ? (
          <>
            <div className="support-attestations">
              <label>
                <input
                  type="checkbox"
                  checked={accountHistoryReviewed}
                  onChange={event => setAccountHistoryReviewed(event.target.checked)}
                />
                <span>
                  <strong>Account history reviewed</strong>
                  <small>I reviewed the bounded case and billing-account history.</small>
                </span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={checkoutSafetyReviewed}
                  onChange={event => setCheckoutSafetyReviewed(event.target.checked)}
                />
                <span>
                  <strong>Checkout safety reviewed</strong>
                  <small>I confirmed fresh aggregate Stripe evidence is ready.</small>
                </span>
              </label>
            </div>
            <label className="support-confirmation-field">
              <span>
                Type <strong>{STRIPE_ACCOUNT_REVIEW_CLOSE_CONFIRMATION}</strong> to continue
              </span>
              <input
                type="text"
                autoComplete="off"
                value={confirmationText}
                onChange={event => setConfirmationText(event.target.value)}
              />
            </label>
            {!selectedEvidenceFresh ? (
              <p className="support-confirmation-warning">
                Run a fresh ready customer evidence check before closing this review.
              </p>
            ) : null}
            {!resolveReady ? (
              <p className="support-confirmation-hint">
                Every closure requirement must be complete. The server re-checks all evidence.
              </p>
            ) : null}
          </>
        ) : null}
      </AdminConfirmationDialog>
    </div>
  );
}
