'use client';

import { useMemo, useState } from 'react';
import { useAdminResource } from '@/hooks/useAdminResource';
import { useAdminSession } from '@/components/admin/shell/AdminSessionProvider';
import { AdminButton } from '@/components/admin/primitives/AdminButton';
import { AdminMetricCard } from '@/components/admin/primitives/AdminMetricCard';
import { AdminPanel } from '@/components/admin/primitives/AdminPanel';
import { AdminSegmentedControl } from '@/components/admin/primitives/AdminSegmentedControl';
import { AdminStateBoundary } from '@/components/admin/primitives/AdminStateBoundary';
import { AdminStatusBadge } from '@/components/admin/primitives/AdminStatusBadge';
import './calibration-command-center.css';

type CalibrationWindow = '30' | '90' | '180' | '365';

interface CalibrationSegment {
  key: string;
  count: number | null;
  positive: number | null;
  negative: number | null;
  positiveRate: number | null;
  averageScore: number | null;
  suppressed: boolean;
}

interface CalibrationResponse {
  generatedAt: string;
  windowDays: number;
  trackedRecords: number;
  report: {
    scoreVersion: string;
    status: 'ready_for_human_review' | 'collecting';
    automaticChangesApplied: false;
    gate: {
      minimumUsers: number;
      minimumOutcomes: number;
      minimumPositive: number;
      minimumNegative: number;
      minimumScoreBands: number;
      minimumOutcomesPerScoreBand: number;
    };
    cohort: {
      scanned: number;
      labelled: number;
      eligible: number;
      uniqueUsers: number;
      positive: number | null;
      negative: number | null;
      positiveRate: number | null;
      outcomeCellsSuppressed: boolean;
      privacyMinCellSize: number;
      topThreeOnly: boolean;
      qualifiedScoreBands: number;
      truncated: boolean;
      sampleLimit: number;
    };
    missing: string[];
    exclusionCounts: Record<string, number>;
    scoreBuckets: CalibrationSegment[];
    byFitConfidence: CalibrationSegment[];
    bySourceConfidence: CalibrationSegment[];
    orderingCheck: {
      monotonic: boolean | null;
      note: string;
    };
    decision: string;
  };
  reviewSafety: {
    automaticChangesApplied: false;
    scoreWeightChangeAuthorized: false;
    thresholdChangeAuthorized: false;
    humanReviewRequired: true;
  };
  privacy: string;
  limitations: string[];
}

const WINDOW_OPTIONS = [
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: '180', label: '180D' },
  { value: '365', label: '1Y' },
] as const;

