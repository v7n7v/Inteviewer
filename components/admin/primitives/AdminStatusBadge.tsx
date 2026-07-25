import type { ReactNode } from 'react';

export type AdminStatusTone =
  | 'healthy'
  | 'degraded'
  | 'critical'
  | 'info'
  | 'pending'
  | 'paused'
  | 'unknown';

interface AdminStatusBadgeProps {
  children: ReactNode;
  tone?: AdminStatusTone;
  live?: boolean;
  announce?: boolean;
  className?: string;
}

export function AdminStatusBadge({
  children,
  tone = 'unknown',
  live = false,
  announce = false,
  className = '',
}: AdminStatusBadgeProps) {
  return (
    <span className={`admin-status-badge is-${tone} ${className}`} role={announce ? 'status' : undefined}>
      <span className={`admin-status-dot${live ? ' is-live' : ''}`} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
