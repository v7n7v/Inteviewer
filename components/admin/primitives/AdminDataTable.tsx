import type { Key, ReactNode } from 'react';

export interface AdminDataColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface AdminDataTableProps<Row> {
  columns: readonly AdminDataColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => Key;
  caption: string;
  emptyMessage?: string;
  onRowActivate?: (row: Row) => void;
  rowLabel?: (row: Row) => string;
  className?: string;
}

export function AdminDataTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  emptyMessage = 'No records returned.',
  onRowActivate,
  rowLabel,
  className = '',
}: AdminDataTableProps<Row>) {
  if (!rows.length) {
    return (
      <div className={`admin-table-empty ${className}`} role="status">
        <span className="material-symbols-rounded" aria-hidden="true">table_rows</span>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className={`admin-table-scroll ${className}`}>
      <table className="admin-data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                scope="col"
                className={`is-${column.align || 'left'} ${column.className || ''}`}
              >
                {column.header}
              </th>
            ))}
            {onRowActivate ? <th scope="col" className="is-right">Details</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const interactive = Boolean(onRowActivate);
            return (
              <tr
                key={rowKey(row)}
                className={interactive ? 'is-interactive' : undefined}
                onClick={interactive ? event => {
                  if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
                  onRowActivate?.(row);
                } : undefined}
              >
                {columns.map(column => (
                  <td
                    key={column.key}
                    className={`is-${column.align || 'left'} ${column.className || ''}`}
                    data-label={typeof column.header === 'string' ? column.header : undefined}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {interactive ? (
                  <td className="is-right" data-label="Details">
                    <button
                      type="button"
                      className="admin-table-row-action"
                      onClick={() => onRowActivate?.(row)}
                      aria-label={rowLabel ? rowLabel(row) : 'Open row details'}
                    >
                      <span>Open</span>
                      <span className="material-symbols-rounded" aria-hidden="true">chevron_right</span>
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
