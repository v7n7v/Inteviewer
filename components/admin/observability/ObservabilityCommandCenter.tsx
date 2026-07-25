'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { authHelpers } from '@/lib/firebase';
import type { MultiFactorResolver } from 'firebase/auth';
import { useAdminResource } from '@/hooks/useAdminResource';
import { AdminButton } from '@/components/admin/primitives/AdminButton';
import { AdminFreshnessMeter } from '@/components/admin/primitives/AdminFreshnessMeter';
import { AdminMetricCard } from '@/components/admin/primitives/AdminMetricCard';
import { AdminPanel } from '@/components/admin/primitives/AdminPanel';
import { AdminStateBoundary, type AdminViewState } from '@/components/admin/primitives/AdminStateBoundary';
import { AdminStatusBadge, type AdminStatusTone } from '@/components/admin/primitives/AdminStatusBadge';
import { useAdminSession } from '@/components/admin/shell/AdminSessionProvider';
import type { AdminObservabilityResponse } from '@/lib/admin/contracts';
import './observability-command-center.css';

type ObservabilityView = 'aggregate' | 'diagnostics';
type AccessGateState =
  | 'idle'
  | 'ready'
  | 'loading'
  | 'disabled'
  | 'case-required'
  | 'case-closed'
  | 'grant-required'
  | 'grant-revoked'
  | 'grant-expired'
  | 'step-up-required'
  | 'step-up-expired'
  | 'access-denied'
  | 'permission-lost'
  | 'error';

interface DiagnosticEvent {
  eventRef: string;
  occurredAt: string;
  purpose: string;
  eventName: string;
  category: string;
  tool: string | null;
  action: string;
  outcome: string;
  latencyBand: string | null;
  sizeBand: string | null;
  quotaBand: string | null;
  plan: string;
  errorCode: string | null;
}

interface DiagnosticResponse {
  enabled?: boolean;
  code?: string;
  error?: string;
  caseId?: string;
  scope?: string;
  case?: {
    id?: string;
    status?: string;
  };
  grant?: {
    state?: string;
    expiresAt?: string | null;
  };
  stepUp?: {
    state?: string;
    expiresAt?: string | null;
  };
  events?: unknown;
  nextCursor?: string | null;
  truncated?: boolean;
  completeHistory?: boolean;
  limitations?: unknown;
  meta?: {
    generatedAt?: string;
    partial?: boolean;
    truncated?: boolean;
    staleAfterMs?: number;
  };
}

interface DiagnosticResource {
  payload: DiagnosticResponse | null;
  events: DiagnosticEvent[];
  state: AccessGateState;
  message: string;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  stale: boolean;
  disconnected: boolean;
  lastUpdatedAt: string | null;
  nextCursor: string | null;
}

interface DiagnosticCaseListResponse {
  enabled?: boolean;
  cases?: Array<{
    caseId?: string;
    category?: string;
    status?: string;
    grantState?: string;
    createdAt?: string;
  }>;
  truncated?: boolean;
}

interface DimensionDatum {
  key: string;
  label: string;
  value: number;
}

const SAFE_TAXONOMY_VALUE = /^[a-z][a-z0-9_]{0,31}$/;
const SAFE_OPAQUE_REFERENCE = /^[A-Za-z0-9_-]{8,160}$/;
const CASE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_TIMELINE_EVENTS = 100;

const TOOL_LABELS: Record<string, string> = {
  taco: 'Taco assistant',
  taco_chat: 'Taco assistant',
  resume_studio: 'Resume Studio',
  resume_analysis: 'Resume analysis',
  ats_analyzer: 'ATS Analyzer',
  writing_toolkit: 'Writing Toolkit',
  job_search: 'Job Search',
  applications: 'Applications',
  feedback: 'Feedback',
  support: 'Support',
};

const OUTCOME_LABELS: Record<string, string> = {
  success: 'Successful',
  degraded: 'Degraded',
  failure: 'Failed safely',
  rejected: 'Rejected',
  duplicate: 'Duplicate retry',
};

const OUTCOME_TONES: Record<string, AdminStatusTone> = {
  success: 'healthy',
  degraded: 'degraded',
  failure: 'critical',
  rejected: 'critical',
  duplicate: 'info',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeTaxonomy(value: unknown, fallback: string): string {
  return typeof value === 'string' && SAFE_TAXONOMY_VALUE.test(value)
    ? value
    : fallback;
}

function friendlyTaxonomy(value: string): string {
  return value
    .split('_')
    .map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '')
    .join(' ');
}

function labelForTool(value: string): string {
  return TOOL_LABELS[value] || friendlyTaxonomy(value);
}

function labelForOutcome(value: string): string {
  return OUTCOME_LABELS[value] || friendlyTaxonomy(value);
}

function finiteCount(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

function normalizeDimension(input: unknown, kind: 'tool' | 'outcome'): DimensionDatum[] {
  const normalized: Array<{ key: string; value: number }> = [];

  if (Array.isArray(input)) {
    for (const entry of input.slice(0, 24)) {
      if (!isRecord(entry)) continue;
      const rawKey = entry.key ?? entry.tool ?? entry.outcome ?? entry.name;
      const key = safeTaxonomy(rawKey, '');
      const value = finiteCount(entry.value ?? entry.count);
      if (key && value !== null) normalized.push({ key, value });
    }
  } else if (isRecord(input)) {
    for (const [rawKey, rawValue] of Object.entries(input).slice(0, 24)) {
      const key = safeTaxonomy(rawKey, '');
      const value = finiteCount(rawValue);
      if (key && value !== null) normalized.push({ key, value });
    }
  }

  return normalized
    .sort((left, right) => right.value - left.value || left.key.localeCompare(right.key))
    .map(item => ({
      ...item,
      label: kind === 'tool' ? labelForTool(item.key) : labelForOutcome(item.key),
    }));
}

function normalizeLimitations(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0 && item.length <= 240)
    .slice(0, 8);
}

