'use client';

export interface EmptyStateProps {
  message?: string;
  reason?: string;
  height?: number;
  className?: string;
}

/**
 * Faded chart skeleton for empty data. Never return null from a chart — use this instead.
 */
export function EmptyState({
  message = 'No data available',
  reason,
  height = 280,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] ${className}`}
      style={{ height }}
      role="img"
      aria-label={reason ? `${message}. ${reason}` : message}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm text-[var(--text-muted)]">{message}</span>
        {reason && (
          <span className="text-xs text-[var(--text-muted)] opacity-80">
            {reason}
          </span>
        )}
      </div>
    </div>
  );
}
