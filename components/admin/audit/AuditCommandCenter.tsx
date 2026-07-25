'use client';

import { useMemo, useState } from 'react';
import { useAdminResource } from '@/hooks/useAdminResource';
import { useAdminSession } from '@/components/admin/shell/AdminSessionProvider';
import { AdminButton } from '@/components/admin/primitives/AdminButton';
import { AdminDataTable, type AdminDataColumn } from '@/components/admin/primitives/AdminDataTable';
import { AdminDetailDrawer } from '@/components/admin/primitives/AdminDetailDrawer';
import { AdminFilterBar } from '@/components/admin/primitives/AdminFilterBar';
import { AdminMetricCard } from '@/components/admin/primitives/AdminMetricCard';
import { AdminPanel } from '@/components/admin/primitives/AdminPanel';
import { AdminStateBoundary } from '@/components/admin/primitives/AdminStateBoundary';
import { AdminStatusBadge } from '@/components/admin/primitives/AdminStatusBadge';
import './audit-command-center.css';

interface AuditEntry {
  id: string;
  action: string;
  actorRole: string;
  targetScope?: 'support_case' | 'account' | 'platform' | 'unknown';
  occurredAt: string;
  metadata: Record<string, string | number | boolean | null>;
}

interface AuditResponse {
  audit: AuditEntry[];
  nextCursor: string | null;
  meta: {
    generatedAt: string;
    staleAfterMs: number;
    partial: boolean;
    truncated: boolean;
  };
}

const SAFE_METADATA_KEYS = new Set([
  'reason',
  'provider',
  'recipientScope',
  'verificationPending',
  'previousVersion',
  'nextVersion',
  'active',
  'duplicate',
  'caseType',
  'fromStatus',
  'toStatus',
  'evidenceFreshUntil',
  'expectedVersion',
  'writePerformed',
]);

function formatDate(value: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unknown time';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function actionLabel(action: string) {
  return action
    .split('.')
    .map(part => part.replaceAll('_', ' '))
    .join(' · ');
}

function actionIcon(action: string) {
  if (action.includes('email')) return 'mail';
  if (action.includes('billing') || action.includes('stripe')) return 'paid';
  if (action.includes('settings') || action.includes('promotion')) return 'tune';
  if (action.includes('access') || action.includes('admin')) return 'shield_person';
  if (action.includes('support')) return 'support_agent';
  return 'history';
}

function safeMetadata(metadata: AuditEntry['metadata']) {
  return Object.entries(metadata)
    .filter(([key]) => SAFE_METADATA_KEYS.has(key))
    .slice(0, 12);
}

function targetScope(entry: AuditEntry) {
  if (entry.targetScope === 'support_case') return 'Support case';
  if (entry.targetScope === 'account') return 'Account';
  if (entry.targetScope === 'platform') return 'Platform';
  return 'Redacted target';
}

function csvCell(value: unknown) {
  const raw = String(value ?? '');
  const formulaSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${formulaSafe.replaceAll('"', '""')}"`;
}

