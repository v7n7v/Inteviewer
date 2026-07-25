interface AdminFreshnessMeterProps {
  ageSeconds: number | null;
  freshForSeconds: number;
  label?: string;
  className?: string;
}

function formatAge(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return 'Unknown';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

export function AdminFreshnessMeter({
  ageSeconds,
  freshForSeconds,
  label = 'Evidence freshness',
  className = '',
}: AdminFreshnessMeterProps) {
  const safeFreshFor = Math.max(freshForSeconds, 1);
  const age = ageSeconds === null ? safeFreshFor : Math.max(ageSeconds, 0);
  const remainingPercent = ageSeconds === null
    ? 0
    : Math.max(0, Math.min(100, 100 - (age / safeFreshFor) * 100));
  const stale = ageSeconds === null || age > safeFreshFor;

  return (
    <div className={`admin-freshness ${stale ? 'is-stale' : ''} ${className}`}>
      <div className="admin-freshness-copy">
        <span>{label}</span>
        <strong>{formatAge(ageSeconds)}</strong>
      </div>
      <progress
        className="admin-freshness-progress"
        max={100}
        value={remainingPercent}
        aria-label={`${label}: ${formatAge(ageSeconds)} old`}
      />
    </div>
  );
}
