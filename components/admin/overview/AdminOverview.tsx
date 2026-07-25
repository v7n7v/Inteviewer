'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type {
  AdminOperationsResponse,
  AdminOperationsSignal,
  AdminPlatformStatsResponse,
} from '@/lib/admin/contracts';
import { useAdminResource } from '@/hooks/useAdminResource';
import { useAdminSession } from '@/components/admin/shell/AdminSessionProvider';
import { AdminButton } from '@/components/admin/primitives/AdminButton';
import { AdminDetailDrawer } from '@/components/admin/primitives/AdminDetailDrawer';
import { AdminFreshnessMeter } from '@/components/admin/primitives/AdminFreshnessMeter';
import { AdminMetricCard } from '@/components/admin/primitives/AdminMetricCard';
import { AdminPanel } from '@/components/admin/primitives/AdminPanel';
import { AdminStateBoundary } from '@/components/admin/primitives/AdminStateBoundary';
import { AdminStatusBadge, type AdminStatusTone } from '@/components/admin/primitives/AdminStatusBadge';
import './admin-overview.css';

type EvidenceRange = '1h' | '6h' | '24h' | '7d';
interface SupportCaseSummary {
  open: number;
  complete: boolean;
  generatedAt: string;
}

function statusTone(state: AdminOperationsSignal['state']): AdminStatusTone {
  if (state === 'ready') return 'healthy';
  if (state === 'degraded') return 'degraded';
  if (state === 'blocked') return 'critical';
  return 'unknown';
}

function statusLabel(state: AdminOperationsSignal['state']) {
  if (state === 'ready') return 'Healthy';
  if (state === 'degraded') return 'Degraded';
  if (state === 'blocked') return 'Blocked';
  return 'Unknown';
}

