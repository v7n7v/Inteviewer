'use client';

import { useMemo, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import type {
  AdminCostResponse,
  AdminEvidenceState,
  AdminPlatformStatsResponse,
} from '@/lib/admin/contracts';
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
import type { SonaPricingOptionsScenarioId } from '@/lib/assistant/pricing-options-decision';

interface ReconciliationPreview {
  accountRef: string;
  status: 'ready' | 'blocked' | 'verified';
  evidenceStatus: 'complete' | 'incomplete';
  missing: string[];
  proposed: {
    plan?: string;
    billingInterval?: 'month' | 'year';
    recurringAmountCents?: number;
    recurringCurrency?: string;
  };
}

interface ReconciliationPayload {
  previews: ReconciliationPreview[];
  activationRequired?: boolean;
  writePerformed: false;
  meta: {
    generatedAt: string;
    staleAfterMs: number;
    partial: boolean;
    truncated: boolean;
    maxAccounts: number;
  };
}

interface PricingScenario {
  id: Exclude<SonaPricingOptionsScenarioId, 'no_change'>;
  label: string;
  summary: string;
  status: 'pass' | 'watch';
  promotionDiscountPercent: number;
  tradeoff: string;
  plans: Array<{
    plan: 'pro' | 'studio';
    planLabel: string;
    runsPerDayMax: number;
    preparedPacketsPerDayMax: number;
    status: 'pass' | 'watch';
    intervals: {
      month: {
        displayPrice: string;
        status: 'pass' | 'watch' | 'blocked';
        workloadMarginPercent: number | null;
        firstCycleMarginPercent: number | null;
        firstCycleWorkloadCostUsd: number;
      };
      year: {
        displayPrice: string;
        status: 'pass' | 'watch' | 'blocked';
        workloadMarginPercent: number | null;
        firstCycleMarginPercent: number | null;
        firstCycleWorkloadCostUsd: number;
      };
    };
  }>;
}

interface PricingReviewPayload {
  memo: {
    version: string;
    generatedAt: string;
    evidenceFingerprint: string;
    status: 'ready_for_review' | 'blocked';
    readyForHumanReview: boolean;
    reason: string;
    scope: string;
    scenarios: PricingScenario[];
  };
  decision: {
    evidenceFingerprint: string;
    selectedScenarioId: SonaPricingOptionsScenarioId;
    selectedScenarioLabel: string;
    rationale: string;
    reviewedBy: string;
    recordedAt: string;
  } | null;
  mutationAuthority: {
    stripe: false;
    price: false;
    promotion: false;
    entitlement: false;
  };
}

const WINDOW_OPTIONS = [7, 30, 90] as const;

function parseCosts(payload: unknown): AdminCostResponse {
  return payload as AdminCostResponse;
}

function parseStats(payload: unknown): AdminPlatformStatsResponse {
  return payload as AdminPlatformStatsResponse;
}

function parseReconciliation(payload: unknown): ReconciliationPayload {
  const value = payload as Partial<ReconciliationPayload>;
  return {
    previews: Array.isArray(value.previews) ? value.previews : [],
    writePerformed: false,
    meta: {
      generatedAt: value.meta?.generatedAt || new Date().toISOString(),
      staleAfterMs: value.meta?.staleAfterMs || 300_000,
      partial: value.meta?.partial === true,
      truncated: value.meta?.truncated === true,
      maxAccounts: value.meta?.maxAccounts || 20,
    },
  };
}

function money(value: number | null, digits = 0) {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function count(value: number | null) {
  return value === null ? 'Unavailable' : new Intl.NumberFormat('en-US').format(value);
}

function percentage(value: number | null) {
  return value === null || !Number.isFinite(value) ? 'Unavailable' : `${value.toFixed(1)}%`;
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

function ageSeconds(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 1_000) : null;
}

function evidenceTone(state: AdminEvidenceState): AdminStatusTone {
  if (state === 'ready') return 'healthy';
  if (state === 'degraded') return 'degraded';
  if (state === 'blocked') return 'critical';
  return 'unknown';
}

function previewTone(preview: ReconciliationPreview): AdminStatusTone {
  if (preview.status === 'verified' || preview.evidenceStatus === 'complete') return 'healthy';
  if (preview.status === 'blocked') return 'critical';
  return 'degraded';
}

function proposedSummary(preview: ReconciliationPreview) {
  const proposed = preview.proposed;
  if (!Object.keys(proposed).length) return 'No safe proposal';
  const amount = typeof proposed.recurringAmountCents === 'number'
    ? money(proposed.recurringAmountCents / 100, 2)
    : 'amount unavailable';
  return [
    proposed.plan || 'plan unavailable',
    proposed.billingInterval || 'interval unavailable',
    amount,
  ].join(' · ');
}

export function FinanceCommandCenter() {
  const { hasPermission } = useAdminSession();
  const canRead = hasPermission('billing.read');
  const canManage = hasPermission('billing.manage');
  const [windowDays, setWindowDays] = useState<(typeof WINDOW_OPTIONS)[number]>(30);
  const costEndpoint = `/api/admin/costs?windowDays=${windowDays}`;
  const costs = useAdminResource<AdminCostResponse>(costEndpoint, {
    enabled: canRead,
    staleAfterMs: 60_000,
    parse: parseCosts,
  });
  const stats = useAdminResource<AdminPlatformStatsResponse>('/api/admin/stats', {
    enabled: canRead,
    staleAfterMs: 60_000,
    parse: parseStats,
  });
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const reconciliation = useAdminResource<ReconciliationPayload>(
    '/api/admin/billing/reconciliation-preview?activate=1&limit=5',
    {
      enabled: canRead && previewEnabled,
      staleAfterMs: 300_000,
      parse: parseReconciliation,
    },
  );
  const [selectedPreview, setSelectedPreview] = useState<ReconciliationPreview | null>(null);
  const [syncTarget, setSyncTarget] = useState<ReconciliationPreview | null>(null);
  const [syncReason, setSyncReason] = useState('');
  const [syncConfirmation, setSyncConfirmation] = useState('');
  const [syncIdempotencyKey, setSyncIdempotencyKey] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [pricingReview, setPricingReview] = useState<PricingReviewPayload | null>(null);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [pricingSubmitBusy, setPricingSubmitBusy] = useState(false);
  const [pricingError, setPricingError] = useState('');
  const [selectedScenarioId, setSelectedScenarioId] = useState<SonaPricingOptionsScenarioId>('no_change');
  const [pricingRationale, setPricingRationale] = useState('');
  const [pricingConfirmation, setPricingConfirmation] = useState('');
  const [acknowledgedNoStripeMutation, setAcknowledgedNoStripeMutation] = useState(false);
  const [acknowledgedNoPromotionMutation, setAcknowledgedNoPromotionMutation] = useState(false);
  const [acknowledgedNoEntitlementMutation, setAcknowledgedNoEntitlementMutation] = useState(false);

  const costData = costs.data;
  const statsData = stats.data;
  const previews = reconciliation.data?.previews || [];
  const readyPreviews = previews.filter(preview => (
    preview.status === 'ready' && preview.evidenceStatus === 'complete'
  )).length;
  const blockedPreviews = previews.filter(preview => preview.status === 'blocked').length;

  const previewColumns = useMemo<readonly AdminDataColumn<ReconciliationPreview>[]>(() => [
    {
      key: 'account',
      header: 'Billing account',
      render: preview => (
        <span className="finance-account-cell">
          <span className="material-symbols-rounded" aria-hidden="true">account_balance_wallet</span>
          <span>
            <strong>{preview.accountRef}</strong>
            <small>Server-owned account reference</small>
          </span>
        </span>
      ),
    },
    {
      key: 'evidence',
      header: 'Evidence',
      render: preview => (
        <AdminStatusBadge tone={previewTone(preview)}>
          {preview.evidenceStatus}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'proposal',
      header: 'Read-only proposal',
      render: preview => <span className="finance-proposal">{proposedSummary(preview)}</span>,
    },
    {
      key: 'missing',
      header: 'Missing',
      render: preview => (
        <span className="finance-missing">
          {preview.missing.length ? preview.missing.join(', ').replaceAll('_', ' ') : 'None'}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Next step',
      align: 'right',
      render: preview => (
        <AdminButton
          size="sm"
          variant={preview.status === 'blocked' ? 'ghost' : 'secondary'}
          icon={preview.status === 'blocked' ? 'lock' : 'sync'}
          disabled={!canManage || preview.status === 'blocked'}
          onClick={event => {
            event.stopPropagation();
            if (!canManage || preview.status === 'blocked') return;
            stageSync(preview);
            setMutationError('');
          }}
        >
          {preview.status === 'blocked' ? 'Blocked' : 'Sync evidence'}
        </AdminButton>
      ),
    },
  ], [canManage]);

  async function refreshAll() {
    await Promise.all([
      costs.refresh(),
      stats.refresh(),
      ...(previewEnabled ? [reconciliation.refresh()] : []),
    ]);
  }

  async function loadPricingReview() {
    if (!canRead || pricingBusy) return;
    setPricingBusy(true);
    setPricingError('');
    try {
      const response = await authFetch('/api/admin/billing/pricing-options-decision?activate=1');
      const payload = await response.json().catch(() => ({})) as PricingReviewPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Pricing evidence could not be loaded.');
      setPricingReview(payload);
      setSelectedScenarioId(payload.decision?.selectedScenarioId || 'no_change');
      setPricingRationale(payload.decision?.rationale || '');
      setPricingConfirmation('');
      setAcknowledgedNoStripeMutation(false);
      setAcknowledgedNoPromotionMutation(false);
      setAcknowledgedNoEntitlementMutation(false);
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : 'Pricing evidence could not be loaded.');
    } finally {
      setPricingBusy(false);
    }
  }

  async function recordPricingReview() {
    const fingerprint = pricingReview?.memo.evidenceFingerprint;
    if (
      !fingerprint
      || !canManage
      || pricingReview?.decision
      || pricingRationale.trim().length < 20
      || pricingConfirmation !== `RECORD ${fingerprint.slice(0, 8).toUpperCase()}`
      || !acknowledgedNoStripeMutation
      || !acknowledgedNoPromotionMutation
      || !acknowledgedNoEntitlementMutation
    ) return;
    setPricingSubmitBusy(true);
    setPricingError('');
    try {
      const response = await authFetch('/api/admin/billing/pricing-options-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceFingerprint: fingerprint,
          selectedScenarioId,
          rationale: pricingRationale.trim(),
          confirmationText: pricingConfirmation,
          acknowledgedNoStripeMutation,
          acknowledgedNoPromotionMutation,
          acknowledgedNoEntitlementMutation,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        decision?: PricingReviewPayload['decision'];
        alreadyRecorded?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.decision) {
        throw new Error(payload.error || 'The pricing review could not be recorded.');
      }
      setPricingReview(current => current ? { ...current, decision: payload.decision || null } : current);
      setNotice(payload.alreadyRecorded
        ? 'The identical pricing review was already recorded for this evidence.'
        : 'Pricing review recorded. No price, promotion, Stripe object, or entitlement was changed.');
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : 'The pricing review could not be recorded.');
    } finally {
      setPricingSubmitBusy(false);
    }
  }

  function stageSync(preview: ReconciliationPreview) {
    if (!canManage || preview.status === 'blocked') return;
    setSyncTarget(preview);
    setSyncReason('');
    setSyncConfirmation('');
    setSyncIdempotencyKey(`finance-${preview.accountRef}-${crypto.randomUUID()}`);
    setMutationError('');
  }

  async function syncEvidence() {
    if (
      !syncTarget
      || !canManage
      || syncReason.trim().length < 10
      || syncConfirmation !== 'SYNC BILLING EVIDENCE'
      || !syncIdempotencyKey
    ) return;
    setSyncBusy(true);
    setMutationError('');
    setNotice('');
    try {
      const response = await authFetch(
        `/api/admin/billing/accounts/${encodeURIComponent(syncTarget.accountRef)}/sync`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: syncReason.trim(),
            confirmationText: syncConfirmation,
            idempotencyKey: syncIdempotencyKey,
          }),
        },
      );
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        duplicate?: boolean;
      };
      if (!response.ok) throw new Error(payload.error || 'Billing evidence could not be synchronized.');
      setNotice(payload.duplicate
        ? 'This bounded evidence sync was already recorded. No duplicate change was made.'
        : 'A non-authoritative reconciliation receipt was captured. No price, plan, or entitlement was changed.');
      setSyncTarget(null);
      setSelectedPreview(null);
      setSyncIdempotencyKey('');
      await refreshAll();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Billing evidence could not be synchronized.');
    } finally {
      setSyncBusy(false);
    }
  }

  const financeState = !canRead
    ? 'unauthorized'
    : costs.loading || stats.loading
      ? 'loading'
      : costs.error && !costData
        ? 'error'
        : 'ready';
  const reconciliationState = !canRead
    ? 'unauthorized'
    : !previewEnabled
      ? 'empty'
    : reconciliation.loading
      ? 'loading'
      : reconciliation.error && !reconciliation.data
        ? 'error'
        : previews.length === 0
          ? 'empty'
          : 'ready';
  const evidenceComplete = costData?.revenue.complete === true;
  const costsComplete = costData?.evidence.tacoEconomics.complete === true;

  return (
    <div className="finance-command-center">
      <header className="finance-hero">
        <div>
          <p className="finance-kicker">Revenue command</p>
          <h1>Finance evidence</h1>
          <p>
            Verified recurring revenue, bounded workload economics, and read-only Stripe
            reconciliation. Unknown values stay unknown.
          </p>
        </div>
        <div className="finance-hero-actions">
          <label className="finance-window-select">
            <span>Cost window</span>
            <select
              value={windowDays}
              onChange={event => setWindowDays(Number(event.target.value) as typeof windowDays)}
            >
              {WINDOW_OPTIONS.map(days => <option key={days} value={days}>{days} days</option>)}
            </select>
          </label>
          <AdminFreshnessMeter
            ageSeconds={ageSeconds(costs.lastUpdatedAt)}
            freshForSeconds={60}
            label="Finance read"
          />
          <AdminButton
            icon="refresh"
            busy={costs.refreshing || stats.refreshing || reconciliation.refreshing}
            disabled={!canRead}
            onClick={() => void refreshAll()}
          >
            Refresh evidence
          </AdminButton>
        </div>
      </header>

      {mutationError ? <div className="finance-alert is-error" role="alert">{mutationError}</div> : null}
      {notice ? <div className="finance-alert is-success" role="status">{notice}</div> : null}
      {(costs.stale || stats.stale) && (costData || statsData) ? (
        <div className="finance-alert is-warning" role="status">
          Showing the last verified finance response. A fresher read is unavailable or still in progress.
        </div>
      ) : null}

      <AdminStateBoundary
        state={financeState}
        title={financeState === 'unauthorized' ? 'Billing permission required' : undefined}
        message={financeState === 'error' ? costs.error : undefined}
        onRetry={financeState === 'error' ? () => void refreshAll() : undefined}
      >
        <section className="finance-metric-grid" aria-label="Finance evidence summary">
          <AdminMetricCard
            label="Verified MRR"
            value={money(evidenceComplete ? costData?.revenue.verifiedMrrUsd ?? null : null)}
            icon="payments"
            detail={costData?.revenue.coveragePercent == null
              ? 'Authoritative coverage unavailable'
              : `${costData.revenue.coveragePercent}% authoritative coverage`}
            status={evidenceComplete ? 'Complete evidence' : 'Incomplete evidence'}
            statusTone={evidenceComplete ? 'healthy' : 'degraded'}
          />
          <AdminMetricCard
            label="Priced paid accounts"
            value={count(statsData?.verifiedMrr.pricedActiveAccounts ?? null)}
            icon="verified"
            detail={costData?.revenue.unresolvedActiveAccounts == null
              ? 'Unresolved account count unavailable'
              : `${costData.revenue.unresolvedActiveAccounts} unresolved active accounts`}
            status="Subscription evidence"
            statusTone={evidenceComplete ? 'healthy' : 'degraded'}
          />
          <AdminMetricCard
            label={`Observed Taco cost · ${windowDays}d`}
            value={money(costData?.costs.tacoProviderEstimatedUsd ?? null, 2)}
            icon="neurology"
            detail={`${costData?.costs.runsObserved ?? 0} recorded work events`}
            status={costsComplete ? 'Directional evidence' : 'Partial evidence'}
            statusTone={costsComplete ? 'info' : 'degraded'}
          />
          <AdminMetricCard
            label="Revenue less observed Taco cost"
            value={money(costData?.directionalContribution.revenueLessObservedTacoCostUsd ?? null, 2)}
            icon="difference"
            detail={costData?.directionalContribution.marginPercent === null
              ? 'Directional margin unavailable'
              : `${costData?.directionalContribution.marginPercent}% directional margin`}
            status="Not total gross margin"
            statusTone="degraded"
          />
        </section>

        <div className="finance-evidence-grid">
          <AdminPanel
            className="finance-evidence-panel"
            eyebrow="Authoritative"
            title="Revenue basis"
            description="Recurring amounts from active server-owned subscription evidence."
            toolbar={(
              <AdminStatusBadge tone={evidenceTone(costData?.evidence.subscriptions.state || 'unknown')}>
                {costData?.evidence.subscriptions.state || 'unknown'}
              </AdminStatusBadge>
            )}
          >
            <dl className="finance-evidence-list">
              <div>
                <dt>Active paid accounts</dt>
                <dd>{count(costData?.revenue.activePaidAccounts ?? null)}</dd>
              </div>
              <div>
                <dt>Evidence coverage</dt>
                <dd>{costData?.revenue.coveragePercent == null ? 'Unavailable' : `${costData.revenue.coveragePercent}%`}</dd>
              </div>
              <div>
                <dt>Basis version</dt>
                <dd>{costData?.revenue.basisVersion || 'Not recorded'}</dd>
              </div>
              <div>
                <dt>Generated</dt>
                <dd>{dateTime(costData?.generatedAt)}</dd>
              </div>
            </dl>
            <div className="finance-source-note">
              <span className="material-symbols-rounded" aria-hidden="true">verified_user</span>
              <p>{costData?.evidence.subscriptions.source || 'Subscription evidence unavailable.'}</p>
            </div>
          </AdminPanel>

          <AdminPanel
            className="finance-evidence-panel"
            eyebrow="Directional"
            title="Workload cost basis"
            description="Observed Taco provider workload only; never presented as a complete expense ledger."
            toolbar={(
              <AdminStatusBadge tone={evidenceTone(costData?.evidence.tacoEconomics.state || 'unknown')}>
                {costData?.evidence.tacoEconomics.state || 'unknown'}
              </AdminStatusBadge>
            )}
          >
            <dl className="finance-evidence-list">
              <div>
                <dt>Total operating cost</dt>
                <dd className="is-unknown">Unknown</dd>
              </div>
              <div>
                <dt>Net profit</dt>
                <dd className="is-unknown">Unknown</dd>
              </div>
              <div>
                <dt>Total profit margin</dt>
                <dd className="is-unknown">Unknown</dd>
              </div>
              <div>
                <dt>Cost per user</dt>
                <dd className="is-unknown">Unknown</dd>
              </div>
            </dl>
            <div className="finance-source-note is-warning">
              <span className="material-symbols-rounded" aria-hidden="true">info</span>
              <p>{costData?.costs.scope || 'Verified provider workload evidence is unavailable.'}</p>
            </div>
          </AdminPanel>
        </div>

        <AdminPanel
          className="finance-limitations"
          eyebrow="Truth boundary"
          title="What this screen does not claim"
          description="Finance stays trustworthy by making the boundary visible."
        >
          <ul>
            {(costData?.limitations || [
              'Total operating-cost evidence is not available.',
              'No plan-count extrapolation is shown.',
            ]).map(item => (
              <li key={item}>
                <span className="material-symbols-rounded" aria-hidden="true">shield</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </AdminPanel>
      </AdminStateBoundary>

      <AdminPanel
        className="finance-pricing-review"
        eyebrow="Human decision boundary"
        title="Decision for this evidence snapshot"
        description="Compare the verified scenarios, then record one immutable review for the current fingerprint. This workflow cannot change prices or entitlements."
        toolbar={(
          <AdminButton
            icon={pricingReview ? 'refresh' : 'fact_check'}
            busy={pricingBusy}
            disabled={!canRead || pricingSubmitBusy}
            onClick={() => void loadPricingReview()}
          >
            {pricingReview ? 'Refresh evidence' : 'Load pricing evidence'}
          </AdminButton>
        )}
      >
        {pricingError ? <div className="finance-alert is-error" role="alert">{pricingError}</div> : null}
        {!pricingReview ? (
          <div className="finance-pricing-empty">
            <span className="material-symbols-rounded" aria-hidden="true">price_check</span>
            <div>
              <strong>Record scenario review</strong>
              <p>
                Provider-backed pricing and promotion evidence loads only after an explicit operator action.
                No review, Stripe call, or mutation runs merely because Finance is open.
              </p>
            </div>
          </div>
        ) : (
          <div className="finance-pricing-workspace">
            <header className="finance-pricing-evidence">
              <div>
                <span>Evidence fingerprint</span>
                <strong>{pricingReview.memo.evidenceFingerprint.slice(0, 16)}…</strong>
              </div>
              <div>
                <span>Generated</span>
                <strong>{dateTime(pricingReview.memo.generatedAt)}</strong>
              </div>
              <AdminStatusBadge tone={pricingReview.memo.readyForHumanReview ? 'healthy' : 'critical'}>
                {pricingReview.memo.readyForHumanReview ? 'Ready for review' : 'Evidence blocked'}
              </AdminStatusBadge>
            </header>

            {pricingReview.decision ? (
              <section className="finance-pricing-recorded" aria-label="Recorded pricing review">
                <span className="material-symbols-rounded" aria-hidden="true">verified</span>
                <div>
                  <strong>{pricingReview.decision.selectedScenarioLabel}</strong>
                  <p>{pricingReview.decision.rationale}</p>
                  <small>
                    Recorded by {pricingReview.decision.reviewedBy} · {dateTime(pricingReview.decision.recordedAt)}
                  </small>
                </div>
                <AdminStatusBadge tone="healthy">Canonical record</AdminStatusBadge>
              </section>
            ) : (
              <>
                <fieldset className="finance-scenario-fieldset">
                  <legend>Select a scenario for review</legend>
                  <div className="finance-scenario-grid">
                    {pricingReview.memo.scenarios.map(scenario => (
                      <label
                        key={scenario.id}
                        className={selectedScenarioId === scenario.id ? 'is-selected' : ''}
                      >
                        <input
                          type="radio"
                          name="pricing-scenario"
                          value={scenario.id}
                          checked={selectedScenarioId === scenario.id}
                          onChange={() => setSelectedScenarioId(scenario.id)}
                        />
                        <span className="finance-scenario-heading">
                          <span>
                            <strong>{scenario.label}</strong>
                            <small>{scenario.summary}</small>
                          </span>
                          <AdminStatusBadge tone={scenario.status === 'pass' ? 'healthy' : 'degraded'}>
                            {scenario.status}
                          </AdminStatusBadge>
                        </span>
                        <span className="finance-scenario-promotion">
                          Promotion stress: <strong>{scenario.promotionDiscountPercent}%</strong>
                        </span>
                        <span className="finance-scenario-plans">
                          {scenario.plans.map(plan => (
                            <span key={plan.plan}>
                              <strong>{plan.planLabel}</strong>
                              <small>
                                {plan.intervals.month.displayPrice} · {plan.intervals.year.displayPrice}
                              </small>
                              <small>
                                {plan.runsPerDayMax} runs · {plan.preparedPacketsPerDayMax} packets/day
                              </small>
                              <span className="finance-scenario-economics">
                                <small>
                                  <span>Steady workload</span>
                                  <strong>
                                    {percentage(plan.intervals.month.workloadMarginPercent)} monthly margin
                                  </strong>
                                </small>
                                <small>
                                  <span>First cycle</span>
                                  <strong>
                                    {percentage(plan.intervals.month.firstCycleMarginPercent)} margin ·{' '}
                                    {money(plan.intervals.month.firstCycleWorkloadCostUsd, 2)} workload
                                  </strong>
                                </small>
                              </span>
                            </span>
                          ))}
                        </span>
                        <span className="finance-scenario-tradeoff">{scenario.tradeoff}</span>
                      </label>
                    ))}
                    <label className={selectedScenarioId === 'no_change' ? 'is-selected' : ''}>
                      <input
                        type="radio"
                        name="pricing-scenario"
                        value="no_change"
                        checked={selectedScenarioId === 'no_change'}
                        onChange={() => setSelectedScenarioId('no_change')}
                      />
                      <span className="finance-scenario-heading">
                        <span>
                          <strong>No change</strong>
                          <small>Record that no reviewed scenario should advance from this evidence.</small>
                        </span>
                        <AdminStatusBadge tone="info">Hold</AdminStatusBadge>
                      </span>
                      <span className="finance-scenario-tradeoff">
                        Preserves the current system while explicitly documenting the reviewer’s decision.
                      </span>
                    </label>
                  </div>
                </fieldset>

                <label className="finance-confirmation-field">
                  <span>Review rationale</span>
                  <textarea
                    rows={4}
                    maxLength={1_000}
                    value={pricingRationale}
                    onChange={event => setPricingRationale(event.target.value)}
                    placeholder="Explain the evidence and tradeoff behind this decision…"
                  />
                  <small>20–1,000 characters. Stored with the fingerprint-bound canonical record.</small>
                </label>

                <div className="finance-pricing-attestations">
                  <label>
                    <input
                      type="checkbox"
                      checked={acknowledgedNoStripeMutation}
                      onChange={event => setAcknowledgedNoStripeMutation(event.target.checked)}
                    />
                    <span><strong>No Stripe mutation</strong><small>This records review evidence only.</small></span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={acknowledgedNoPromotionMutation}
                      onChange={event => setAcknowledgedNoPromotionMutation(event.target.checked)}
                    />
                    <span><strong>No promotion mutation</strong><small>Promotion policy remains unchanged.</small></span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={acknowledgedNoEntitlementMutation}
                      onChange={event => setAcknowledgedNoEntitlementMutation(event.target.checked)}
                    />
                    <span><strong>No entitlement mutation</strong><small>Workload limits remain unchanged.</small></span>
                  </label>
                </div>

                <div className="finance-pricing-record-action">
                  <label className="finance-confirmation-field">
                    <span>
                      Type <strong>RECORD {pricingReview.memo.evidenceFingerprint.slice(0, 8).toUpperCase()}</strong>
                    </span>
                    <input
                      type="text"
                      autoComplete="off"
                      value={pricingConfirmation}
                      onChange={event => setPricingConfirmation(event.target.value)}
                    />
                  </label>
                  <AdminButton
                    variant="primary"
                    icon="lock"
                    busy={pricingSubmitBusy}
                    disabled={
                      !canManage
                      || !pricingReview.memo.readyForHumanReview
                      || pricingRationale.trim().length < 20
                      || pricingConfirmation !== `RECORD ${pricingReview.memo.evidenceFingerprint.slice(0, 8).toUpperCase()}`
                      || !acknowledgedNoStripeMutation
                      || !acknowledgedNoPromotionMutation
                      || !acknowledgedNoEntitlementMutation
                    }
                    onClick={() => void recordPricingReview()}
                  >
                    Record review only
                  </AdminButton>
                </div>
              </>
            )}
            <footer className="finance-pricing-scope">
              <span className="material-symbols-rounded" aria-hidden="true">gavel</span>
              <p>{pricingReview.memo.scope}</p>
            </footer>
          </div>
        )}
      </AdminPanel>

      <AdminPanel
        className="finance-reconciliation"
        eyebrow="Bounded · read-only preview"
        title="Billing reconciliation"
        description="Compares at most 20 local billing accounts with Stripe. Preview performs no writes."
        toolbar={(
          <div className="finance-reconciliation-status">
            <AdminStatusBadge tone={reconciliation.data?.meta.partial ? 'degraded' : 'info'}>
              {reconciliation.data?.meta.partial ? 'Partial' : 'Read only'}
            </AdminStatusBadge>
            <AdminButton
              size="sm"
              icon="preview"
              busy={reconciliation.refreshing}
              disabled={!canRead}
              onClick={() => {
                if (!previewEnabled) setPreviewEnabled(true);
                else void reconciliation.refresh();
              }}
            >
              Preview repairs
            </AdminButton>
          </div>
        )}
      >
        <div className="finance-reconciliation-summary">
          <span><strong>{previews.length}</strong> accounts inspected</span>
          <span><strong>{readyPreviews}</strong> ready for evidence sync</span>
          <span><strong>{blockedPreviews}</strong> blocked safely</span>
          <span><strong>0</strong> writes from preview</span>
        </div>
        {reconciliation.stale && reconciliation.data ? (
          <div className="finance-inline-warning" role="status">
            <span className="material-symbols-rounded" aria-hidden="true">schedule</span>
            Preview evidence is stale. Refresh before any bounded sync.
          </div>
        ) : null}
        <AdminStateBoundary
          state={reconciliationState}
          title={reconciliationState === 'unauthorized' ? 'Billing permission required' : undefined}
          message={reconciliationState === 'error' ? reconciliation.error : undefined}
          onRetry={reconciliationState === 'error' ? () => void reconciliation.refresh() : undefined}
        >
          <AdminDataTable
            columns={previewColumns}
            rows={previews}
            rowKey={preview => preview.accountRef}
            rowLabel={preview => `Inspect billing evidence for account reference ${preview.accountRef}`}
            onRowActivate={setSelectedPreview}
            caption="Read-only Stripe billing reconciliation preview"
            className="finance-preview-table"
          />
        </AdminStateBoundary>
        {reconciliation.data?.meta.truncated ? (
          <footer className="finance-bounded-note">
            Results reached the 20-account safety bound. Narrow investigation outside this preview before proceeding.
          </footer>
        ) : null}
      </AdminPanel>

      <AdminDetailDrawer
        open={selectedPreview !== null}
        title="Reconciliation evidence"
        description="Read-only comparison. Customer and provider identifiers are deliberately omitted."
        onClose={() => setSelectedPreview(null)}
        footer={selectedPreview ? (
          <>
            <AdminButton variant="ghost" onClick={() => setSelectedPreview(null)}>Close</AdminButton>
            <AdminButton
              icon="sync"
              disabled={!canManage || selectedPreview.status === 'blocked'}
              onClick={() => {
                stageSync(selectedPreview);
              }}
            >
              Review bounded sync
            </AdminButton>
          </>
        ) : undefined}
      >
        {selectedPreview ? (
          <div className="finance-drawer-evidence">
            <div className="finance-drawer-account">
              <span className="material-symbols-rounded" aria-hidden="true">receipt_long</span>
              <div>
                <span>Billing account</span>
                <strong>{selectedPreview.accountRef}</strong>
              </div>
              <AdminStatusBadge tone={previewTone(selectedPreview)}>
                {selectedPreview.status}
              </AdminStatusBadge>
            </div>
            <section>
              <h3>Proposed server evidence</h3>
              <dl>
                <div><dt>Plan</dt><dd>{selectedPreview.proposed.plan || 'Unavailable'}</dd></div>
                <div><dt>Interval</dt><dd>{selectedPreview.proposed.billingInterval || 'Unavailable'}</dd></div>
                <div>
                  <dt>Recurring amount</dt>
                  <dd>{typeof selectedPreview.proposed.recurringAmountCents === 'number'
                    ? money(selectedPreview.proposed.recurringAmountCents / 100, 2)
                    : 'Unavailable'}</dd>
                </div>
                <div><dt>Currency</dt><dd>{selectedPreview.proposed.recurringCurrency || 'Unavailable'}</dd></div>
                <div><dt>Price evidence</dt><dd>Provider identifier deliberately omitted</dd></div>
              </dl>
            </section>
            <section>
              <h3>Safety decision</h3>
              {selectedPreview.missing.length ? (
                <ul>{selectedPreview.missing.map(item => <li key={item}>{item.replaceAll('_', ' ')}</li>)}</ul>
              ) : (
                <p className="finance-ready-copy">
                  The preview found complete recurrence evidence. A separate confirmed sync is still required.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </AdminDetailDrawer>

      <AdminConfirmationDialog
        open={syncTarget !== null}
        title="Synchronize billing evidence?"
        message={(
          <p>
            This reads one Stripe account and updates bounded billing evidence. It does not
            change price, plan, promotion, entitlement, or Checkout Sessions.
          </p>
        )}
        confirmLabel="Synchronize evidence"
        busy={syncBusy}
        onCancel={() => {
          if (syncBusy) return;
          setSyncTarget(null);
          setSyncReason('');
          setSyncConfirmation('');
          setSyncIdempotencyKey('');
        }}
        onConfirm={() => void syncEvidence()}
      >
        <label className="finance-confirmation-field">
          <span>Operator reason</span>
          <textarea
            rows={3}
            maxLength={500}
            value={syncReason}
            onChange={event => setSyncReason(event.target.value)}
            placeholder="Why is this evidence sync required?"
          />
          <small>At least 10 characters. Stored in the administrative audit trail.</small>
        </label>
        <label className="finance-confirmation-field">
          <span>Type <strong>SYNC BILLING EVIDENCE</strong> to continue</span>
          <input
            type="text"
            autoComplete="off"
            value={syncConfirmation}
            onChange={event => setSyncConfirmation(event.target.value)}
          />
        </label>
        <p className="finance-confirmation-scope">
          Target reference: <strong>{syncTarget?.accountRef}</strong>
        </p>
      </AdminConfirmationDialog>
    </div>
  );
}
