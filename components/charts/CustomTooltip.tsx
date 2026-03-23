'use client';

import { formatCurrency, formatPercent } from '@/lib/utils/formatters';

export interface RevenueCompositePayload {
  date?: string;
  revenue?: number;
  cost?: number;
  covers?: number;
  grossMarginPct?: number;
  revenueRolling7?: number;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: RevenueCompositePayload }[];
  label?: string;
}

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const p = payload[0].payload;
  return (
    <div
      className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 shadow-lg"
      style={{ minWidth: '160px' }}
    >
      <div className="text-xs font-medium text-[var(--text-muted)]">{label}</div>
      {p.revenue != null && (
        <div className="mt-1 text-sm text-[var(--text-primary)]">
          Revenue: {formatCurrency(p.revenue)}
        </div>
      )}
      {p.cost != null && (
        <div className="text-sm text-[var(--text-secondary)]">
          Cost: {formatCurrency(p.cost)}
        </div>
      )}
      {p.covers != null && (
        <div className="text-sm text-[var(--text-secondary)]">
          Covers: {p.covers}
        </div>
      )}
      {p.grossMarginPct != null && (
        <div className="text-sm text-[var(--green)]">
          Gross margin: {formatPercent(p.grossMarginPct)}
        </div>
      )}
    </div>
  );
}

export interface ScatterTooltipPayload {
  name: string;
  covers: number;
  marginPct: number;
  revenue: number;
  quadrant: string;
}

export function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ScatterTooltipPayload }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 shadow-lg"
      style={{ minWidth: '180px' }}
    >
      <div className="text-xs font-semibold text-[var(--text-primary)]">{p.name}</div>
      <div className="mt-1 text-sm text-[var(--text-secondary)]">
        Covers: {p.covers} · Margin: {formatPercent(p.marginPct)}
      </div>
      <div className="text-sm text-[var(--text-secondary)]">
        Revenue: {formatCurrency(p.revenue)}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {p.quadrant}
      </div>
    </div>
  );
}
