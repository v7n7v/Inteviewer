'use client';

import { useMemo, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import type {
  AdminOperationsResponse,
  AdminOperationsSignal,
} from '@/lib/admin/contracts';
import { useAdminResource } from '@/hooks/useAdminResource';
import { useAdminSession } from '@/components/admin/shell/AdminSessionProvider';
import { AdminButton } from '@/components/admin/primitives/AdminButton';
import { AdminConfirmationDialog } from '@/components/admin/primitives/AdminConfirmationDialog';
import { AdminDetailDrawer } from '@/components/admin/primitives/AdminDetailDrawer';
import { AdminFreshnessMeter } from '@/components/admin/primitives/AdminFreshnessMeter';
import { AdminMetricCard } from '@/components/admin/primitives/AdminMetricCard';
import { AdminPanel } from '@/components/admin/primitives/AdminPanel';
import { AdminStateBoundary } from '@/components/admin/primitives/AdminStateBoundary';
import {
  AdminStatusBadge,
  type AdminStatusTone,
} from '@/components/admin/primitives/AdminStatusBadge';
import './operations-command-center.css';

interface PlatformSettings {
  version: number;
  maintenance: boolean;
  maintenanceMessage: string;
  announcement: string;
  announcementActive: boolean;
  features: {
    liveVoice: boolean;
    humanizer: boolean;
    marketOracle: boolean;
    jobSearch: boolean;
    skillBridge: boolean;
  };
  updatedAt: string | null;
  updatedBy: string | null;
}

interface PlatformSettingsResponse {
  settings: PlatformSettings;
}

interface PromotionResponse {
  active: boolean;
  headline: string;
  code: string;
  ctaText: string;
  version: number;
  evidenceFingerprint: string | null;
}

interface JobSupplyVerification {
  provider: 'ever_jobs';
  status: string;
  preparationReady: boolean;
  configurationReady: boolean;
  apiKeyProtectionVerified: boolean;
  safeSourcePolicyReady: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string;
  privacy: string;
}

type PendingControl =
  | { kind: 'maintenance'; nextValue: boolean }
  | { kind: 'announcement'; nextValue: boolean }
  | { kind: 'promotion'; nextValue: boolean };

function signalTone(state: AdminOperationsSignal['state']): AdminStatusTone {
  if (state === 'ready') return 'healthy';
  if (state === 'degraded') return 'degraded';
  if (state === 'blocked') return 'critical';
  return 'unknown';
}

function signalLabel(state: AdminOperationsSignal['state']) {
  if (state === 'ready') return 'Ready';
  if (state === 'degraded') return 'Degraded';
  if (state === 'blocked') return 'Blocked';
  return 'Unknown';
}

function signalIcon(key: AdminOperationsSignal['key']) {
  if (key === 'stripe') return 'paid';
  if (key === 'job_supply') return 'work';
  if (key === 'taco_providers') return 'smart_toy';
  if (key === 'notifications') return 'mark_email_read';
  return 'security';
}

function formatAge(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return 'Not measured';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} minutes`;
  return `${Math.floor(seconds / 3_600)} hours`;
}

function formatDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'No verified timestamp';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function idempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function OperationsCommandCenter() {
  const {
    session,
    status: sessionStatus,
    error: sessionError,
    hasPermission,
    refresh: refreshSession,
  } = useAdminSession();
  const canRead = sessionStatus === 'ready' && hasPermission('operations.read');
  const canReadSettings = sessionStatus === 'ready' && hasPermission('settings.read');
  const canManageSettings = sessionStatus === 'ready' && hasPermission('settings.manage');
  const operations = useAdminResource<AdminOperationsResponse>('/api/admin/ops', {
    enabled: canRead,
    intervalMs: 45_000,
    staleAfterMs: 120_000,
  });
  const settings = useAdminResource<PlatformSettingsResponse>('/api/admin/settings', {
    enabled: canReadSettings,
    intervalMs: 120_000,
    staleAfterMs: 300_000,
  });
  const promotion = useAdminResource<PromotionResponse>('/api/admin/promo', {
    enabled: canReadSettings,
    intervalMs: 120_000,
    staleAfterMs: 300_000,
  });
  const [selectedSignal, setSelectedSignal] = useState<AdminOperationsSignal | null>(null);
  const [verification, setVerification] = useState<JobSupplyVerification | null>(null);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [pendingControl, setPendingControl] = useState<PendingControl | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [notice, setNotice] = useState('');

  const attentionCount = useMemo(
    () => (operations.data?.signals || []).filter(signal => signal.state !== 'ready').length,
    [operations.data?.signals],
  );

  async function refreshAll() {
    await Promise.all([
      canRead ? operations.refresh() : Promise.resolve(),
      canReadSettings ? settings.refresh() : Promise.resolve(),
      canReadSettings ? promotion.refresh() : Promise.resolve(),
    ]);
  }

  async function verifyJobSupply() {
    setVerificationBusy(true);
    setVerificationError('');
    setNotice('');
    try {
      const response = await authFetch('/api/admin/ops/job-supply', {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as JobSupplyVerification & { error?: string };
      if (!response.ok && !payload.checkedAt) {
        throw new Error(payload.error || 'The bounded verification could not be completed.');
      }
      setVerification(payload);
      setNotice('A single, strictly rate-limited Ever Jobs verification completed.');
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : 'The verification could not be completed.');
    } finally {
      setVerificationBusy(false);
    }
  }

  function closeControlDialog() {
    if (mutationBusy) return;
    setPendingControl(null);
    setConfirmation('');
    setReason('');
  }

  async function applyControl() {
    if (
      !pendingControl
      || !canManageSettings
      || confirmation !== 'APPLY PLATFORM CONTROL'
      || reason.trim().length < 10
    ) return;
    setMutationBusy(true);
    setMutationError('');
    setNotice('');
    try {
      let response: Response;
      if (pendingControl.kind === 'promotion') {
        if (!promotion.data?.evidenceFingerprint) {
          throw new Error('A current verified promotion evidence fingerprint is required.');
        }
        response = await authFetch('/api/admin/promo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            active: pendingControl.nextValue,
            headline: promotion.data.headline,
            code: promotion.data.code,
            ctaText: promotion.data.ctaText,
            evidenceFingerprint: promotion.data.evidenceFingerprint,
            reason: reason.trim(),
            confirmationText: 'APPLY PROMOTION PRESENTATION',
            idempotencyKey: idempotencyKey('promotion'),
            expectedVersion: promotion.data.version,
          }),
        });
      } else {
        if (!settings.data) throw new Error('Refresh the current platform settings before applying a control.');
        response = await authFetch('/api/admin/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedVersion: settings.data.settings.version,
            reason: reason.trim(),
            confirmationText: 'APPLY PLATFORM SETTINGS',
            idempotencyKey: idempotencyKey('settings'),
            ...(pendingControl.kind === 'maintenance'
              ? { maintenance: pendingControl.nextValue }
              : { announcementActive: pendingControl.nextValue }),
          }),
        });
      }
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The guarded platform control was not applied.');
      setNotice('The guarded control was applied and written to the administrative audit trail.');
      setPendingControl(null);
      setConfirmation('');
      setReason('');
      await Promise.all([settings.refresh(), promotion.refresh(), operations.refresh()]);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'The guarded platform control was not applied.');
    } finally {
      setMutationBusy(false);
    }
  }

  if (sessionStatus === 'loading') {
    return <AdminStateBoundary state="loading"><span /></AdminStateBoundary>;
  }
  if (sessionStatus === 'denied' || !session) {
    return (
      <AdminStateBoundary
        state="unauthorized"
        title="Operations access required"
        message={sessionError || 'An active Admin session is required.'}
        onRetry={() => void refreshSession()}
      >
        <span />
      </AdminStateBoundary>
    );
  }

  const settingsValue = settings.data?.settings;
  const mutationEligible = canManageSettings && session.mfaEnforced && session.mfaSatisfied;

  return (
    <div className="operations-module">
      <header className="admin-module-hero operations-hero">
        <div>
          <p className="admin-module-kicker">Platform control plane</p>
          <h1>Operations command</h1>
          <p>
            Read cached readiness continuously. Trigger a live provider check only when an
            operator explicitly requests bounded verification.
          </p>
        </div>
        <div className="operations-hero-actions">
          <AdminStatusBadge
            tone={operations.data ? signalTone(operations.data.overallState) : 'unknown'}
            live={Boolean(operations.data && !operations.stale)}
          >
            {operations.data ? signalLabel(operations.data.overallState) : 'Awaiting evidence'}
          </AdminStatusBadge>
          <AdminButton
            icon="refresh"
            busy={operations.refreshing || settings.refreshing || promotion.refreshing}
            onClick={() => void refreshAll()}
          >
            Refresh cached evidence
          </AdminButton>
        </div>
      </header>

      {notice ? <div className="admin-module-alert is-success" role="status">{notice}</div> : null}
      {mutationError ? <div className="admin-module-alert is-error" role="alert">{mutationError}</div> : null}
      {(operations.stale || settings.stale || promotion.stale) && (operations.data || settings.data || promotion.data) ? (
        <div className="admin-module-alert is-warning" role="status">
          At least one panel is showing last-known verified evidence. Mutations still revalidate versions on the server.
        </div>
      ) : null}

      <section className="operations-metric-grid" aria-label="Operational posture">
        <AdminMetricCard
          label="System lanes"
          value={operations.data?.signals.length ?? '—'}
          icon="hub"
          detail="Aggregate, private readiness"
          status={operations.data?.live === false ? 'Cached evidence' : 'Unknown'}
          statusTone="info"
          loading={operations.loading}
        />
        <AdminMetricCard
          label="Needs attention"
          value={attentionCount}
          icon="warning"
          detail="Degraded, blocked, or unknown"
          status={attentionCount ? 'Review queue' : 'Clear'}
          statusTone={attentionCount ? 'degraded' : 'healthy'}
          loading={operations.loading}
        />
        <AdminMetricCard
          label="Taco providers"
          value={operations.data
            ? `${operations.data.aggregates.tacoProvidersConfigured}/${operations.data.aggregates.tacoProvidersRequired}`
            : '—'}
          icon="smart_toy"
          detail="Configuration evidence only"
          status="No routine probe"
          statusTone="paused"
          loading={operations.loading}
        />
        <AdminMetricCard
          label="Tracked email"
          value={operations.data?.aggregates.trackedEmailReady ? 'Ready' : 'Review'}
          icon="mark_email_read"
          detail="Provider and signed receipt proof"
          status={operations.data?.aggregates.trackedEmailReady ? 'Verified' : 'Incomplete'}
          statusTone={operations.data?.aggregates.trackedEmailReady ? 'healthy' : 'degraded'}
          loading={operations.loading}
        />
      </section>

      <div className="operations-primary-grid">
        <AdminPanel
          className="operations-readiness-panel"
          eyebrow="Read-only aggregate"
          title="Readiness matrix"
          description="Unknown means unmeasured—not zero, healthy, or failed."
          toolbar={operations.data ? (
            <AdminFreshnessMeter
              ageSeconds={operations.lastUpdatedAt
                ? Math.max(0, (Date.now() - Date.parse(operations.lastUpdatedAt)) / 1_000)
                : null}
              freshForSeconds={120}
              label="Snapshot age"
            />
          ) : undefined}
        >
          <AdminStateBoundary
            state={!canRead
              ? 'unauthorized'
              : operations.loading
                ? 'loading'
                : operations.error && !operations.data
                  ? 'error'
                  : (operations.data?.signals.length || 0) === 0
                    ? 'empty'
                    : 'ready'}
            message={operations.error || undefined}
            onRetry={() => void operations.refresh()}
          >
            <div className="operations-signal-grid">
              {(operations.data?.signals || []).map(signal => (
                <button
                  key={signal.key}
                  type="button"
                  className={`operations-signal-card is-${signalTone(signal.state)}`}
                  onClick={() => setSelectedSignal(signal)}
                >
                  <span className="operations-signal-icon material-symbols-rounded" aria-hidden="true">
                    {signalIcon(signal.key)}
                  </span>
                  <span className="operations-signal-copy">
                    <span>
                      <strong>{signal.label}</strong>
                      <AdminStatusBadge tone={signalTone(signal.state)}>
                        {signalLabel(signal.state)}
                      </AdminStatusBadge>
                    </span>
                    <small>{signal.message}</small>
                  </span>
                  <span className="operations-signal-facts">
                    <span><small>Ready</small><strong>{signal.ready === null ? 'Unknown' : signal.ready ? 'Yes' : 'No'}</strong></span>
                    <span><small>Freshness</small><strong>{formatAge(signal.evidenceAgeSeconds)}</strong></span>
                    <span><small>Checked</small><strong>{formatDate(signal.checkedAt)}</strong></span>
                  </span>
                  <span className="material-symbols-rounded operations-card-chevron" aria-hidden="true">chevron_right</span>
                </button>
              ))}
            </div>
          </AdminStateBoundary>
        </AdminPanel>

        <aside className="operations-side-stack">
          <AdminPanel
            className="operations-verify-panel"
            eyebrow="Explicit provider contact"
            title="Job-supply verification"
            description="Strictly rate-limited and forced. Never runs during routine page refresh."
          >
            <div className="operations-verification-command">
              <span className="material-symbols-rounded" aria-hidden="true">radar</span>
              <div>
                <strong>Ever Jobs live check</strong>
                <p>Returns bounded readiness, safe-source policy, timestamp, and latency only.</p>
              </div>
            </div>
            {verificationError ? <p className="operations-inline-error" role="alert">{verificationError}</p> : null}
            {verification ? (
              <dl className="operations-evidence-list">
                <div><dt>Preparation</dt><dd>{verification.preparationReady ? 'Ready' : 'Not ready'}</dd></div>
                <div><dt>Key protection</dt><dd>{verification.apiKeyProtectionVerified ? 'Verified' : 'Review'}</dd></div>
                <div><dt>Safe sources</dt><dd>{verification.safeSourcePolicyReady ? 'Verified' : 'Review'}</dd></div>
                <div><dt>Latency</dt><dd>{verification.latencyMs === null ? 'Unknown' : `${verification.latencyMs} ms`}</dd></div>
                <div><dt>Checked</dt><dd>{formatDate(verification.checkedAt)}</dd></div>
              </dl>
            ) : (
              <p className="operations-empty-note">No live verification has been requested in this session.</p>
            )}
            <AdminButton
              variant="primary"
              icon="network_check"
              busy={verificationBusy}
              disabled={!canRead}
              onClick={() => void verifyJobSupply()}
            >
              Run bounded verification
            </AdminButton>
          </AdminPanel>

          <AdminPanel
            className="operations-guard-panel"
            eyebrow="Mutation perimeter"
            title="Control eligibility"
            description="The server remains authoritative even when a control is visible."
          >
            <dl className="operations-evidence-list">
              <div><dt>Settings permission</dt><dd>{canManageSettings ? 'Granted' : 'Read only'}</dd></div>
              <div><dt>MFA enforcement</dt><dd>{session.mfaEnforced ? 'Enabled' : 'Disabled'}</dd></div>
              <div><dt>Current second factor</dt><dd>{session.mfaSatisfied ? 'Verified' : 'Not present'}</dd></div>
              <div><dt>Expanded controls</dt><dd>{mutationEligible ? 'Eligible' : 'Server gated'}</dd></div>
            </dl>
          </AdminPanel>
        </aside>
      </div>

      <AdminPanel
        className="operations-controls-panel"
        eyebrow="Guarded configuration"
        title="Platform controls"
        description="Every change requires current evidence, a reason, exact confirmation, MFA, idempotency, and an audit record."
        toolbar={<AdminStatusBadge tone={mutationEligible ? 'healthy' : 'paused'}>{mutationEligible ? 'Mutation eligible' : 'Read only'}</AdminStatusBadge>}
      >
        <AdminStateBoundary
          state={!canReadSettings
            ? 'unauthorized'
            : settings.loading || promotion.loading
              ? 'loading'
              : settings.error && !settings.data
                ? 'error'
                : 'ready'}
          message={settings.error || promotion.error || undefined}
          onRetry={() => void refreshAll()}
        >
          <div className="operations-control-grid">
            <article>
              <span className="material-symbols-rounded" aria-hidden="true">construction</span>
              <div>
                <strong>Maintenance mode</strong>
                <p>{settingsValue?.maintenanceMessage || 'Platform maintenance presentation.'}</p>
                <small>Version {settingsValue?.version ?? 'unknown'} · {formatDate(settingsValue?.updatedAt)}</small>
              </div>
              <AdminButton
                size="sm"
                variant={settingsValue?.maintenance ? 'danger' : 'secondary'}
                disabled={!mutationEligible || !settingsValue}
                onClick={() => setPendingControl({ kind: 'maintenance', nextValue: !settingsValue?.maintenance })}
              >
                {settingsValue?.maintenance ? 'Disable' : 'Enable'}
              </AdminButton>
            </article>
            <article>
              <span className="material-symbols-rounded" aria-hidden="true">campaign</span>
              <div>
                <strong>Public announcement</strong>
                <p>{settingsValue?.announcement || 'No announcement copy is configured.'}</p>
                <small>{settingsValue?.announcementActive ? 'Currently visible' : 'Currently hidden'}</small>
              </div>
              <AdminButton
                size="sm"
                disabled={!mutationEligible || !settingsValue || !settingsValue.announcement}
                onClick={() => setPendingControl({ kind: 'announcement', nextValue: !settingsValue?.announcementActive })}
              >
                {settingsValue?.announcementActive ? 'Hide' : 'Publish'}
              </AdminButton>
            </article>
            <article>
              <span className="material-symbols-rounded" aria-hidden="true">sell</span>
              <div>
                <strong>Promotion presentation</strong>
                <p>{promotion.data?.headline || 'No current promotion presentation.'}</p>
                <small>
                  {promotion.data?.evidenceFingerprint
                    ? `Evidence ${promotion.data.evidenceFingerprint.slice(0, 10)}…`
                    : 'Verified economics fingerprint unavailable'}
                </small>
              </div>
              <AdminButton
                size="sm"
                disabled={!mutationEligible || !promotion.data?.evidenceFingerprint}
                onClick={() => setPendingControl({ kind: 'promotion', nextValue: !promotion.data?.active })}
              >
                {promotion.data?.active ? 'Deactivate' : 'Activate'}
              </AdminButton>
            </article>
          </div>
        </AdminStateBoundary>
      </AdminPanel>

      <AdminDetailDrawer
        open={selectedSignal !== null}
        onClose={() => setSelectedSignal(null)}
        title={selectedSignal?.label || 'Operational evidence'}
        description="Aggregate evidence only. This drawer cannot mutate provider or customer state."
      >
        {selectedSignal ? (
          <div className="operations-signal-detail">
            <AdminStatusBadge tone={signalTone(selectedSignal.state)}>{signalLabel(selectedSignal.state)}</AdminStatusBadge>
            <p>{selectedSignal.message}</p>
            <dl className="operations-evidence-list">
              <div><dt>Configured</dt><dd>{selectedSignal.configured === null ? 'Unknown' : selectedSignal.configured ? 'Yes' : 'No'}</dd></div>
              <div><dt>Ready</dt><dd>{selectedSignal.ready === null ? 'Unknown' : selectedSignal.ready ? 'Yes' : 'No'}</dd></div>
              <div><dt>Evidence age</dt><dd>{formatAge(selectedSignal.evidenceAgeSeconds)}</dd></div>
              <div><dt>Latency p95</dt><dd>{selectedSignal.latencyP95Ms === null ? 'Not instrumented' : `${selectedSignal.latencyP95Ms} ms`}</dd></div>
              <div><dt>Throughput</dt><dd>{selectedSignal.throughput === null ? 'Not instrumented' : selectedSignal.throughput}</dd></div>
              <div><dt>Error rate</dt><dd>{selectedSignal.errorRatePercent === null ? 'Not instrumented' : `${selectedSignal.errorRatePercent}%`}</dd></div>
            </dl>
          </div>
        ) : null}
      </AdminDetailDrawer>

      <AdminConfirmationDialog
        open={pendingControl !== null}
        title="Apply guarded platform control?"
        message={(
          <p>
            This requests a versioned <strong>{pendingControl?.kind}</strong> presentation change.
            The server will reject stale evidence, missing MFA, or disabled mutation rollout.
          </p>
        )}
        confirmLabel="Apply control"
        busy={mutationBusy}
        onCancel={closeControlDialog}
        onConfirm={() => void applyControl()}
      >
        <label className="admin-confirmation-field">
          <span>Reason for the audit trail</span>
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="At least 10 characters"
          />
        </label>
        <label className="admin-confirmation-field">
          <span>Type <strong>APPLY PLATFORM CONTROL</strong></span>
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
