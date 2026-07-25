import type { ReactNode } from 'react';
import { AdminButton } from './AdminButton';

export type AdminViewState =
  | 'ready'
  | 'loading'
  | 'refreshing'
  | 'empty'
  | 'partial'
  | 'stale'
  | 'disconnected'
  | 'unauthorized'
  | 'mutation-pending'
  | 'success'
  | 'mutation-failure'
  | 'error';

interface AdminStateBoundaryProps {
  state: AdminViewState;
  children: ReactNode;
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

const DEFAULT_CONTENT: Record<Exclude<AdminViewState, 'ready' | 'loading' | 'refreshing' | 'partial' | 'stale'>, {
  icon: string;
  title: string;
  message: string;
}> = {
  empty: {
    icon: 'inbox',
    title: 'No evidence returned',
    message: 'There is no verified evidence for this view yet.',
  },
  error: {
    icon: 'cloud_off',
    title: 'Evidence is unavailable',
    message: 'The last request failed. Existing verified evidence has not been replaced.',
  },
  unauthorized: {
    icon: 'lock',
    title: 'Permission required',
    message: 'Your current Admin role cannot open this evidence.',
  },
  disconnected: {
    icon: 'wifi_off',
    title: 'Connection unavailable',
    message: 'Reconnect to request current evidence. Previously verified evidence has not been replaced.',
  },
  'mutation-pending': {
    icon: 'progress_activity',
    title: 'Applying guarded change',
    message: 'Keep this view open while the authoritative result and audit receipt are recorded.',
  },
  success: {
    icon: 'task_alt',
    title: 'Change verified',
    message: 'The authoritative result was refreshed and its audit receipt was recorded.',
  },
  'mutation-failure': {
    icon: 'error',
    title: 'Change was not applied',
    message: 'The guarded mutation failed. Refresh authoritative evidence before trying again.',
  },
};

export function AdminStateBoundary({
  state,
  children,
  title,
  message,
  onRetry,
  compact = false,
}: AdminStateBoundaryProps) {
  if (state === 'ready') return <>{children}</>;

  if (state === 'refreshing' || state === 'partial' || state === 'stale') {
    const copy = state === 'refreshing'
      ? 'Refreshing verified evidence'
      : state === 'partial'
        ? 'This bounded view contains partial evidence'
        : 'Showing the last verified evidence';
    return (
      <div className={`admin-state-content is-${state}`} aria-busy={state === 'refreshing' || undefined}>
        <div className="admin-inline-state" role="status">
          <span className="material-symbols-rounded" aria-hidden="true">
            {state === 'refreshing' ? 'progress_activity' : state === 'partial' ? 'data_alert' : 'history_toggle_off'}
          </span>
          <span>{title || copy}</span>
        </div>
        {children}
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className={`admin-state admin-state-loading${compact ? ' is-compact' : ''}`} aria-busy="true" aria-label="Loading Admin evidence">
        <span className="admin-skeleton admin-skeleton-heading" />
        <span className="admin-skeleton admin-skeleton-row" />
        <span className="admin-skeleton admin-skeleton-row" />
        {!compact ? <span className="admin-skeleton admin-skeleton-row is-short" /> : null}
      </div>
    );
  }

  const content = DEFAULT_CONTENT[state];
  return (
    <div className={`admin-state is-${state}${compact ? ' is-compact' : ''}`} role={state === 'error' ? 'alert' : 'status'}>
      <span className="material-symbols-rounded admin-state-icon" aria-hidden="true">{content.icon}</span>
      <div className="admin-state-copy">
        <strong>{title || content.title}</strong>
        <p>{message || content.message}</p>
      </div>
      {onRetry ? <AdminButton icon="refresh" size="sm" onClick={onRetry}>Try again</AdminButton> : null}
    </div>
  );
}
