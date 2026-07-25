'use client';

import { useMemo, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import type { AdminEmailOperationsResponse } from '@/lib/admin/contracts';
import { useAdminResource } from '@/hooks/useAdminResource';
import { useAdminSession } from '@/components/admin/shell/AdminSessionProvider';
import { AdminButton } from '@/components/admin/primitives/AdminButton';
import { AdminConfirmationDialog } from '@/components/admin/primitives/AdminConfirmationDialog';
import { AdminFreshnessMeter } from '@/components/admin/primitives/AdminFreshnessMeter';
import { AdminMetricCard } from '@/components/admin/primitives/AdminMetricCard';
import { AdminPanel } from '@/components/admin/primitives/AdminPanel';
import { AdminStateBoundary } from '@/components/admin/primitives/AdminStateBoundary';
import { AdminStatusBadge, type AdminStatusTone } from '@/components/admin/primitives/AdminStatusBadge';
import './email-command-center.css';

interface CanaryReceipt {
  accepted: boolean;
  provider: 'resend';
  requestedAt: string;
  verificationPending: boolean;
  message: string;
}

const OUTBOX_LABELS: Record<string, string> = {
  queued: 'Queued',
  retry: 'Retry',
  leased: 'Leased',
  accepted: 'Accepted',
  delivered: 'Delivered',
  delayed: 'Delayed',
  failed: 'Failed',
  skipped: 'Skipped',
  dead: 'Dead letter',
};

function stateTone(state: AdminEmailOperationsResponse['readiness']['state']): AdminStatusTone {
  if (state === 'ready') return 'healthy';
  if (state === 'degraded') return 'degraded';
  if (state === 'blocked') return 'critical';
  return 'unknown';
}

function formatDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'No verified receipt';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function EmailCommandCenter() {
  const {
    session,
    status: sessionStatus,
    error: sessionError,
    hasPermission,
    refresh: refreshSession,
  } = useAdminSession();
  const canRead = sessionStatus === 'ready'
    && (hasPermission('operations.read') || hasPermission('email.send'));
  const canSendCanary = sessionStatus === 'ready' && hasPermission('email.send');
  const resource = useAdminResource<AdminEmailOperationsResponse>('/api/admin/email', {
    enabled: canRead,
    intervalMs: 60_000,
    staleAfterMs: 150_000,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [receipt, setReceipt] = useState<CanaryReceipt | null>(null);

  const statusRows = useMemo(
    () => Object.entries(resource.data?.outbox.byStatus || {})
      .map(([key, count]) => ({ key, count, label: OUTBOX_LABELS[key] || key }))
      .sort((left, right) => (right.count ?? -1) - (left.count ?? -1)),
    [resource.data?.outbox.byStatus],
  );
  const knownTotal = statusRows.reduce(
    (sum, row) => sum + (typeof row.count === 'number' ? row.count : 0),
    0,
  );
  const deliveryTotal = (resource.data?.outbox.byStatus.delivered || 0)
    + (resource.data?.outbox.byStatus.accepted || 0);
  const failureTotal = (resource.data?.outbox.byStatus.failed || 0)
    + (resource.data?.outbox.byStatus.dead || 0);

  async function requestCanary() {
    if (!canSendCanary || confirmation !== 'SEND SELF CANARY') return;
    setBusy(true);
    setMutationError('');
    setReceipt(null);
    try {
      const response = await authFetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const payload = await response.json().catch(() => ({})) as CanaryReceipt & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The provider canary was not accepted.');
      setReceipt(payload);
      setConfirmOpen(false);
      setConfirmation('');
      await resource.refresh();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'The provider canary was not accepted.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionStatus === 'loading') {
    return <AdminStateBoundary state="loading"><span /></AdminStateBoundary>;
  }
  if (sessionStatus === 'denied' || !session) {
    return (
      <AdminStateBoundary
        state="unauthorized"
        title="Email operations access required"
        message={sessionError || 'An active Admin session is required.'}
        onRetry={() => void refreshSession()}
      >
        <span />
      </AdminStateBoundary>
    );
  }

  const readiness = resource.data?.readiness;
  const state = !canRead
    ? 'unauthorized'
    : resource.loading
      ? 'loading'
      : resource.error && !resource.data
        ? 'error'
        : resource.data
          ? 'ready'
          : 'empty';

  return (
    <div className="email-module">
      <header className="admin-module-hero email-hero">
        <div>
          <p className="admin-module-kicker">Tracked communications</p>
          <h1>Email operations</h1>
          <p>
            Review Resend configuration, signed receipt proof, and aggregate outbox state
            without opening customer messages or recipient records.
          </p>
        </div>
        <div className="email-hero-actions">
          <AdminStatusBadge
            tone={readiness ? stateTone(readiness.state) : 'unknown'}
            live={Boolean(readiness?.canSendTrackedEmail && !resource.stale)}
          >
            {readiness?.canSendTrackedEmail ? 'Tracked delivery ready' : 'Evidence incomplete'}
          </AdminStatusBadge>
          <AdminButton
            icon="refresh"
            busy={resource.refreshing}
            onClick={() => void resource.refresh()}
          >
            Refresh receipts
          </AdminButton>
        </div>
      </header>

      {resource.stale && resource.data ? (
        <div className="admin-module-alert is-warning" role="status">
          Showing last-known email evidence. No provider send was triggered by this refresh.
        </div>
      ) : null}
      {mutationError ? <div className="admin-module-alert is-error" role="alert">{mutationError}</div> : null}
      {receipt ? (
        <div className="admin-module-alert is-success" role="status">
          {receipt.message} Requested {formatDate(receipt.requestedAt)}.
        </div>
      ) : null}

      <section className="email-metric-grid" aria-label="Email delivery evidence">
        <AdminMetricCard
          label="Outbox records"
          value={resource.data?.outbox.total ?? 'Unknown'}
          icon="outbox"
          detail={resource.data?.outbox.aggregationComplete ? 'Complete aggregation' : 'Partial aggregation'}
          status={resource.data?.outbox.aggregationComplete ? 'Verified' : 'Review'}
          statusTone={resource.data?.outbox.aggregationComplete ? 'healthy' : 'degraded'}
          loading={resource.loading}
        />
        <AdminMetricCard
          label="Accepted or delivered"
          value={resource.data ? deliveryTotal : '—'}
          icon="mark_email_read"
          detail="Aggregate status records"
          status="No recipient payload"
          statusTone="info"
          loading={resource.loading}
        />
        <AdminMetricCard
          label="Failed or dead"
          value={resource.data ? failureTotal : '—'}
          icon="report"
          detail="Requires outbox review"
          status={failureTotal ? 'Attention' : 'Clear'}
          statusTone={failureTotal ? 'critical' : 'healthy'}
          loading={resource.loading}
        />
        <AdminMetricCard
          label="Verified receipt events"
          value={readiness
            ? `${readiness.verifiedReceiptEvents}/${readiness.requiredReceiptEvents}`
            : '—'}
          icon="receipt_long"
          detail="Signed provider evidence"
          status={readiness?.webhookVerified ? 'Webhook verified' : 'Pending'}
          statusTone={readiness?.webhookVerified ? 'healthy' : 'degraded'}
          loading={resource.loading}
        />
      </section>

      <div className="email-primary-grid">
        <AdminPanel
          className="email-readiness-panel"
          eyebrow="Provider evidence chain"
          title="Delivery readiness"
          description="Readiness requires configuration plus a provider acceptance and signed webhook receipt."
          toolbar={readiness ? (
            <AdminStatusBadge tone={stateTone(readiness.state)}>
              {readiness.state.replaceAll('_', ' ')}
            </AdminStatusBadge>
          ) : undefined}
        >
          <AdminStateBoundary
            state={state}
            message={resource.error || undefined}
            onRetry={() => void resource.refresh()}
          >
            <div className="email-proof-grid">
              <article className={readiness?.providerVerified ? 'is-verified' : 'is-pending'}>
                <span className="material-symbols-rounded" aria-hidden="true">
                  {readiness?.providerVerified ? 'verified' : 'pending'}
                </span>
                <div>
                  <strong>Provider acceptance</strong>
                  <p>A self-recipient canary was accepted by Resend.</p>
                  <small>{formatDate(readiness?.providerVerifiedAt)}</small>
                </div>
              </article>
              <article className={readiness?.webhookVerified ? 'is-verified' : 'is-pending'}>
                <span className="material-symbols-rounded" aria-hidden="true">
                  {readiness?.webhookVerified ? 'verified' : 'pending'}
                </span>
                <div>
                  <strong>Signed receipt</strong>
                  <p>A delivery event matched the server-held key and secret fingerprints.</p>
                  <small>{formatDate(readiness?.webhookVerifiedAt)}</small>
                </div>
              </article>
              <article className={readiness?.canSendTrackedEmail ? 'is-verified' : 'is-pending'}>
                <span className="material-symbols-rounded" aria-hidden="true">
                  {readiness?.canSendTrackedEmail ? 'task_alt' : 'policy'}
                </span>
                <div>
                  <strong>Tracked-send gate</strong>
                  <p>{readiness?.message || 'Delivery evidence has not loaded.'}</p>
                  <small>Credentials and fingerprints are never returned to this page.</small>
                </div>
              </article>
            </div>
          </AdminStateBoundary>
        </AdminPanel>

        <AdminPanel
          className="email-canary-panel"
          eyebrow="Bounded operator action"
          title="Self-recipient canary"
          description="Sends one fixed internal template to the authenticated administrator only."
        >
          <div className="email-canary-target">
            <span className="material-symbols-rounded" aria-hidden="true">alternate_email</span>
            <div>
              <small>Recipient boundary</small>
              <strong>{session.email}</strong>
              <p>No recipient field or arbitrary message body exists.</p>
            </div>
          </div>
          <ul className="email-safety-list">
            <li><span className="material-symbols-rounded" aria-hidden="true">check_circle</span> Two requests per 15 minutes</li>
            <li><span className="material-symbols-rounded" aria-hidden="true">check_circle</span> Idempotent 15-minute evidence bucket</li>
            <li><span className="material-symbols-rounded" aria-hidden="true">check_circle</span> Server-held credential fingerprints</li>
            <li><span className="material-symbols-rounded" aria-hidden="true">check_circle</span> Immutable Admin audit event</li>
          </ul>
          <AdminButton
            variant="primary"
            icon="send"
            disabled={!canSendCanary || !session.mfaSatisfied}
            onClick={() => {
              setMutationError('');
              setConfirmation('');
              setConfirmOpen(true);
            }}
          >
            Request verification canary
          </AdminButton>
          {!canSendCanary || !session.mfaSatisfied ? (
            <p className="email-canary-note">
              Email-send permission and a verified second factor are required.
            </p>
          ) : null}
        </AdminPanel>
      </div>

      <AdminPanel
        className="email-outbox-panel"
        eyebrow="Aggregate queue"
        title="Outbox distribution"
        description="Counts only. Recipient addresses, subjects, payloads, and provider identifiers stay private."
        toolbar={resource.data ? (
          <AdminFreshnessMeter
            ageSeconds={resource.lastUpdatedAt
              ? Math.max(0, (Date.now() - Date.parse(resource.lastUpdatedAt)) / 1_000)
              : null}
            freshForSeconds={150}
            label="Aggregation age"
          />
        ) : undefined}
      >
        <AdminStateBoundary
          state={state}
          message={resource.error || undefined}
          onRetry={() => void resource.refresh()}
        >
          <div className="email-outbox-grid">
            {statusRows.map(row => {
              const share = row.count === null || knownTotal === 0
                ? 0
                : Math.max(2, Math.round((row.count / knownTotal) * 100));
              const attention = row.key === 'failed' || row.key === 'dead' || row.key === 'delayed';
              return (
                <article key={row.key} className={attention ? 'is-attention' : ''}>
                  <span className="email-outbox-heading">
                    <strong>{row.label}</strong>
                    <b>{row.count ?? 'Unknown'}</b>
                  </span>
                  <progress max={100} value={share} aria-label={`${row.label}: ${row.count ?? 'unknown'} records`} />
                  <small>{row.count === null ? 'Aggregation unavailable' : `${share}% of known status counts`}</small>
                </article>
              );
            })}
          </div>
        </AdminStateBoundary>
      </AdminPanel>

      <AdminPanel
        className="email-privacy-panel"
        eyebrow="Communication boundary"
        title="Privacy and consent controls"
      >
        <div className="email-privacy-grid">
          <span><span className="material-symbols-rounded" aria-hidden="true">visibility_off</span><strong>No message content</strong><small>Templates and customer payloads are not read.</small></span>
          <span><span className="material-symbols-rounded" aria-hidden="true">person_off</span><strong>No recipient export</strong><small>Only the current operator sees their own email.</small></span>
          <span><span className="material-symbols-rounded" aria-hidden="true">approval</span><strong>Consent remains authoritative</strong><small>This console cannot create campaign sends.</small></span>
          <span><span className="material-symbols-rounded" aria-hidden="true">lock_clock</span><strong>Receipts, not assumptions</strong><small>Readiness changes after signed evidence.</small></span>
        </div>
      </AdminPanel>

      <AdminConfirmationDialog
        open={confirmOpen}
        title="Send a self-recipient verification canary?"
        message={(
          <p>
            The fixed internal template will be addressed to <strong>{session.email}</strong>.
            The action does not accept another recipient or custom content.
          </p>
        )}
        confirmLabel="Send canary"
        busy={busy}
        onCancel={() => {
          if (busy) return;
          setConfirmOpen(false);
          setConfirmation('');
        }}
        onConfirm={() => void requestCanary()}
      >
        <label className="admin-confirmation-field">
          <span>Type <strong>SEND SELF CANARY</strong> to continue</span>
          <input
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </label>
      </AdminConfirmationDialog>
    </div>
  );
}