function exportSafePage(entries: AuditEntry[]) {
  const rows = [
    ['occurredAt', 'action', 'actorRole', 'targetScope'],
    ...entries.map(entry => [
      entry.occurredAt,
      entry.action,
      entry.actorRole,
      targetScope(entry),
    ]),
  ];
  const url = URL.createObjectURL(new Blob(
    [rows.map(row => row.map(csvCell).join(',')).join('\r\n')],
    { type: 'text/csv;charset=utf-8' },
  ));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `talent-admin-audit-safe-page-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AuditCommandCenter() {
  const {
    session,
    status: sessionStatus,
    error: sessionError,
    hasPermission,
    refresh: refreshSession,
  } = useAdminSession();
  const canRead = sessionStatus === 'ready' && hasPermission('admin.audit.read');
  const [actionFilter, setActionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const params = new URLSearchParams({ limit: '75' });
  if (cursor) params.set('cursor', cursor);
  if (actionFilter.trim()) params.set('action', actionFilter.trim());
  if (roleFilter) params.set('role', roleFilter);
  const resource = useAdminResource<AuditResponse>(`/api/admin/audit?${params.toString()}`, {
    enabled: canRead,
    intervalMs: null,
    staleAfterMs: 120_000,
  });

  const visibleEntries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return resource.data?.audit || [];
    return (resource.data?.audit || []).filter(entry => (
      entry.action.toLowerCase().includes(needle)
      || entry.actorRole.toLowerCase().includes(needle)
      || targetScope(entry).toLowerCase().includes(needle)
    ));
  }, [resource.data?.audit, search]);
  const actionOptions = useMemo(
    () => [...new Set((resource.data?.audit || []).map(entry => entry.action))].sort(),
    [resource.data?.audit],
  );
  const roleOptions = useMemo(
    () => [...new Set((resource.data?.audit || []).map(entry => entry.actorRole))].sort(),
    [resource.data?.audit],
  );
  const currentPage = cursorHistory.length + 1;
  const safeMetadataEntries = selected ? safeMetadata(selected.metadata) : [];

  const columns: readonly AdminDataColumn<AuditEntry>[] = [
    {
      key: 'time',
      header: 'Timestamp',
      render: entry => (
        <span className="audit-time-cell">
          <strong>{formatDate(entry.occurredAt)}</strong>
          <small>Immutable server time</small>
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: entry => (
        <span className="audit-action-cell">
          <span className="material-symbols-rounded" aria-hidden="true">{actionIcon(entry.action)}</span>
          <span>
            <strong>{actionLabel(entry.action)}</strong>
            <small>{entry.action}</small>
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Actor boundary',
      render: entry => <AdminStatusBadge tone="info">{entry.actorRole.replaceAll('_', ' ')}</AdminStatusBadge>,
    },
    {
      key: 'scope',
      header: 'Target scope',
      render: entry => targetScope(entry),
    },
    {
      key: 'evidence',
      header: 'Metadata',
      align: 'right',
      render: entry => {
        const count = safeMetadata(entry.metadata).length;
        return <span className="audit-metadata-count">{count ? `${count} safe fields` : 'No public fields'}</span>;
      },
    },
  ];

  function resetPagination() {
    setCursor(null);
    setCursorHistory([]);
  }

  if (sessionStatus === 'loading') {
    return <AdminStateBoundary state="loading"><span /></AdminStateBoundary>;
  }
  if (sessionStatus === 'denied' || !session) {
    return (
      <AdminStateBoundary
        state="unauthorized"
        title="Audit access required"
        message={sessionError || 'An active Admin session is required.'}
        onRetry={() => void refreshSession()}
      >
        <span />
      </AdminStateBoundary>
    );
  }

  const state = !canRead
    ? 'unauthorized'
    : resource.loading
      ? 'loading'
      : resource.error && !resource.data
        ? 'error'
        : visibleEntries.length
          ? 'ready'
          : 'empty';

  return (
    <div className="audit-module">
      <header className="admin-module-hero audit-hero">
        <div>
          <p className="admin-module-kicker">Append-only operator history</p>
          <h1>Administrative audit</h1>
          <p>
            Inspect bounded, server-written actions with privacy-safe actor and target scopes.
            Direct identifiers stay out of the operational view and export.
          </p>
        </div>
        <div className="audit-hero-actions">
          <AdminStatusBadge tone={resource.data?.meta.truncated ? 'degraded' : 'healthy'}>
            {resource.data?.meta.truncated ? 'More evidence available' : 'Bounded page'}
          </AdminStatusBadge>
          <AdminButton
            icon="download"
            variant="ghost"
            disabled={!visibleEntries.length}
            onClick={() => exportSafePage(visibleEntries)}
          >
            Export safe page
          </AdminButton>
          <AdminButton icon="refresh" busy={resource.refreshing} onClick={() => void resource.refresh()}>
            Refresh
          </AdminButton>
        </div>
      </header>

      {resource.stale && resource.data ? (
        <div className="admin-module-alert is-warning" role="status">
          Showing the last verified audit page. Refresh before relying on it for an incident review.
        </div>
      ) : null}

      <section className="audit-metric-grid" aria-label="Audit evidence summary">
        <AdminMetricCard
          label="Records on page"
          value={resource.data?.audit.length ?? '—'}
          icon="receipt_long"
          detail="Bounded to 75 server records"
          status={`Page ${currentPage}`}
          statusTone="info"
          loading={resource.loading}
        />
        <AdminMetricCard
          label="Visible after filter"
          value={visibleEntries.length}
          icon="filter_alt"
          detail="Client privacy-safe view"
          status={resource.data?.meta.partial ? 'Server filter active' : 'Full page'}
          statusTone={resource.data?.meta.partial ? 'degraded' : 'healthy'}
          loading={resource.loading}
        />
        <AdminMetricCard
          label="Actor roles"
          value={roleOptions.length}
          icon="shield_person"
          detail="Role label only"
          status="No identity export"
          statusTone="paused"
          loading={resource.loading}
        />
        <AdminMetricCard
          label="Continuation"
          value={resource.data?.nextCursor ? 'Available' : 'End'}
          icon="more_horiz"
          detail="Opaque bounded cursor"
          status={resource.data?.nextCursor ? 'More history' : 'Current boundary'}
          statusTone="info"
          loading={resource.loading}
        />
      </section>

      <AdminPanel
        className="audit-log-panel"
        eyebrow="Bounded evidence ledger"
        title="Administrative events"
        description="Filters are exact on the server; local search never includes email addresses or UIDs."
      >
        <AdminFilterBar
          searchValue={search}
          searchPlaceholder="Search action, role, or target scope…"
          searchLabel="Search privacy-safe audit fields"
          onSearchChange={setSearch}
          actions={(
            <AdminButton
              size="sm"
              variant="ghost"
              icon="filter_alt_off"
              onClick={() => {
                setSearch('');
                setActionFilter('');
                setRoleFilter('');
                resetPagination();
              }}
            >
              Clear filters
            </AdminButton>
          )}
        >
          <label className="audit-filter-select">
            <span className="sr-only">Filter by exact action</span>
            <select
              value={actionFilter}
              onChange={event => {
                setActionFilter(event.target.value);
                resetPagination();
              }}
            >
              <option value="">All actions on page</option>
              {actionOptions.map(action => <option key={action} value={action}>{actionLabel(action)}</option>)}
            </select>
          </label>
          <label className="audit-filter-select">
            <span className="sr-only">Filter by actor role</span>
            <select
              value={roleFilter}
              onChange={event => {
                setRoleFilter(event.target.value);
                resetPagination();
              }}
            >
              <option value="">All actor roles</option>
              {roleOptions.map(role => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
        </AdminFilterBar>

        <AdminStateBoundary
          state={state}
          message={resource.error || undefined}
          onRetry={() => void resource.refresh()}
        >
          <div className="audit-desktop-table">
            <AdminDataTable
              columns={columns}
              rows={visibleEntries}
              rowKey={entry => entry.id}
              caption="Privacy-safe administrative audit events"
              onRowActivate={setSelected}
              rowLabel={entry => `Open ${actionLabel(entry.action)} audit evidence`}
            />
          </div>
        </AdminStateBoundary>

        <div className="audit-pagination">
          <AdminButton
            icon="chevron_left"
            size="sm"
            variant="ghost"
            disabled={!cursorHistory.length || resource.loading}
            onClick={() => {
              const previous = [...cursorHistory];
              const priorCursor = previous.pop() ?? null;
              setCursorHistory(previous);
              setCursor(priorCursor);
            }}
          >
            Newer
          </AdminButton>
          <span aria-live="polite">Bounded page <strong>{currentPage}</strong></span>
          <AdminButton
            trailingIcon="chevron_right"
            size="sm"
            variant="ghost"
            disabled={!resource.data?.nextCursor || resource.loading}
            onClick={() => {
              if (!resource.data?.nextCursor) return;
              setCursorHistory(history => [...history, cursor]);
              setCursor(resource.data?.nextCursor || null);
            }}
          >
            Older
          </AdminButton>
        </div>
      </AdminPanel>

      <AdminPanel
        className="audit-privacy-panel"
        eyebrow="Privacy boundary"
        title="What this console deliberately omits"
      >
        <div className="audit-privacy-grid">
          <span><span className="material-symbols-rounded" aria-hidden="true">alternate_email</span><strong>Direct emails</strong><small>Actor and target emails are not rendered or exported.</small></span>
          <span><span className="material-symbols-rounded" aria-hidden="true">fingerprint</span><strong>Account identifiers</strong><small>UIDs and provider customer identifiers remain hidden.</small></span>
          <span><span className="material-symbols-rounded" aria-hidden="true">description</span><strong>User content</strong><small>Resume, message, and raw payload fields are never shown.</small></span>
          <span><span className="material-symbols-rounded" aria-hidden="true">table_view</span><strong>Formula injection</strong><small>The safe page export prefixes spreadsheet formulas.</small></span>
        </div>
      </AdminPanel>

      <AdminDetailDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? actionLabel(selected.action) : 'Audit evidence'}
        description="Privacy-safe event details from the server-written administrative ledger."
      >
        {selected ? (
          <div className="audit-detail">
            <div className="audit-detail-heading">
              <span className="material-symbols-rounded" aria-hidden="true">{actionIcon(selected.action)}</span>
              <div>
                <strong>{selected.action}</strong>
                <small>{formatDate(selected.occurredAt)}</small>
              </div>
            </div>
            <dl>
              <div><dt>Actor boundary</dt><dd>{selected.actorRole.replaceAll('_', ' ')}</dd></div>
              <div><dt>Target scope</dt><dd>{targetScope(selected)}</dd></div>
              <div><dt>Evidence record</dt><dd>Immutable server event</dd></div>
              <div><dt>Direct identifiers</dt><dd>Redacted from view</dd></div>
            </dl>
            <section>
              <h3>Allowlisted metadata</h3>
              {safeMetadataEntries.length ? (
                <dl>
                  {safeMetadataEntries.map(([key, value]) => (
                    <div key={key}>
                      <dt>{key.replaceAll('_', ' ')}</dt>
                      <dd>{String(value ?? 'null')}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>No privacy-safe metadata fields were returned for this event.</p>
              )}
            </section>
          </div>
        ) : null}
      </AdminDetailDrawer>
    </div>
  );
}