const SEGMENT_LABELS: Record<string, string> = {
  below_review: 'Below review',
  review: 'Review band',
  prepare: 'Prepare band',
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

function segmentValue(value: number | null, suffix = '') {
  return value === null ? 'Suppressed' : `${value}${suffix}`;
}

function safeDownload(payload: CalibrationResponse) {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    generatedAt: payload.generatedAt,
    windowDays: payload.windowDays,
    trackedRecords: payload.trackedRecords,
    report: payload.report,
    reviewSafety: payload.reviewSafety,
    privacy: payload.privacy,
    limitations: payload.limitations,
  };
  const url = URL.createObjectURL(new Blob(
    [JSON.stringify(snapshot, null, 2)],
    { type: 'application/json' },
  ));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `talent-calibration-aggregate-${payload.windowDays}d.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function CalibrationSegments({
  title,
  description,
  segments,
}: {
  title: string;
  description: string;
  segments: CalibrationSegment[];
}) {
  return (
    <section className="calibration-segment-group">
      <header>
        <strong>{title}</strong>
        <small>{description}</small>
      </header>
      <div className="calibration-segment-list">
        {segments.map(segment => (
          <article key={segment.key} className={segment.suppressed ? 'is-suppressed' : ''}>
            <span className="calibration-segment-title">
              <span>{SEGMENT_LABELS[segment.key] || segment.key.replaceAll('_', ' ')}</span>
              {segment.suppressed ? <AdminStatusBadge tone="paused">Privacy suppressed</AdminStatusBadge> : null}
            </span>
            <strong>{segmentValue(segment.positiveRate, '%')}</strong>
            <small>Positive response rate</small>
            <progress
              max={100}
              value={segment.positiveRate ?? 0}
              aria-label={`${SEGMENT_LABELS[segment.key] || segment.key} positive response rate: ${segmentValue(segment.positiveRate, ' percent')}`}
            />
            <dl>
              <div><dt>Outcomes</dt><dd>{segmentValue(segment.count)}</dd></div>
              <div><dt>Average score</dt><dd>{segmentValue(segment.averageScore)}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CalibrationCommandCenter() {
  const {
    session,
    status: sessionStatus,
    error: sessionError,
    hasPermission,
    refresh: refreshSession,
  } = useAdminSession();
  const [windowDays, setWindowDays] = useState<CalibrationWindow>('180');
  const canRead = sessionStatus === 'ready' && hasPermission('analytics.read');
  const owner = session?.role === 'owner';
  const resource = useAdminResource<CalibrationResponse>(
    `/api/admin/ops/recommendation-calibration?windowDays=${windowDays}`,
    {
      enabled: canRead && owner,
      intervalMs: null,
      staleAfterMs: 600_000,
    },
  );
  const report = resource.data?.report;
  const exclusions = useMemo(
    () => Object.entries(report?.exclusionCounts || {})
      .sort((left, right) => right[1] - left[1]),
    [report?.exclusionCounts],
  );

  if (sessionStatus === 'loading') {
    return <AdminStateBoundary state="loading"><span /></AdminStateBoundary>;
  }
  if (sessionStatus === 'denied' || !session) {
    return (
      <AdminStateBoundary
        state="unauthorized"
        title="Calibration access required"
        message={sessionError || 'An active Admin session is required.'}
        onRetry={() => void refreshSession()}
      >
        <span />
      </AdminStateBoundary>
    );
  }
  if (!canRead || !owner) {
    return (
      <AdminStateBoundary
        state="unauthorized"
        title="Owner review required"
        message="Calibration evidence is restricted to the owner because sparse outcome cohorts can be sensitive."
      >
        <span />
      </AdminStateBoundary>
    );
  }

  const state = resource.loading
    ? 'loading'
    : resource.error && !resource.data
      ? 'error'
      : resource.data
        ? 'ready'
        : 'empty';

  return (
    <div className="calibration-module">
      <header className="admin-module-hero calibration-hero">
        <div>
          <p className="admin-module-kicker">Human-reviewed model evidence</p>
          <h1>Recommendation calibration</h1>
          <p>
            Compare Talent Fit score bands with reported outcomes while keeping weights and
            thresholds fixed until the evidence gate supports human review.
          </p>
        </div>
        <div className="calibration-hero-actions">
          <AdminSegmentedControl
            value={windowDays}
            options={WINDOW_OPTIONS}
            label="Calibration evidence window"
            onChange={setWindowDays}
          />
          <AdminButton
            icon="refresh"
            busy={resource.refreshing}
            onClick={() => void resource.refresh()}
          >
            Rebuild aggregate
          </AdminButton>
          <AdminButton
            icon="download"
            variant="ghost"
            disabled={!resource.data || resource.stale}
            onClick={() => resource.data && !resource.stale && safeDownload(resource.data)}
          >
            Export safe evidence
          </AdminButton>
        </div>
      </header>

      {resource.stale && resource.data ? (
        <div className="admin-module-alert is-warning" role="status">
          This cohort snapshot is older than ten minutes. Refresh before making a review decision.
        </div>
      ) : null}

      <AdminStateBoundary
        state={state}
        message={resource.error || undefined}
        onRetry={() => void resource.refresh()}
      >
        <section className="calibration-metric-grid" aria-label="Calibration cohort">
          <AdminMetricCard
            label="Eligible outcomes"
            value={report?.cohort.eligible ?? '—'}
            icon="fact_check"
            detail={`${report?.cohort.labelled ?? 0} labelled in bounded scan`}
            status={report?.cohort.truncated ? 'Truncated' : 'Bounded complete'}
            statusTone={report?.cohort.truncated ? 'degraded' : 'healthy'}
          />
          <AdminMetricCard
            label="Distinct users"
            value={report?.cohort.uniqueUsers ?? '—'}
            icon="groups"
            detail={`Gate: ${report?.gate.minimumUsers ?? '—'} users`}
            status={(report?.cohort.uniqueUsers || 0) >= (report?.gate.minimumUsers || Infinity) ? 'Met' : 'Collecting'}
            statusTone={(report?.cohort.uniqueUsers || 0) >= (report?.gate.minimumUsers || Infinity) ? 'healthy' : 'degraded'}
          />
          <AdminMetricCard
            label="Positive response"
            value={segmentValue(report?.cohort.positiveRate ?? null, '%')}
            icon="trending_up"
            detail={report?.cohort.outcomeCellsSuppressed ? 'Small cell privacy threshold' : 'Callback, interview, or offer'}
            status={report?.cohort.outcomeCellsSuppressed ? 'Suppressed' : 'Aggregate'}
            statusTone={report?.cohort.outcomeCellsSuppressed ? 'paused' : 'info'}
          />
          <AdminMetricCard
            label="Score policy"
            value={report?.scoreVersion || '—'}
            icon="model_training"
            detail="Weights and thresholds unchanged"
            status="Human review only"
            statusTone="paused"
          />
        </section>

        <div className="calibration-primary-grid">
          <AdminPanel
            className="calibration-score-panel"
            eyebrow="Outcome ordering"
            title="Score-band evidence"
            description="Higher-scored cohorts should not show weaker positive-response ordering."
            toolbar={report ? (
              <AdminStatusBadge
                tone={report.orderingCheck.monotonic === null
                  ? 'unknown'
                  : report.orderingCheck.monotonic
                    ? 'healthy'
                    : 'critical'}
              >
                {report.orderingCheck.monotonic === null
                  ? 'Not enough evidence'
                  : report.orderingCheck.monotonic
                    ? 'Ordering visible'
                    : 'Review ordering'}
              </AdminStatusBadge>
            ) : undefined}
          >
            <CalibrationSegments
              title="Talent Fit bands"
              description={report?.orderingCheck.note || 'No cohort evidence returned.'}
              segments={report?.scoreBuckets || []}
            />
          </AdminPanel>

          <AdminPanel
            className="calibration-gate-panel"
            eyebrow="Release gate"
            title={report?.status === 'ready_for_human_review' ? 'Ready for human review' : 'Evidence still collecting'}
            description={report?.decision}
          >
            <div className="calibration-gate-status">
              <span className="material-symbols-rounded" aria-hidden="true">
                {report?.status === 'ready_for_human_review' ? 'task_alt' : 'hourglass_top'}
              </span>
              <div>
                <strong>{report?.cohort.qualifiedScoreBands ?? 0} qualified score bands</strong>
                <small>
                  Requires {report?.gate.minimumScoreBands ?? '—'} bands with at least{' '}
                  {report?.gate.minimumOutcomesPerScoreBand ?? '—'} outcomes each.
                </small>
              </div>
            </div>
            {(report?.missing.length || 0) > 0 ? (
              <ol className="calibration-missing-list">
                {report?.missing.map(item => (
                  <li key={item}>
                    <span className="material-symbols-rounded" aria-hidden="true">radio_button_unchecked</span>
                    {item}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="calibration-gate-clear">
                <span className="material-symbols-rounded" aria-hidden="true">verified</span>
                The evidence gate passed. A product and data-owner review is still required.
              </p>
            )}
          </AdminPanel>
        </div>

        <div className="calibration-secondary-grid">
          <AdminPanel
            eyebrow="Fit confidence"
            title="Evidence by model confidence"
            description="Small cells remain hidden even from the owner interface."
          >
            <CalibrationSegments
              title="Fit confidence cohorts"
              description="Response evidence grouped by fit-confidence label."
              segments={report?.byFitConfidence || []}
            />
          </AdminPanel>
          <AdminPanel
            eyebrow="Source confidence"
            title="Evidence by source quality"
            description="Separates recommendation behavior from source-quality effects."
          >
            <CalibrationSegments
              title="Source confidence cohorts"
              description="Response evidence grouped by source-confidence label."
              segments={report?.bySourceConfidence || []}
            />
          </AdminPanel>
        </div>

        <div className="calibration-lower-grid">
          <AdminPanel
            eyebrow="Exclusion ledger"
            title="Why records were excluded"
            description="Aggregate reason counts only; no user, role, company, resume, or job identifiers."
          >
            {exclusions.length ? (
              <div className="calibration-exclusion-list">
                {exclusions.map(([reason, count]) => (
                  <span key={reason}>
                    <strong>{reason.replaceAll('_', ' ')}</strong>
                    <b>{count}</b>
                  </span>
                ))}
              </div>
            ) : (
              <p className="calibration-empty">No exclusion reason counts were returned.</p>
            )}
          </AdminPanel>

          <AdminPanel
            eyebrow="Immutable safety posture"
            title="No automatic policy changes"
            description="This module reports evidence. It does not grant recommendation-policy authority."
          >
            <div className="calibration-safety-grid">
              <span><span className="material-symbols-rounded" aria-hidden="true">lock</span><strong>Weights fixed</strong><small>No score-weight mutation authorized.</small></span>
              <span><span className="material-symbols-rounded" aria-hidden="true">lock</span><strong>Thresholds fixed</strong><small>No threshold mutation authorized.</small></span>
              <span><span className="material-symbols-rounded" aria-hidden="true">person_check</span><strong>Human decision</strong><small>Product and data owners review the cohort.</small></span>
              <span><span className="material-symbols-rounded" aria-hidden="true">privacy_tip</span><strong>Privacy floor</strong><small>Cells below {report?.cohort.privacyMinCellSize ?? 5} outcomes are suppressed.</small></span>
            </div>
          </AdminPanel>
        </div>

        <aside className="calibration-limitations" aria-label="Calibration limitations">
          <span className="material-symbols-rounded" aria-hidden="true">info</span>
          <div>
            <strong>Interpret with care</strong>
            <ul>
              {(resource.data?.limitations || []).map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </aside>
      </AdminStateBoundary>
    </div>
  );
}
