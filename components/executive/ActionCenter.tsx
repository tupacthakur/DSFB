'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { formatPercent } from '@/lib/utils/formatters';

interface ActionSignal {
  id: string;
  title: string;
  severity: 'high' | 'medium';
  detail: string;
}

export function ActionCenter() {
  const daily = useMetricsStore((s) => s.daily);
  const metrics = useMetricsStore((s) => s.metrics);
  const [flagged, setFlagged] = useState<string[]>([]);

  const signals = useMemo<ActionSignal[]>(() => {
    if (daily.length < 3) {
      return [
        {
          id: 'insufficient_data',
          title: 'Need more data points',
          severity: 'medium',
          detail: 'Upload additional days to activate anomaly and trend action detection.',
        },
      ];
    }

    const last = daily[daily.length - 1];
    const prev = daily[daily.length - 2];
    const prev7 = daily.slice(-8, -1);
    const avg7Revenue =
      prev7.length > 0 ? prev7.reduce((s, d) => s + d.revenue, 0) / prev7.length : prev.revenue;
    const avg7CostPct =
      prev7.length > 0
        ? (prev7.reduce((s, d) => s + (d.revenue > 0 ? d.cost / d.revenue : 0), 0) / prev7.length) * 100
        : metrics.food_cost;
    const avgCheckNow = last.covers > 0 ? last.revenue / last.covers : metrics.avg_check;
    const avgCheckPrev = prev.covers > 0 ? prev.revenue / prev.covers : avgCheckNow;
    const revenueShockPct = avg7Revenue > 0 ? ((last.revenue - avg7Revenue) / avg7Revenue) * 100 : 0;
    const costPctNow = last.revenue > 0 ? (last.cost / last.revenue) * 100 : 0;
    const costJumpPct = costPctNow - avg7CostPct;
    const avgCheckShiftPct = avgCheckPrev > 0 ? ((avgCheckNow - avgCheckPrev) / avgCheckPrev) * 100 : 0;

    const next: ActionSignal[] = [];

    if (costJumpPct > 8) {
      next.push({
        id: 'low_resources_cost_jump',
        title: 'Low resources / cost pressure',
        severity: 'high',
        detail: `Cost ratio increased by ${costJumpPct.toFixed(1)} pts vs 7-day baseline. Review stock, procurement, and wastage immediately.`,
      });
    }

    if (Math.abs(avgCheckShiftPct) >= 12) {
      next.push({
        id: 'price_change_detected',
        title: 'Price mix change detected',
        severity: 'medium',
        detail: `Average check moved ${avgCheckShiftPct >= 0 ? '+' : ''}${avgCheckShiftPct.toFixed(
          1
        )}% day-over-day. Validate pricing updates and promo impact.`,
      });
    }

    if (Math.abs(revenueShockPct) >= 20) {
      next.push({
        id: 'sudden_change',
        title: 'Sudden revenue change',
        severity: 'high',
        detail: `Revenue changed ${revenueShockPct >= 0 ? '+' : ''}${revenueShockPct.toFixed(
          1
        )}% vs recent average. Investigate channel, branch, and demand drivers.`,
      });
    }

    if (next.length === 0) {
      next.push({
        id: 'stable_ops',
        title: 'Operations stable',
        severity: 'medium',
        detail:
          'No critical anomalies found in latest cycle. Continue monitoring cost ratio, average check, and daily volume shifts.',
      });
    }
    return next;
  }, [daily, metrics.food_cost, metrics.avg_check]);

  const toggleFlag = (id: string) => {
    setFlagged((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]));
  };

  return (
    <section className="executive-section card" style={{ padding: 24 }}>
      <h2
        className="executive-section-title"
        style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-secondary)', margin: 0 }}
      >
        Action Center
      </h2>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Actionable flags for low resources, price changes, and sudden shifts.
      </p>
      <div className="mt-4 grid gap-3">
        {signals.map((s) => {
          const isFlagged = flagged.includes(s.id);
          const tone = s.severity === 'high' ? 'var(--red)' : 'var(--amber)';
          return (
            <div key={s.id} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{s.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{s.detail}</p>
                </div>
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                  style={{ background: `${tone}22`, color: tone }}
                >
                  {s.severity}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--text-muted)]">
                  Prime cost now: {formatPercent((metrics.food_cost ?? 0) + (metrics.labor_cost ?? 0))}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/decisions?title=${encodeURIComponent(s.title)}&signal=${encodeURIComponent(s.id)}&detail=${encodeURIComponent(s.detail)}`}
                    className="rounded border border-[var(--green)]/40 bg-[var(--green)]/10 px-2 py-1 text-xs font-medium text-[var(--green)] hover:bg-[var(--green)]/20"
                  >
                    Log decision
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleFlag(s.id)}
                    className="rounded border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                  >
                    {isFlagged ? 'Unflag' : 'Flag for action'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