function normalizeDiagnosticEvents(input: unknown): DiagnosticEvent[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 50).flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const occurredAt = typeof item.occurredAt === 'string' && Number.isFinite(Date.parse(item.occurredAt))
      ? item.occurredAt
      : '';
    if (!occurredAt) return [];
    return [{
      eventRef: typeof item.eventRef === 'string' && SAFE_OPAQUE_REFERENCE.test(item.eventRef)
        ? item.eventRef
        : `${occurredAt}-${index}`,
      occurredAt,
      purpose: safeTaxonomy(item.purpose, 'unknown_purpose'),
      eventName: safeTaxonomy(item.eventName, 'unknown_event'),
      category: safeTaxonomy(item.category, 'unknown_category'),
      tool: safeTaxonomy(item.tool, '') || null,
      action: safeTaxonomy(item.action, 'unknown_action'),
      outcome: safeTaxonomy(item.outcome, 'unknown_outcome'),
      latencyBand: safeTaxonomy(item.latencyBand, '') || null,
      sizeBand: safeTaxonomy(item.sizeBand, '') || null,
      quotaBand: safeTaxonomy(item.quotaBand, '') || null,
      plan: safeTaxonomy(item.plan, 'unknown_plan'),
      errorCode: safeTaxonomy(item.errorCode, '') || null,
    }];
  });
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-US').format(value)
    : 'Not available';
}