function formatAge(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return 'Unknown';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3_600)}h ${Math.round((seconds % 3_600) / 60)}m`;
}

function formatMetric(value: number | null, suffix = '') {
  return value === null || !Number.isFinite(value)
    ? 'Not instrumented'
    : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function laneIcon(key: AdminOperationsSignal['key']) {
  if (key === 'stripe') return 'paid';
  if (key === 'job_supply') return 'business_center';
  if (key === 'taco_providers') return 'smart_toy';
  if (key === 'notifications') return 'notifications';
  return 'verified_user';
}

function priorityFor(signal: AdminOperationsSignal) {
  if (signal.state === 'blocked') return { label: 'Critical', tone: 'critical' as AdminStatusTone, rank: 0 };
  if (signal.state === 'degraded') return { label: 'High', tone: 'degraded' as AdminStatusTone, rank: 1 };
  return { label: 'Review', tone: 'unknown' as AdminStatusTone, rank: 2 };
}

function impactFor(signal: AdminOperationsSignal) {
  if (signal.key === 'stripe') return 'Revenue';
  if (signal.key === 'job_supply') return 'Taco';
  if (signal.key === 'taco_providers') return 'AI';
  if (signal.key === 'notifications') return 'Users';
  return 'Security';
}

function downloadAggregateSnapshot(payload: AdminOperationsResponse) {
  const safeSnapshot = {
    exportedAt: new Date().toISOString(),
    sourceGeneratedAt: payload.generatedAt,
    overallState: payload.overallState,
    aggregates: payload.aggregates,
    signals: payload.signals,
    limitations: payload.limitations,
  };
  const url = URL.createObjectURL(new Blob(
    [JSON.stringify(safeSnapshot, null, 2)],
    { type: 'application/json' },
  ));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `talent-admin-operations-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminOverview() {
  const { session, status, error: sessionError, hasPermission, refresh: refreshSession } = useAdminSession();
  const [range, setRange] = useState<EvidenceRange>('1h');
  const [signalFilter, setSignalFilter] = useState<'all' | 'attention'>('all');
  const [selectedSignal, setSelectedSignal] = useState<AdminOperationsSignal | null>(null);
  const [streamPaused, setStreamPaused] = useState(false);
  const [pausedSignals, setPausedSignals] = useState<AdminOperationsSignal[] | null>(null);
  const operations = useAdminResource<AdminOperationsResponse>('/api/admin/ops', {
    enabled: status === 'ready' && hasPermission('operations.read'),
    intervalMs: 30_000,
    staleAfterMs: 75_000,
  });
  const stats = useAdminResource<AdminPlatformStatsResponse>('/api/admin/stats', {
    enabled: status === 'ready' && hasPermission('analytics.read'),
    intervalMs: 300_000,
    staleAfterMs: 600_000,
  });
  const supportSummary = useAdminResource<SupportCaseSummary>('/api/admin/billing/support-cases?summary=1', {
    enabled: status === 'ready' && hasPermission('support.read'),
    intervalMs: 60_000,
    staleAfterMs: 150_000,
  });

  const signals = useMemo(() => {
    const allSignals = operations.data?.signals || [];
    return signalFilter === 'attention'
      ? allSignals.filter(signal => signal.state !== 'ready')
      : allSignals;
  }, [operations.data?.signals, signalFilter]);
  const attentionSignals = useMemo(
    () => (operations.data?.signals || [])
      .filter(signal => signal.state !== 'ready')
      .sort((left, right) => priorityFor(left).rank - priorityFor(right).rank),
    [operations.data?.signals],
  );
  const currentSignal = selectedSignal || attentionSignals[0] || operations.data?.signals[0] || null;
  const mrr = stats.data?.verifiedMrr?.mrrUsd ?? stats.data?.mrr ?? null;
  const healthySignals = (operations.data?.signals || []).filter(signal => signal.state === 'ready').length;
  const totalSignals = operations.data?.signals.length || 0;
  const readiness = totalSignals
    ? `${healthySignals}/${totalSignals}`
    : 'Unknown';
  const generatedAt = operations.data?.generatedAt
    ? new Date(operations.data.generatedAt)
    : null;
  const eventSignals = streamPaused
    ? pausedSignals || []
    : operations.data?.signals || [];

  const toggleStream = () => {
    if (streamPaused) {
      setStreamPaused(false);
      setPausedSignals(null);
      return;
    }
    setPausedSignals([...(operations.data?.signals || [])]);
    setStreamPaused(true);
  };

  if (status === 'loading') {
    return <AdminStateBoundary state="loading"><span /></AdminStateBoundary>;
  }
  if (status === 'denied' || !session) {
    return (
      <AdminStateBoundary
        state="unauthorized"
        title="Admin access required"
        message={sessionError || 'Sign in with an active Admin account to open the command grid.'}
        onRetry={() => void refreshSession()}
      >
        <span />
      </AdminStateBoundary>
    );
  }

  return (
    <div className="admin-overview">
      <h1 className="sr-only">Admin command grid overview</h1>
      {(operations.stale || operations.error) && operations.data ? (
        <div className="admin-evidence-banner is-stale" role="status">
          <span className="material-symbols-rounded" aria-hidden="true">history_toggle_off</span>
          <div>
            <strong>Showing the last verified operational evidence</strong>
            <span>{operations.error || 'The newest evidence is outside its freshness window.'}</span>
          </div>
          <AdminButton size="sm" icon="refresh" busy={operations.refreshing} onClick={() => void operations.refresh()}>
            Refresh
          </AdminButton>
        </div>
      ) : null}

      <div className="admin-overview-grid">
        <aside className="admin-today-rail" aria-label="Today’s Admin signals">
          <div className="admin-today-heading">
            <span>Today</span>
            <time dateTime={new Date().toISOString()}>
              {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZoneName: 'short' }).format(new Date())}
            </time>
          </div>
          <div className="admin-today-metrics">
            <AdminMetricCard
              label="Verified MRR"
              value={mrr === null ? 'Unknown' : `$${mrr.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
              icon="monitoring"
              detail={stats.data?.verifiedMrr?.complete === false ? 'Incomplete coverage' : 'Subscription evidence'}
              status={stats.stale ? 'Stale' : stats.data?.verifiedMrr?.complete === false ? 'Review' : undefined}
              statusTone={stats.stale ? 'unknown' : 'degraded'}
              loading={stats.loading}
            />
            <AdminMetricCard
              label="Platform readiness"
              value={readiness}
              icon="health_and_safety"
              detail={totalSignals ? 'Verified system lanes' : 'No aggregate evidence'}
              status={operations.data ? statusLabel(operations.data.overallState) : undefined}
              statusTone={operations.data ? statusTone(operations.data.overallState) : 'unknown'}
              loading={operations.loading}
            />
            <AdminMetricCard
              label="Open alerts"
              value={attentionSignals.length}
              icon="warning"
              detail="Signals needing review"
              status={attentionSignals.some(signal => signal.state === 'blocked') ? 'Critical' : undefined}
              statusTone="critical"
              loading={operations.loading}
            />
            <AdminMetricCard
              label="Support cases"
              value={!hasPermission('support.read')
                ? 'Restricted'
                : supportSummary.loading
                  ? 'Loading'
                  : supportSummary.data
                    ? `${supportSummary.data.open}${supportSummary.data.complete ? '' : '+'}`
                    : 'Unknown'}
              icon="support_agent"
              detail={supportSummary.data?.complete ? 'Open billing review queue' : 'Bounded billing review queue'}
              status={supportSummary.stale ? 'Stale' : undefined}
              statusTone="unknown"
              loading={supportSummary.loading}
            />
          </div>

          <section className={`admin-selected-signal is-${currentSignal ? statusTone(currentSignal.state) : 'unknown'}`}>
            <p className="admin-selected-signal-label">Selected signal</p>
            {currentSignal ? (
              <>
                <div className="admin-selected-signal-title">
                  <span className="material-symbols-rounded" aria-hidden="true">{laneIcon(currentSignal.key)}</span>
                  <strong>{currentSignal.label}</strong>
                </div>
                <p>{currentSignal.message}</p>
                <div className="admin-selected-signal-meta">
                  <span>{formatAge(currentSignal.evidenceAgeSeconds)} old</span>
                  <AdminStatusBadge tone={statusTone(currentSignal.state)}>
                    {statusLabel(currentSignal.state)}
                  </AdminStatusBadge>
                </div>
                <AdminButton size="sm" variant="ghost" onClick={() => setSelectedSignal(currentSignal)}>
                  View details
                </AdminButton>
              </>
            ) : (
              <p>No operational signal has been returned.</p>
            )}
          </section>
        </aside>

        <div className="admin-overview-main">
          <AdminPanel
            className="admin-operations-map"
            title={(
              <span className="admin-panel-title-with-status">
                Live Operations Map
                <AdminStatusBadge tone={operations.stale ? 'paused' : 'info'} live={!operations.stale && !operations.loading}>
                  {operations.stale ? 'Stale' : 'Evidence polling'}
                </AdminStatusBadge>
              </span>
            )}
            toolbar={(
              <div className="admin-operations-toolbar">
                <div className="admin-segmented-control" aria-label="Evidence range">
                  {(['1h', '6h', '24h', '7d'] as EvidenceRange[]).map(option => {
                    const available = option === '1h';
                    return (
                      <button
                        key={option}
                        type="button"
                        className={range === option ? 'is-active' : ''}
                        aria-pressed={range === option}
                        disabled={!available}
                        title={available ? `${option.toUpperCase()} evidence` : 'Historical telemetry is not instrumented yet'}
                        onClick={() => setRange(option)}
                      >
                        {option.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                <AdminButton icon="refresh" size="sm" variant="ghost" busy={operations.refreshing} onClick={() => void operations.refresh()}>
                  Refresh
                </AdminButton>
                <label className="admin-compact-select">
                  <span className="material-symbols-rounded" aria-hidden="true">filter_alt</span>
                  <span className="sr-only">Filter operations signals</span>
                  <select value={signalFilter} onChange={event => setSignalFilter(event.target.value as 'all' | 'attention')}>
                    <option value="all">All systems</option>
                    <option value="attention">Needs attention</option>
                  </select>
                </label>
                <AdminButton
                  icon="download"
                  size="sm"
                  variant="ghost"
                  disabled={!operations.data}
                  onClick={() => operations.data && downloadAggregateSnapshot(operations.data)}
                >
                  Export snapshot
                </AdminButton>
              </div>
            )}
          >
            <AdminStateBoundary
              state={operations.loading ? 'loading' : operations.error && !operations.data ? 'error' : signals.length ? 'ready' : 'empty'}
              message={operations.error}
              onRetry={() => void operations.refresh()}
            >
              <div className="admin-operations-header" aria-hidden="true">
                <span>System</span>
                <span>Throughput</span>
                <span>Latency p95</span>
                <span>Error rate</span>
                <span>Evidence freshness</span>
                <span>Status</span>
              </div>
              <div className="admin-operation-lanes">
                {signals.map(signal => (
                  <button
                    type="button"
                    key={signal.key}
                    className={`admin-operation-lane is-${statusTone(signal.state)}`}
                    onClick={() => setSelectedSignal(signal)}
                    aria-label={[
                      `Open ${signal.label} evidence`,
                      `${statusLabel(signal.state)} status`,
                      `${formatMetric(signal.throughput)} events per minute`,
                      `${formatMetric(signal.latencyP95Ms, ' milliseconds')} p95 latency`,
                      `${formatMetric(signal.errorRatePercent, ' percent')} error rate`,
                      `${formatAge(signal.evidenceAgeSeconds)} evidence age`,
                      signal.ready === null ? 'readiness unknown' : signal.ready ? 'checks passed' : 'review required',
                    ].join(', ')}
                  >
                    <span className="admin-operation-system">
                      <span className="admin-operation-icon material-symbols-rounded" aria-hidden="true">{laneIcon(signal.key)}</span>
                      <span>
                        <strong>{signal.label}</strong>
                        <small>{signal.message}</small>
                      </span>
                    </span>
                    <span className="admin-operation-metric">
                      <strong>{formatMetric(signal.throughput)}</strong>
                      <small>events / min</small>
                    </span>
                    <span className="admin-operation-metric">
                      <strong>{formatMetric(signal.latencyP95Ms, ' ms')}</strong>
                      <small>provider evidence</small>
                    </span>
                    <span className="admin-operation-metric">
                      <strong>{formatMetric(signal.errorRatePercent, '%')}</strong>
                      <small>verified failures</small>
                    </span>
                    <AdminFreshnessMeter
                      ageSeconds={signal.evidenceAgeSeconds}
                      freshForSeconds={75}
                      label="Evidence age"
                    />
                    <span className="admin-operation-status">
                      <AdminStatusBadge tone={statusTone(signal.state)}>{statusLabel(signal.state)}</AdminStatusBadge>
                      <small>{signal.ready === null ? 'Readiness unknown' : signal.ready ? 'Checks passed' : 'Review required'}</small>
                    </span>
                    <span className="material-symbols-rounded admin-operation-chevron" aria-hidden="true">chevron_right</span>
                  </button>
                ))}
              </div>
            </AdminStateBoundary>
          </AdminPanel>

          <div className="admin-overview-lower">
            <AdminPanel
              className="admin-priority-queue"
              title={(
                <span className="admin-panel-title-with-status">
                  Priority Queue
                  <span className="admin-count-badge">{attentionSignals.length}</span>
                </span>
              )}
              toolbar={<span className="material-symbols-rounded" aria-hidden="true">tune</span>}
              footer={(
                <div className="admin-panel-footer-actions">
                  <Link href="/suite/admin/operations">View all alerts</Link>
                  <AdminButton
                    variant="primary"
                    trailingIcon="arrow_outward"
                    disabled={!currentSignal}
                    onClick={() => currentSignal && setSelectedSignal(currentSignal)}
                  >
                    Open incident room
                  </AdminButton>
                </div>
              )}
            >
              {attentionSignals.length ? (
                <div className="admin-priority-list">
                  {attentionSignals.map(signal => {
                    const priority = priorityFor(signal);
                    return (
                      <button key={signal.key} type="button" onClick={() => setSelectedSignal(signal)} className="admin-priority-row">
                        <AdminStatusBadge tone={priority.tone}>{priority.label}</AdminStatusBadge>
                        <span>
                          <strong>{signal.label}</strong>
                          <small>{signal.message}</small>
                        </span>
                        <span>{impactFor(signal)}</span>
                        <span>{formatAge(signal.evidenceAgeSeconds)}</span>
                        <span className={`admin-inline-status is-${priority.tone}`}>{statusLabel(signal.state)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-queue-clear" role="status">
                  <span className="material-symbols-rounded" aria-hidden="true">task_alt</span>
                  <strong>No operational signals need attention</strong>
                  <p>This reflects the current aggregate evidence window.</p>
                </div>
              )}
            </AdminPanel>

            <AdminPanel
              className="admin-event-stream"
              title={(
                <span className="admin-panel-title-with-status">
                  Event Stream
                  <AdminStatusBadge tone={streamPaused ? 'paused' : 'healthy'} live={!streamPaused}>
                    {streamPaused ? 'Paused' : 'Polling'}
                  </AdminStatusBadge>
                </span>
              )}
              toolbar={(
                <AdminButton
                  size="sm"
                  variant="ghost"
                  icon={streamPaused ? 'play_arrow' : 'pause'}
                  onClick={toggleStream}
                >
                  {streamPaused ? 'Resume' : 'Pause'}
                </AdminButton>
              )}
              footer={<Link className="admin-panel-text-link" href="/suite/admin/audit">View full event log</Link>}
            >
              <div className="admin-event-list" aria-live="off">
                {eventSignals.map(signal => (
                  <article key={signal.key} className="admin-event-row">
                    <time dateTime={signal.checkedAt || undefined}>
                      {signal.checkedAt
                        ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(signal.checkedAt))
                        : 'Not live-checked'}
                    </time>
                    <span className={`material-symbols-rounded is-${statusTone(signal.state)}`} aria-hidden="true">{laneIcon(signal.key)}</span>
                    <span>
                      <strong>{signal.label} {signal.checkedAt ? 'evidence refreshed' : 'configuration status'}</strong>
                      <small>{signal.message}</small>
                    </span>
                    <span>{impactFor(signal)}</span>
                    <AdminStatusBadge tone={statusTone(signal.state)}>{statusLabel(signal.state)}</AdminStatusBadge>
                  </article>
                ))}
                {!eventSignals.length ? (
                  <div className="admin-queue-clear" role="status">
                    <span className="material-symbols-rounded" aria-hidden="true">event_busy</span>
                    <strong>No aggregate events returned</strong>
                  </div>
                ) : null}
              </div>
            </AdminPanel>
          </div>
        </div>
      </div>

      <AdminDetailDrawer
        open={Boolean(selectedSignal)}
        title={selectedSignal ? `${selectedSignal.label} incident room` : 'Incident room'}
        description="Read-only evidence console. Consequential actions remain in permission-scoped workflows."
        size="lg"
        onClose={() => setSelectedSignal(null)}
        footer={selectedSignal ? (
          <div className="admin-drawer-action-row">
            <AdminButton variant="ghost" onClick={() => setSelectedSignal(null)}>Close</AdminButton>
            <Link href={selectedSignal.drilldownHref} className="admin-link-button is-primary">
              Open authorized workflow
              <span className="material-symbols-rounded" aria-hidden="true">arrow_outward</span>
            </Link>
          </div>
        ) : undefined}
      >
        {selectedSignal ? (
          <div className="admin-incident-room">
            <section>
              <p className="admin-incident-eyebrow">Current state</p>
              <div className="admin-incident-status-row">
                <AdminStatusBadge tone={statusTone(selectedSignal.state)}>{statusLabel(selectedSignal.state)}</AdminStatusBadge>
                <span>Checked {formatAge(selectedSignal.evidenceAgeSeconds)} ago</span>
              </div>
              <h3>{selectedSignal.message}</h3>
            </section>
            <section className="admin-incident-evidence-grid">
              <div><span>Configured</span><strong>{selectedSignal.configured === null ? 'Unknown' : selectedSignal.configured ? 'Yes' : 'No'}</strong></div>
              <div><span>Ready</span><strong>{selectedSignal.ready === null ? 'Unknown' : selectedSignal.ready ? 'Yes' : 'No'}</strong></div>
              <div><span>Throughput</span><strong>{formatMetric(selectedSignal.throughput)}</strong></div>
              <div><span>Latency p95</span><strong>{formatMetric(selectedSignal.latencyP95Ms, ' ms')}</strong></div>
              <div><span>Error rate</span><strong>{formatMetric(selectedSignal.errorRatePercent, '%')}</strong></div>
              <div><span>Evidence age</span><strong>{formatAge(selectedSignal.evidenceAgeSeconds)}</strong></div>
            </section>
            <section className="admin-incident-runbook">
              <p className="admin-incident-eyebrow">Safe next step</p>
              <h3>Inspect the dedicated module before taking action.</h3>
              <p>
                This room does not change Stripe, entitlements, email delivery, user access, provider configuration,
                or application state. Open the scoped workflow to see its evidence and confirmation requirements.
              </p>
            </section>
          </div>
        ) : null}
      </AdminDetailDrawer>

      <span className="sr-only" role="status" aria-live="polite">
        {generatedAt ? `Operational evidence updated ${generatedAt.toLocaleTimeString()}.` : ''}
      </span>
    </div>
  );
}
