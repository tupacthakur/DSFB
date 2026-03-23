'use client';

import type { Severity } from '@/lib/utils/colors';
import { SEV_COLOR } from '@/lib/utils/colors';
import { Sparkline } from '@/components/ui/Sparkline';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils/cn';

export interface MetricCardProps {
  label: string;
  value: number | string;
  unit: string;
  deltaPct: number | null;
  /** 'good' = positive delta is good (e.g. revenue), 'bad' = positive delta is bad (e.g. cost) */
  deltaVariant?: 'good' | 'bad';
  severity: Severity;
  sparklineData: number[];
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  deltaPct,
  deltaVariant = 'good',
  severity,
  sparklineData,
  className,
}: MetricCardProps) {
  const deltaGood = deltaVariant === 'good' ? (deltaPct ?? 0) >= 0 : (deltaPct ?? 0) <= 0;
  const color = SEV_COLOR[severity];
  const borderStyle =
    color === 'var(--green)'
      ? { borderColor: 'rgba(99,215,146,0.3)' }
      : color === 'var(--amber)'
        ? { borderColor: 'rgba(251,191,36,0.3)' }
        : { borderColor: 'rgba(248,113,113,0.3)' };

  return (
    <div
      className={cn(
        'rounded-lg border bg-[var(--bg-surface)] p-3 transition-all duration-200',
        'hover:translate-y-[-2px]',
        className
      )}
      style={{
        ...borderStyle,
        borderWidth: '1px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor =
          severity === 'good'
            ? 'rgba(99,215,146,0.5)'
            : severity === 'warn'
              ? 'rgba(251,191,36,0.5)'
              : 'rgba(248,113,113,0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor =
          severity === 'good'
            ? 'rgba(99,215,146,0.3)'
            : severity === 'warn'
              ? 'rgba(251,191,36,0.3)'
              : 'rgba(248,113,113,0.3)';
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            severity === 'good' && 'animate-pulse',
            severity === 'crit' && 'animate-pulse'
          )}
          style={{ backgroundColor: color }}
          aria-hidden
        />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-semibold text-[var(--text-primary)]">
          {typeof value === 'number' ? value.toFixed(value < 10 ? 1 : 0) : value}
        </span>
        {unit && (
          <span className="text-xs text-[var(--text-muted)]">{unit}</span>
        )}
      </div>
      {deltaPct != null && Number.isFinite(deltaPct) && (
        <div className="mt-1">
          <Badge variant={deltaGood ? 'green' : 'red'}>
            {(deltaPct >= 0 ? '↑' : '↓')} {Math.abs(deltaPct).toFixed(1)}%
          </Badge>
        </div>
      )}
      <div className="mt-2 h-7 w-full">
        <Sparkline data={sparklineData} color={color} height={28} />
      </div>
    </div>
  );
}