function formatDate(value: string | null | undefined, includeTime = true): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not available';
  return new Intl.DateTimeFormat('en-US', includeTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatRemaining(expiresAt: string | null | undefined, now: number): string {
  if (!expiresAt || !Number.isFinite(Date.parse(expiresAt))) return 'No active expiry';
  const milliseconds = Date.parse(expiresAt) - now;
  if (milliseconds <= 0) return 'Expired';
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes < 60) return `${minutes} min remaining`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m remaining`;
}

function statusTone(value: string | undefined): AdminStatusTone {
  if (value === 'active' || value === 'open' || value === 'ready' || value === 'verified') return 'healthy';
  if (value === 'expired' || value === 'closed' || value === 'revoked') return 'critical';
  if (value === 'required' || value === 'missing' || value === 'pending') return 'degraded';
  return 'unknown';
}

function diagnosticState(payload: DiagnosticResponse, responseStatus: number): AccessGateState {
  if (payload.enabled === false || payload.code === 'observability_disabled') return 'disabled';

  const code = payload.code?.toLowerCase() || '';
  const grant = payload.grant?.state?.toLowerCase();
  const stepUp = payload.stepUp?.state?.toLowerCase();
  const caseStatus = payload.case?.status?.toLowerCase();

  if (code === 'observability_diagnostic_access_denied') return 'access-denied';
  if (code.includes('permission') || responseStatus === 401 || (responseStatus === 403 && !grant && !stepUp)) {
    return 'permission-lost';
  }
  if (code.includes('case_required') || code.includes('case_not_found')) return 'case-required';
  if (code.includes('case_closed') || caseStatus === 'closed' || caseStatus === 'resolved') return 'case-closed';
  if (code.includes('grant_revoked') || grant === 'revoked') return 'grant-revoked';
  if (code.includes('grant_expired') || grant === 'expired') return 'grant-expired';
  if (code.includes('grant') || grant === 'missing' || grant === 'required') return 'grant-required';
  if (code.includes('step_up_expired') || stepUp === 'expired') return 'step-up-expired';
  if (code.includes('step_up') || stepUp === 'missing' || stepUp === 'required') return 'step-up-required';
  if (responseStatus >= 400) return 'error';
  return 'ready';
}

function accessMessage(state: AccessGateState, serverMessage = ''): string {
  if (serverMessage && serverMessage.length <= 240) return serverMessage;
  if (state === 'disabled') return 'User observability is disabled. No diagnostic metadata can be requested.';
  if (state === 'case-required') return 'Open a typed diagnostic support case before requesting metadata.';
  if (state === 'case-closed') return 'This case is closed. Closed cases cannot authorize new diagnostic access.';
  if (state === 'grant-required') return 'The user has not granted metadata-only diagnostic access for this case.';
  if (state === 'grant-revoked') return 'The user revoked this case-bound diagnostic grant.';
  if (state === 'grant-expired') return 'The user grant expired. Previously displayed evidence remains partial and must not be extended.';
  if (state === 'step-up-required') return 'Reauthenticate with a second factor to create a short-lived Admin step-up lease.';
  if (state === 'step-up-expired') return 'The Admin step-up lease expired. Reauthenticate before requesting another page.';
  if (state === 'access-denied') return 'The case grant, recent-MFA lease, or Admin permission is missing or expired. The server does not reveal which gate failed.';
  if (state === 'permission-lost') return 'Your Admin permission or session version no longer authorizes diagnostic metadata.';
  if (state === 'error') return 'The diagnostic authorization check could not be completed.';
  return '';
}

function mergeEvents(existing: DiagnosticEvent[], incoming: DiagnosticEvent[]): DiagnosticEvent[] {
  const unique = new Map<string, DiagnosticEvent>();
  [...existing, ...incoming].forEach(event => {
    const key = event.eventRef || [
      event.occurredAt,
      event.purpose,
      event.eventName,
      event.category,
      event.action,
      event.outcome,
      event.latencyBand,
    ].join('|');
    if (!unique.has(key)) unique.set(key, event);
  });
  return [...unique.values()]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .slice(0, MAX_TIMELINE_EVENTS);
}

function safeCaseId(value: string): string {
  const trimmed = value.trim();
  return CASE_ID.test(trimmed) ? trimmed : '';
}

function safeCursor(value: unknown): string | null {
  return typeof value === 'string' && value.length >= 8 && value.length <= 2_048
    ? value
    : null;
}

function downloadAggregate(payload: AdminObservabilityResponse) {
  const safeSnapshot = {
    exportedAt: new Date().toISOString(),
    generatedAt: payload.generatedAt || payload.meta.generatedAt,
    observationWindow: payload.observationWindow,
    observedActivity: payload.observedActivity,
    dimensions: {
      byCategory: normalizeDimension(payload.byCategory, 'tool'),
      byTool: normalizeDimension(payload.byTool, 'tool'),
      byOutcome: normalizeDimension(payload.byOutcome, 'outcome'),
    },
    completeness: payload.completeness,
    definitions: payload.definitions,
    retention: payload.retention,
    limitations: normalizeLimitations(payload.limitations),
  };
  const url = URL.createObjectURL(new Blob(
    [JSON.stringify(safeSnapshot, null, 2)],
    { type: 'application/json' },
  ));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `talent-observability-aggregate-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ObservabilityCommandCenter() {
  const {
    session,
    status: sessionStatus,
    error: sessionError,
    hasPermission,
    refresh: refreshSession,
  } = useAdminSession();
  const canReadAggregate = sessionStatus === 'ready' && hasPermission('analytics.read');
  const canReadDiagnostics = sessionStatus === 'ready' && hasPermission('diagnostics.metadata.read');
  const aggregate = useAdminResource<AdminObservabilityResponse>('/api/admin/observability', {
    enabled: canReadAggregate,
    intervalMs: 60_000,
    staleAfterMs: 150_000,
  });
  const diagnosticCases = useAdminResource<DiagnosticCaseListResponse>('/api/admin/diagnostic-cases', {
    enabled: canReadDiagnostics,
    staleAfterMs: 60_000,
  });
  const [activeView, setActiveView] = useState<ObservabilityView>('aggregate');
  const [caseDraft, setCaseDraft] = useState('');
  const [activeCaseId, setActiveCaseId] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [now, setNow] = useState(Date.now());
  const [mfaPassword, setMfaPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMessage, setMfaMessage] = useState('');
  const [stepUpExpiresAt, setStepUpExpiresAt] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResource>({
    payload: null,
    events: [],
    state: 'idle',
    message: '',
    loading: false,
    refreshing: false,
    loadingMore: false,
    stale: false,
    disconnected: false,
    lastUpdatedAt: null,
    nextCursor: null,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const initialCaseId = safeCaseId(new URL(window.location.href).searchParams.get('case') || '');
    if (initialCaseId) {
      setCaseDraft(initialCaseId);
      setActiveCaseId(initialCaseId);
      setActiveView('diagnostics');
    }
  }, []);

  const loadDiagnostic = useCallback(async (
    caseId: string,
    options: { append?: boolean; cursor?: string | null } = {},
  ) => {
    const normalizedCaseId = safeCaseId(caseId);
    if (!normalizedCaseId) {
      setDiagnostic(current => ({
        ...current,
        state: 'case-required',
        message: 'Enter the exact diagnostic support case ID. Email and user-ID lookup are intentionally unavailable.',
        loading: false,
        refreshing: false,
        loadingMore: false,
      }));
      return;
    }
    if (!navigator.onLine) {
      setDiagnostic(current => ({
        ...current,
        state: current.events.length ? current.state : 'error',
        message: 'Reconnect before requesting diagnostic authorization evidence.',
        disconnected: true,
        stale: current.events.length > 0,
        loading: false,
        refreshing: false,
        loadingMore: false,
      }));
      return;
    }

    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const append = Boolean(options.append);
    setDiagnostic(current => ({
      ...current,
      disconnected: false,
      message: '',
      loading: !append && current.events.length === 0,
      refreshing: !append && current.events.length > 0,
      loadingMore: append,
      state: current.events.length ? current.state : 'loading',
    }));

    try {
      const params = new URLSearchParams({ limit: '50' });
      if (options.cursor) params.set('cursor', options.cursor);
      const response = await authFetch(
        `/api/admin/diagnostic-cases/${encodeURIComponent(normalizedCaseId)}/activity?${params.toString()}`,
        { cache: 'no-store', signal: controller.signal },
      );
      const payload = await response.json().catch(() => ({})) as DiagnosticResponse;
      if (sequence !== requestSequence.current) return;
      const nextState = diagnosticState(payload, response.status);
      const incomingEvents = normalizeDiagnosticEvents(payload.events);
      const lastUpdatedAt = payload.meta?.generatedAt || new Date().toISOString();

      setDiagnostic(current => ({
        payload,
        events: append ? mergeEvents(current.events, incomingEvents) : incomingEvents,
        state: nextState,
        message: accessMessage(nextState, payload.error),
        loading: false,
        refreshing: false,
        loadingMore: false,
        stale: nextState !== 'ready' && (append || current.events.length > 0),
        disconnected: false,
        lastUpdatedAt,
        nextCursor: nextState === 'ready' ? safeCursor(payload.nextCursor) : null,
      }));

      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('admin-session-invalid', {
          detail: { status: response.status, message: payload.error || 'This Admin session is no longer authorized.' },
        }));
      }
    } catch (error) {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      const message = error instanceof Error ? error.message : 'Diagnostic evidence could not be loaded.';
      setDiagnostic(current => ({
        ...current,
        state: current.events.length ? current.state : 'error',
        message,
        loading: false,
        refreshing: false,
        loadingMore: false,
        stale: current.events.length > 0,
        nextCursor: null,
      }));
    }
  }, []);

  useEffect(() => () => requestController.current?.abort(), []);

  const toolMix = useMemo(
    () => normalizeDimension(aggregate.data?.byTool, 'tool'),
    [aggregate.data?.byTool],
  );
  const categoryMix = useMemo(
    () => normalizeDimension(aggregate.data?.byCategory, 'tool')
      .map(item => ({
        ...item,
        key: `category_${item.key}`,
        label: `${item.label} category`,
      })),
    [aggregate.data?.byCategory],
  );
  const activityMix = useMemo(
    () => [...toolMix, ...categoryMix]
      .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label)),
    [categoryMix, toolMix],
  );
  const outcomeMix = useMemo(
    () => normalizeDimension(aggregate.data?.byOutcome, 'outcome'),
    [aggregate.data?.byOutcome],
  );
  const limitations = useMemo(
    () => normalizeLimitations(aggregate.data?.limitations),
    [aggregate.data?.limitations],
  );
  const totalOutcomes = outcomeMix.reduce((sum, item) => sum + item.value, 0);
  const successfulEvents = outcomeMix.find(item => item.key === 'success')?.value || 0;
  const successPercent = totalOutcomes ? Math.round((successfulEvents / totalOutcomes) * 100) : 0;
  const consentCoverage = finiteCount(aggregate.data?.consentCoverage);
  const suppressedCells = finiteCount(aggregate.data?.completeness.suppressedCells) || 0;
  const observedEvents = finiteCount(aggregate.data?.observedActivity);
  const aggregateDisabled = aggregate.data?.enabled === false;
  const aggregatePartial = Boolean(
    aggregate.data?.state === 'partial'
      || aggregate.data?.meta.partial
      || aggregate.data?.meta.truncated,
  );
  const aggregateSourceStale = aggregate.data?.state === 'stale' || aggregate.stale;
  const aggregateSparse = !aggregateDisabled && Boolean(
    aggregate.data?.state === 'sparse'
      || suppressedCells > 0,
  );
  const recentDiagnosticCases = (diagnosticCases.data?.cases || [])
    .filter(item => item.status === 'open' && Boolean(safeCaseId(item.caseId || '')))
    .slice(0, 50);

  const aggregateState: AdminViewState = !canReadAggregate
    ? 'unauthorized'
    : aggregate.disconnected && !aggregate.data
      ? 'disconnected'
      : aggregate.loading
        ? 'loading'
        : aggregate.error && !aggregate.data
          ? 'error'
          : observedEvents === 0 && !aggregateDisabled && !aggregateSparse
            ? 'empty'
            : aggregate.refreshing
              ? 'refreshing'
              : aggregateSourceStale
                ? 'stale'
                : aggregatePartial
                  ? 'partial'
                  : 'ready';

  const responseAuthorized = diagnostic.state === 'ready';
  const grantState = diagnostic.payload?.grant?.state || (responseAuthorized ? 'verified' : 'not checked');
  const stepUpState = diagnostic.payload?.stepUp?.state || (responseAuthorized ? 'verified' : 'not checked');
  const caseState = diagnostic.payload?.case?.status || (responseAuthorized ? 'open' : activeCaseId ? 'not checked' : 'case required');
  const grantExpired = diagnostic.payload?.grant?.expiresAt
    ? Date.parse(diagnostic.payload.grant.expiresAt) <= now
    : false;
  const stepUpExpired = diagnostic.payload?.stepUp?.expiresAt
    ? Date.parse(diagnostic.payload.stepUp.expiresAt) <= now
    : false;
  const effectiveDiagnosticState: AccessGateState = grantExpired
    ? 'grant-expired'
    : stepUpExpired
      ? 'step-up-expired'
      : diagnostic.state;
  const filteredEvents = diagnostic.events.filter(
    event => outcomeFilter === 'all' || event.outcome === outcomeFilter,
  );

  async function createStepUpLease() {
    const response = await authFetch('/api/admin/observability-step-up', {
      method: 'POST',
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({})) as {
      expiresAt?: string;
      error?: string;
    };
    if (!response.ok || !payload.expiresAt) {
      throw new Error(payload.error || 'A recent second-factor session is required.');
    }
    setStepUpExpiresAt(payload.expiresAt);
    setMfaPassword('');
    setMfaCode('');
    setMfaResolver(null);
    setMfaMessage(`Metadata step-up is active ${formatRemaining(payload.expiresAt, Date.now())}.`);
    if (activeCaseId) await loadDiagnostic(activeCaseId);
  }

  async function submitMfaStepUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMfaBusy(true);
    setMfaMessage('');
    try {
      if (mfaResolver) {
        const result = await authHelpers.resolveTOTPReauthentication(mfaResolver, mfaCode);
        if (!result.complete) throw result.error || new Error('The authenticator code was not accepted.');
        await createStepUpLease();
        return;
      }
      if (!mfaPassword) throw new Error('Enter your Admin password to continue.');
      const result = await authHelpers.beginMFAReauthentication(mfaPassword);
      if (result.error) throw result.error;
      if (result.resolver) {
        setMfaResolver(result.resolver);
        setMfaPassword('');
        setMfaMessage('Password verified. Enter the current code from your authenticator app.');
        return;
      }
      await createStepUpLease();
    } catch (error) {
      setMfaMessage(error instanceof Error ? error.message : 'MFA verification could not be completed.');
    } finally {
      setMfaBusy(false);
    }
  }

  function submitCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = safeCaseId(caseDraft);
    setActiveCaseId(normalized);
    setOutcomeFilter('all');
    if (normalized) {
      const url = new URL(window.location.href);
      url.searchParams.set('case', normalized);
      window.history.replaceState({}, '', url);
    }
    void loadDiagnostic(normalized);
  }

  function moveViewWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, current: ObservabilityView) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home'
      ? 'aggregate'
      : event.key === 'End'
        ? 'diagnostics'
        : current === 'aggregate' ? 'diagnostics' : 'aggregate';
    setActiveView(next);
    window.requestAnimationFrame(() => {
      document.getElementById(`observability-tab-${next}`)?.focus();
    });
  }

  if (sessionStatus === 'loading') {
    return <AdminStateBoundary state="loading"><span /></AdminStateBoundary>;
  }
  if (sessionStatus === 'denied' || !session) {
    return (
      <AdminStateBoundary
        state="unauthorized"
        title="Observability access required"
        message={sessionError || 'An active Admin session is required.'}
        onRetry={() => void refreshSession()}
      >
        <span />
      </AdminStateBoundary>
    );
  }

  return (
    <div className="observability-module">
      <header className="admin-module-hero observability-hero">
        <div className="observability-hero-copy">
          <p className="admin-module-kicker">Privacy-safe product intelligence</p>
          <h1>Observability command</h1>
          <p>
            Understand adoption and reliability through suppressed aggregate evidence.
            Investigate one support case only with the user&apos;s active, metadata-only grant.
          </p>
          <div className="observability-principles" aria-label="Observability privacy boundaries">
            <span><i className="material-symbols-rounded" aria-hidden="true">visibility_off</i>No prompt or document content</span>
            <span><i className="material-symbols-rounded" aria-hidden="true">encrypted</i>Pseudonymous aggregate evidence</span>
            <span><i className="material-symbols-rounded" aria-hidden="true">timer</i>Expiring case-bound access</span>
          </div>
        </div>
        <div className="observability-hero-orbit" aria-hidden="true">
          <span className="observability-orbit-ring is-outer" />
          <span className="observability-orbit-ring is-inner" />
          <span className="observability-orbit-core material-symbols-rounded">monitoring</span>
          <span className="observability-orbit-node is-one" />
          <span className="observability-orbit-node is-two" />
          <span className="observability-orbit-node is-three" />
        </div>
      </header>

      <div className="observability-view-switcher" role="tablist" aria-label="Observability views">
        <button
          type="button"
          role="tab"
          id="observability-tab-aggregate"
          aria-controls="observability-panel-aggregate"
          aria-selected={activeView === 'aggregate'}
          tabIndex={activeView === 'aggregate' ? 0 : -1}
          className={activeView === 'aggregate' ? 'is-active' : ''}
          onClick={() => setActiveView('aggregate')}
          onKeyDown={event => moveViewWithKeyboard(event, 'aggregate')}
        >
          <span className="material-symbols-rounded" aria-hidden="true">query_stats</span>
          <span><strong>Aggregate signals</strong><small>Suppressed, identity-free evidence</small></span>
        </button>
        <button
          type="button"
          role="tab"
          id="observability-tab-diagnostics"
          aria-controls="observability-panel-diagnostics"
          aria-selected={activeView === 'diagnostics'}
          tabIndex={activeView === 'diagnostics' ? 0 : -1}
          className={activeView === 'diagnostics' ? 'is-active' : ''}
          onClick={() => setActiveView('diagnostics')}
          onKeyDown={event => moveViewWithKeyboard(event, 'diagnostics')}
        >
          <span className="material-symbols-rounded" aria-hidden="true">troubleshoot</span>
          <span><strong>Case diagnostics</strong><small>Grant-bound metadata timeline</small></span>
        </button>
      </div>

      <section
        id="observability-panel-aggregate"
        role="tabpanel"
        aria-labelledby="observability-tab-aggregate"
        hidden={activeView !== 'aggregate'}
        className="observability-tab-panel"
      >
        {aggregateDisabled ? (
          <div className="observability-disabled-state" role="status">
            <span className="material-symbols-rounded" aria-hidden="true">power_settings_new</span>
            <div>
              <strong>User observability is safely disabled</strong>
              <p>
                Ingestion, materialization, Admin reads, and diagnostic timelines remain off.
                Enabling production requires approved retention and managed HMAC secrets.
              </p>
            </div>
            <AdminStatusBadge tone="paused">Flag off</AdminStatusBadge>
          </div>
        ) : null}

        {(aggregateSourceStale || aggregate.error || aggregate.disconnected) && aggregate.data ? (
          <div className="admin-module-alert is-warning" role="status">
            {aggregate.disconnected
              ? 'Connection lost. Showing the last verified aggregate snapshot.'
              : aggregate.error || 'The aggregate snapshot is outside its freshness window.'}
          </div>
        ) : null}

        <section className="observability-metric-grid" aria-label="Observability summary">
          <AdminMetricCard
            label="Observed activity"
            value={aggregateDisabled ? 'Off' : formatNumber(aggregate.data?.observedActivity)}
            icon="timeline"
            detail="Events, not unique users"
            status={aggregateDisabled ? 'Disabled' : aggregatePartial ? 'Partial' : 'Bounded'}
            statusTone={aggregateDisabled ? 'paused' : aggregatePartial ? 'degraded' : 'info'}
            loading={aggregate.loading}
          />
          <AdminMetricCard
            label="Successful outcomes"
            value={totalOutcomes ? `${successPercent}%` : 'Not available'}
            icon="task_alt"
            detail={totalOutcomes ? `${formatNumber(successfulEvents)} observed` : 'No outcome evidence'}
            status={aggregateSparse ? 'Sparse' : 'Suppressed'}
            statusTone={aggregateSparse ? 'degraded' : 'healthy'}
            loading={aggregate.loading}
          />
          <AdminMetricCard
            label="Analytics consent"
            value={consentCoverage === null ? 'Not available' : `${consentCoverage}%`}
            icon="verified_user"
            detail="Optional analytics only"
            status="Off by default"
            statusTone="info"
            loading={aggregate.loading}
          />
          <AdminMetricCard
            label="Suppressed cells"
            value={formatNumber(suppressedCells)}
            icon="privacy_tip"
            detail="Privacy threshold applied"
            status="Privacy protected"
            statusTone="healthy"
            loading={aggregate.loading}
          />
        </section>

        <div className="observability-aggregate-grid">
          <AdminPanel
            className="observability-tool-panel"
            eyebrow="Coarse allowlisted dimensions"
            title="Tool and category mix"
            description="Only cells meeting the privacy threshold appear. Missing rows can be suppressed or unobserved."
            toolbar={(
              <AdminButton
                size="sm"
                icon="download"
                disabled={!aggregate.data || aggregateDisabled}
                onClick={() => aggregate.data && downloadAggregate(aggregate.data)}
              >
                Export aggregate
              </AdminButton>
            )}
          >
            <AdminStateBoundary
              state={aggregateDisabled ? 'empty' : aggregateState}
              title={aggregateDisabled ? 'Aggregate reads are disabled' : undefined}
              message={aggregateDisabled
                ? 'The server-controlled observability flag is off.'
                : aggregate.error || undefined}
              onRetry={() => void aggregate.refresh()}
            >
              {aggregateSparse ? (
                <div className="observability-sparse-note" role="status">
                  <span className="material-symbols-rounded" aria-hidden="true">blur_on</span>
                  <span><strong>Sparse evidence</strong> Some cells are intentionally hidden below the minimum count.</span>
                </div>
              ) : null}
              <div className="observability-bar-list">
                {activityMix.slice(0, 8).map((datum, index) => {
                  const maximum = Math.max(...activityMix.map(item => item.value), 1);
                  return (
                    <div className="observability-bar-row" key={datum.key}>
                      <span className="observability-bar-rank">{String(index + 1).padStart(2, '0')}</span>
                      <span className="observability-bar-label">{datum.label}</span>
                      <span className="observability-bar-track" aria-hidden="true">
                        <i style={{ width: `${Math.max(5, (datum.value / maximum) * 100)}%` }} />
                      </span>
                      <strong>{formatNumber(datum.value)}</strong>
                    </div>
                  );
                })}
              </div>
            </AdminStateBoundary>
          </AdminPanel>

          <AdminPanel
            className="observability-outcome-panel"
            eyebrow="Reliability evidence"
            title="Observed outcomes"
            description="Outcome mix reflects accepted metadata events only, never a complete user journey."
          >
            <AdminStateBoundary
              state={aggregateDisabled ? 'empty' : aggregateState}
              title={aggregateDisabled ? 'Outcome reads are disabled' : undefined}
              message={aggregate.error || undefined}
              onRetry={() => void aggregate.refresh()}
              compact
            >
              <div className="observability-outcome-visual">
                <div
                  className="observability-donut"
                  style={{ '--observability-success': `${successPercent * 3.6}deg` } as CSSProperties}
                  aria-label={`${successPercent}% of observed outcomes were successful`}
                  role="img"
                >
                  <span><strong>{successPercent}%</strong><small>successful</small></span>
                </div>
                <div className="observability-outcome-list">
                  {outcomeMix.slice(0, 6).map(item => (
                    <div key={item.key}>
                      <span><i className={`is-${OUTCOME_TONES[item.key] || 'unknown'}`} />{item.label}</span>
                      <strong>{formatNumber(item.value)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </AdminStateBoundary>
          </AdminPanel>
        </div>

        <div className="observability-context-grid">
          <AdminPanel
            eyebrow="Evidence window"
            title="Freshness and coverage"
            description="TTL cleanup is asynchronous; every read also filters expired metadata."
          >
            <dl className="observability-fact-list">
              <div><dt>Observation start</dt><dd>{formatDate(aggregate.data?.observationWindow.startsAt, false)}</dd></div>
              <div><dt>Observation end</dt><dd>{formatDate(aggregate.data?.observationWindow.endsAt, false)}</dd></div>
              <div><dt>Snapshot generated</dt><dd>{formatDate(aggregate.data?.generatedAt || aggregate.data?.meta.generatedAt)}</dd></div>
              <div>
                <dt>Retention</dt>
                <dd>
                  {aggregate.data?.retention.policyApproved && aggregate.data.retention.configuredDays
                    ? `${aggregate.data.retention.configuredDays} days`
                    : 'Policy not approved'}
                </dd>
              </div>
            </dl>
            <AdminFreshnessMeter
              ageSeconds={aggregate.lastUpdatedAt
                ? Math.max(0, (now - Date.parse(aggregate.lastUpdatedAt)) / 1_000)
                : null}
              freshForSeconds={(aggregate.data?.meta.staleAfterMs || 150_000) / 1_000}
              label="Aggregate age"
            />
          </AdminPanel>

          <AdminPanel
            eyebrow="Interpretation guardrails"
            title="What this view cannot tell you"
            description="Observed activity is intentionally narrower than a user history or analytics warehouse."
          >
            <ul className="observability-limitation-list">
              {(limitations.length ? limitations : [
                'Suppressed cells are neither zero nor proof of inactivity.',
                'Counts are observed events, not unique users.',
                'Prompt and document content is never present in this surface.',
              ]).map(item => (
                <li key={item}><span className="material-symbols-rounded" aria-hidden="true">shield</span>{item}</li>
              ))}
            </ul>
          </AdminPanel>
        </div>
      </section>

      <section
        id="observability-panel-diagnostics"
        role="tabpanel"
        aria-labelledby="observability-tab-diagnostics"
        hidden={activeView !== 'diagnostics'}
        className="observability-tab-panel"
      >
        <div className="observability-diagnostic-grid">
          <aside className="observability-diagnostic-controls">
            <AdminPanel
              className="observability-case-panel"
              eyebrow="Exact support case"
              title="Request a metadata timeline"
              description="Email and Firebase UID lookup are intentionally unavailable. Access is derived from one typed case."
            >
              <form className="observability-case-form" onSubmit={submitCase}>
                <div className="observability-case-picker">
                  <label htmlFor="observability-case-picker">Recent open diagnostic cases</label>
                  <select
                    id="observability-case-picker"
                    value=""
                    disabled={!canReadDiagnostics || diagnosticCases.loading || recentDiagnosticCases.length === 0}
                    onChange={event => {
                      const selectedCaseId = safeCaseId(event.target.value);
                      if (selectedCaseId) setCaseDraft(selectedCaseId);
                    }}
                  >
                    <option value="">
                      {diagnosticCases.loading
                        ? 'Loading cases…'
                        : recentDiagnosticCases.length
                          ? 'Choose a metadata-only case'
                          : 'No open cases available'}
                    </option>
                    {recentDiagnosticCases.map(item => (
                      <option key={item.caseId} value={item.caseId}>
                        {item.caseId} · {friendlyTaxonomy(item.category || 'other')} · {friendlyTaxonomy(item.grantState || 'not_granted')}
                      </option>
                    ))}
                  </select>
                  <small>
                    The picker is bounded to 50 metadata-only cases and contains no email, UID, or submitted feedback.
                  </small>
                </div>
                <label htmlFor="observability-case-id">Diagnostic support case ID</label>
                <div>
                  <input
                    id="observability-case-id"
                    value={caseDraft}
                    maxLength={128}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Paste exact case ID"
                    aria-describedby="observability-case-help"
                    onChange={event => setCaseDraft(event.target.value)}
                  />
                  <AdminButton
                    type="submit"
                    variant="primary"
                    icon="policy"
                    busy={diagnostic.loading || diagnostic.refreshing}
                    disabled={!canReadDiagnostics || !safeCaseId(caseDraft)}
                  >
                    Check access
                  </AdminButton>
                </div>
                <small id="observability-case-help">
                  The server derives the user from the case and creates an access receipt before returning metadata.
                </small>
              </form>
              {canReadDiagnostics ? (
                <form className="observability-step-up-form" onSubmit={submitMfaStepUp}>
                  <div>
                    <strong>15-minute MFA step-up</strong>
                    <small>
                      {stepUpExpiresAt && Date.parse(stepUpExpiresAt) > now
                        ? `Active ${formatRemaining(stepUpExpiresAt, now)}`
                        : mfaResolver
                          ? 'Authenticator code required'
                          : 'Password and enrolled TOTP required'}
                    </small>
                  </div>
                  {mfaResolver ? (
                    <input
                      aria-label="Authenticator code"
                      value={mfaCode}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      placeholder="6-digit code"
                      onChange={event => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                    />
                  ) : (
                    <input
                      aria-label="Admin password"
                      type="password"
                      value={mfaPassword}
                      autoComplete="current-password"
                      placeholder="Admin password"
                      onChange={event => setMfaPassword(event.target.value)}
                    />
                  )}
                  <AdminButton
                    type="submit"
                    icon="verified_user"
                    busy={mfaBusy}
                    disabled={mfaBusy || (mfaResolver ? mfaCode.length < 6 : mfaPassword.length < 1)}
                  >
                    {mfaResolver ? 'Verify authenticator' : 'Verify MFA'}
                  </AdminButton>
                  {mfaMessage ? <p role="status">{mfaMessage}</p> : null}
                </form>
              ) : null}
              {!canReadDiagnostics ? (
                <div className="observability-access-note is-critical" role="status">
                  <span className="material-symbols-rounded" aria-hidden="true">lock</span>
                  <span><strong>Diagnostic permission required</strong>Your current Admin role cannot request metadata timelines.</span>
                </div>
              ) : null}
            </AdminPanel>

            <AdminPanel
              eyebrow="Fail-closed access path"
              title="Authorization chain"
              description="Every gate is rechecked immediately before each bounded response."
            >
              <ol className="observability-gate-list">
                <li className={activeCaseId ? 'is-ready' : ''}>
                  <span className="material-symbols-rounded" aria-hidden="true">{activeCaseId ? 'check' : 'counter_1'}</span>
                  <span><strong>Typed case</strong><small>{activeCaseId ? 'Exact case selected' : 'Case required'}</small></span>
                </li>
                <li className={statusTone(caseState) === 'healthy' ? 'is-ready' : ''}>
                  <span className="material-symbols-rounded" aria-hidden="true">{statusTone(caseState) === 'healthy' ? 'check' : 'counter_2'}</span>
                  <span><strong>Open scope</strong><small>{friendlyTaxonomy(safeTaxonomy(caseState, 'not_checked'))}</small></span>
                </li>
                <li className={statusTone(grantState) === 'healthy' && !grantExpired ? 'is-ready' : ''}>
                  <span className="material-symbols-rounded" aria-hidden="true">{statusTone(grantState) === 'healthy' && !grantExpired ? 'check' : 'counter_3'}</span>
                  <span>
                    <strong>User grant</strong>
                    <small>
                      {diagnostic.payload?.grant?.expiresAt
                        ? formatRemaining(diagnostic.payload.grant.expiresAt, now)
                        : responseAuthorized ? 'Verified for last response' : 'Not verified'}
                    </small>
                  </span>
                </li>
                <li className={(statusTone(stepUpState) === 'healthy' && !stepUpExpired) || (stepUpExpiresAt ? Date.parse(stepUpExpiresAt) > now : false) ? 'is-ready' : ''}>
                  <span className="material-symbols-rounded" aria-hidden="true">{(statusTone(stepUpState) === 'healthy' && !stepUpExpired) || (stepUpExpiresAt ? Date.parse(stepUpExpiresAt) > now : false) ? 'check' : 'counter_4'}</span>
                  <span>
                    <strong>Recent MFA</strong>
                    <small>
                      {diagnostic.payload?.stepUp?.expiresAt
                        ? formatRemaining(diagnostic.payload.stepUp.expiresAt, now)
                        : stepUpExpiresAt && Date.parse(stepUpExpiresAt) > now
                          ? formatRemaining(stepUpExpiresAt, now)
                        : responseAuthorized ? 'Verified for last response' : 'Not verified'}
                    </small>
                  </span>
                </li>
                <li className={effectiveDiagnosticState === 'ready' ? 'is-ready' : ''}>
                  <span className="material-symbols-rounded" aria-hidden="true">{effectiveDiagnosticState === 'ready' ? 'check' : 'counter_5'}</span>
                  <span><strong>Access receipt</strong><small>{effectiveDiagnosticState === 'ready' ? 'Recorded before response' : 'Not recorded'}</small></span>
                </li>
              </ol>
            </AdminPanel>
          </aside>

          <AdminPanel
            className="observability-timeline-panel"
            eyebrow="Content-free, bounded evidence"
            title="Observed metadata timeline"
            description="This is partial observed metadata—not a complete user history. Prompts, responses, documents, filenames, URLs, and identity fields are excluded."
            toolbar={(
              <div className="observability-timeline-toolbar">
                <label>
                  <span className="sr-only">Filter diagnostic outcomes</span>
                  <select
                    value={outcomeFilter}
                    onChange={event => setOutcomeFilter(event.target.value)}
                    disabled={diagnostic.events.length === 0}
                  >
                    <option value="all">All outcomes</option>
                    {Array.from(new Set(diagnostic.events.map(event => event.outcome))).sort().map(outcome => (
                      <option key={outcome} value={outcome}>{labelForOutcome(outcome)}</option>
                    ))}
                  </select>
                </label>
                <AdminButton
                  size="sm"
                  icon="refresh"
                  busy={diagnostic.refreshing}
                  disabled={!activeCaseId || !canReadDiagnostics}
                  onClick={() => void loadDiagnostic(activeCaseId)}
                >
                  Recheck
                </AdminButton>
              </div>
            )}
          >
            {diagnostic.disconnected ? (
              <div className="observability-access-note is-warning" role="status">
                <span className="material-symbols-rounded" aria-hidden="true">wifi_off</span>
                <span><strong>Connection unavailable</strong>Previously verified metadata is retained on screen but marked stale.</span>
              </div>
            ) : null}
            {effectiveDiagnosticState !== 'idle'
              && effectiveDiagnosticState !== 'loading'
              && effectiveDiagnosticState !== 'ready' ? (
                <div className={`observability-access-note is-${effectiveDiagnosticState}`} role="status">
                  <span className="material-symbols-rounded" aria-hidden="true">
                    {effectiveDiagnosticState.includes('grant')
                      ? 'person_cancel'
                      : effectiveDiagnosticState.includes('step-up')
                        ? 'key'
                        : effectiveDiagnosticState === 'disabled'
                          ? 'power_settings_new'
                          : 'gpp_bad'}
                  </span>
                  <span>
                    <strong>{friendlyTaxonomy(effectiveDiagnosticState.replaceAll('-', '_'))}</strong>
                    {accessMessage(effectiveDiagnosticState, diagnostic.message)}
                  </span>
                </div>
              ) : null}
            {diagnostic.stale && diagnostic.events.length ? (
              <div className="observability-access-note is-warning" role="status">
                <span className="material-symbols-rounded" aria-hidden="true">history_toggle_off</span>
                <span><strong>Access changed during review</strong>Showing the last receipted page only. Pagination is disabled.</span>
              </div>
            ) : null}

            <AdminStateBoundary
              state={diagnostic.loading
                ? 'loading'
                : effectiveDiagnosticState === 'idle'
                  ? 'empty'
                  : diagnostic.state === 'error' && diagnostic.events.length === 0
                    ? 'error'
                    : effectiveDiagnosticState === 'ready' && diagnostic.events.length === 0
                      ? 'empty'
                      : diagnostic.payload?.meta?.partial
                        || diagnostic.payload?.meta?.truncated
                        || diagnostic.payload?.truncated
                        ? 'partial'
                        : diagnostic.stale
                          ? 'stale'
                          : diagnostic.events.length
                            ? 'ready'
                            : 'unauthorized'}
              title={effectiveDiagnosticState === 'idle'
                ? 'Select a diagnostic case'
                : effectiveDiagnosticState === 'ready' && diagnostic.events.length === 0
                  ? 'No retained metadata for this case'
                  : undefined}
              message={effectiveDiagnosticState === 'idle'
                ? 'Paste the exact typed support case ID to begin the authorization check.'
                : diagnostic.message || undefined}
              onRetry={activeCaseId && canReadDiagnostics ? () => void loadDiagnostic(activeCaseId) : undefined}
            >
              <ol className="observability-timeline" aria-label="Content-free diagnostic events">
                {filteredEvents.map((event, index) => (
                  <li key={`${event.eventRef}-${index}`}>
                    <span className={`observability-timeline-marker is-${OUTCOME_TONES[event.outcome] || 'unknown'}`}>
                      <span className="material-symbols-rounded" aria-hidden="true">
                        {event.outcome === 'success' ? 'check' : event.outcome === 'degraded' ? 'priority_high' : 'close'}
                      </span>
                    </span>
                    <article>
                      <header>
                        <span>
                          <strong>{event.tool ? labelForTool(event.tool) : friendlyTaxonomy(event.category)}</strong>
                          <small>{friendlyTaxonomy(event.eventName)} · {friendlyTaxonomy(event.action)}</small>
                        </span>
                        <AdminStatusBadge tone={OUTCOME_TONES[event.outcome] || 'unknown'}>
                          {labelForOutcome(event.outcome)}
                        </AdminStatusBadge>
                      </header>
                      <dl>
                        <div><dt>Occurred</dt><dd><time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time></dd></div>
                        <div><dt>Purpose</dt><dd>{friendlyTaxonomy(event.purpose)}</dd></div>
                        <div><dt>Latency band</dt><dd>{event.latencyBand ? friendlyTaxonomy(event.latencyBand) : 'Not recorded'}</dd></div>
                        <div>
                          <dt>{event.errorCode ? 'Error code' : 'Size band'}</dt>
                          <dd>{friendlyTaxonomy(event.errorCode || event.sizeBand || 'not_recorded')}</dd>
                        </div>
                        <div><dt>Quota band</dt><dd>{event.quotaBand ? friendlyTaxonomy(event.quotaBand) : 'Not recorded'}</dd></div>
                        <div><dt>Plan snapshot</dt><dd>{friendlyTaxonomy(event.plan)}</dd></div>
                      </dl>
                    </article>
                  </li>
                ))}
              </ol>
              {filteredEvents.length === 0 && diagnostic.events.length > 0 ? (
                <p className="observability-filter-empty" role="status">No retained events match this outcome filter.</p>
              ) : null}
              <footer className="observability-timeline-footer">
                <span>
                  Showing {filteredEvents.length} of {diagnostic.events.length} bounded events
                  {diagnostic.lastUpdatedAt ? ` · receipted ${formatDate(diagnostic.lastUpdatedAt)}` : ''}
                </span>
                <AdminButton
                  size="sm"
                  trailingIcon="expand_more"
                  busy={diagnostic.loadingMore}
                  disabled={!diagnostic.nextCursor || effectiveDiagnosticState !== 'ready' || diagnostic.events.length >= MAX_TIMELINE_EVENTS}
                  onClick={() => void loadDiagnostic(activeCaseId, {
                    append: true,
                    cursor: diagnostic.nextCursor,
                  })}
                >
                  {diagnostic.events.length >= MAX_TIMELINE_EVENTS ? 'Bounded limit reached' : 'Load next page'}
                </AdminButton>
              </footer>
            </AdminStateBoundary>
          </AdminPanel>
        </div>
      </section>
    </div>
  );
}
