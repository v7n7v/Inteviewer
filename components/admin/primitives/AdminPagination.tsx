import { AdminButton } from './AdminButton';

interface AdminPaginationProps {
  page: number;
  pageCount: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function AdminPagination({
  page,
  pageCount,
  itemLabel = 'results',
  onPageChange,
  disabled = false,
}: AdminPaginationProps) {
  const safePageCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(page, 1), safePageCount);

  return (
    <nav className="admin-pagination" aria-label={`${itemLabel} pagination`}>
      <AdminButton
        icon="chevron_left"
        size="sm"
        variant="ghost"
        disabled={disabled || safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
      >
        Previous
      </AdminButton>
      <span aria-live="polite">
        Page <strong>{safePage}</strong> of <strong>{safePageCount}</strong>
      </span>
      <AdminButton
        trailingIcon="chevron_right"
        size="sm"
        variant="ghost"
        disabled={disabled || safePage >= safePageCount}
        onClick={() => onPageChange(safePage + 1)}
      >
        Next
      </AdminButton>
    </nav>
  );
}
