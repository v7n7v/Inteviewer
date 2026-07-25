import type { ReactNode } from 'react';
import { AdminStatusBadge, type AdminStatusTone } from './AdminStatusBadge';

interface AdminMetricCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: string;
  change?: ReactNode;
  changeTone?: 'positive' | 'negative' | 'neutral' | 'warning';
  detail?: ReactNode;
  status?: ReactNode;
  statusTone?: AdminStatusTone;
  visual?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function AdminMetricCard({
  label,
  value,
  icon,
  change,
  changeTone = 'neutral',
  detail,
  status,
  statusTone = 'unknown',
  visual,
  loading = false,
  className = '',
}: AdminMetricCardProps) {
  if (loading) {
    return (
      <article className={`admin-metric-card is-loading ${className}`} aria-busy="true" aria-label="Loading metric">
        <span className="admin-skeleton admin-skeleton-label" />
        <span className="admin-skeleton admin-skeleton-value" />
        <span className="admin-skeleton admin-skeleton-detail" />
      </article>
    );
  }

  return (
    <article className={`admin-metric-card ${className}`}>
      <div className="admin-metric-label-row">
        <span className="admin-metric-label">{label}</span>
        {icon ? <span className="material-symbols-rounded admin-metric-icon" aria-hidden="true">{icon}</span> : null}
      </div>
      <div className="admin-metric-primary">
        <strong className="admin-metric-value">{value}</strong>
        {visual ? <div className="admin-metric-visual" aria-hidden="true">{visual}</div> : null}
      </div>
      <div className="admin-metric-detail-row">
        {change ? <span className={`admin-metric-change is-${changeTone}`}>{change}</span> : null}
        {detail ? <span className="admin-metric-detail">{detail}</span> : null}
        {status ? <AdminStatusBadge tone={statusTone}>{status}</AdminStatusBadge> : null}
      </div>
    </article>
  );
}
