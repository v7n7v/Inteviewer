import type { ReactNode } from 'react';

interface AdminFilterBarProps {
  children?: ReactNode;
  actions?: ReactNode;
  searchValue?: string;
  searchPlaceholder?: string;
  searchLabel?: string;
  onSearchChange?: (value: string) => void;
  className?: string;
}

export function AdminFilterBar({
  children,
  actions,
  searchValue,
  searchPlaceholder = 'Filter evidence…',
  searchLabel = 'Filter Admin evidence',
  onSearchChange,
  className = '',
}: AdminFilterBarProps) {
  return (
    <div className={`admin-filter-bar ${className}`}>
      <div className="admin-filter-controls">
        {onSearchChange ? (
          <label className="admin-filter-search">
            <span className="sr-only">{searchLabel}</span>
            <span className="material-symbols-rounded" aria-hidden="true">search</span>
            <input
              type="search"
              value={searchValue}
              onChange={event => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </label>
        ) : null}
        {children}
      </div>
      {actions ? <div className="admin-filter-actions">{actions}</div> : null}
    </div>
  );
}
