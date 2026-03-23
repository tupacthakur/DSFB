'use client';

import { useState, useMemo } from 'react';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { getAvgDailyRevenue } from '@/lib/store/metricsStore';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { PL_METHODOLOGY } from '@/lib/executive/methodology';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

export type ExecutivePeriod = 'week' | 'month' | 'quarter' | 'ytd';

function periodMultiplier(period: ExecutivePeriod): number {
  switch (period) {
    case 'week': return 7;
    case 'month': return 30;
    case 'quarter': return 90;
    case 'ytd': return Math.min(365, 90 + Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000));
    default: return 30;
  }
}

interface PLSnapshotProps {
  period: ExecutivePeriod;
  isEstimated?: boolean;
}

interface PLColumn {
  label: string;
  value: number;
  pctOfRevenue: number;
  barPct: number;
  color: string;
  deltaPct: number | null;
  isSubtraction?: boolean;
}

export function PLSnapshot({ period, isEstimated }: PLSnapshotProps) {
  const metrics = useMetricsStore((s) => s.metrics);
  const priorMetrics = useMetricsStore((s) => s.priorMetrics);
  const avgDaily = getAvgDailyRevenue();
  const days = periodMultiplier(period);
  const revenue = useMemo(() => avgDaily * days, [avgDaily, days]);
  const foodCostPct = metrics.food_cost ?? 0;
  const laborCostPct = metrics.labor_cost ?? 0;
  const priorFood = priorMetrics.food_cost ?? foodCostPct;
  const priorLabor = priorMetrics.labor_cost ?? laborCostPct;
  const opExPct = 14;
  const grossProfitPct = 100 - foodCostPct;
  const primeProfitPct = grossProfitPct - laborCostPct;
  const ebitdaPct = primeProfitPct - opExPct;
  const foodCostVal = (foodCostPct / 100) * revenue;
  const laborCostVal = (laborCostPct / 100) * revenue;
  const opExVal = (opExPct / 100) * revenue;
  const grossProfitVal = revenue - foodCostVal;
  const primeProfitVal = grossProfitVal - laborCostVal;
  const ebitdaVal = primeProfitVal - opExVal;
  const deltaFood = priorFood ? ((foodCostPct - priorFood) / priorFood) * 100 : null;
  const deltaLabor = priorLabor ? ((laborCostPct - priorLabor) / priorLabor) * 100 : null;

  const columns: PLColumn[] = useMemo(() => {
    const list: PLColumn[] = [
      { label: 'Revenue', value: revenue, pctOfRevenue: 100, barPct: 100, color: 'var(--green)', deltaPct: null },
      { label: '− Food Cost', value: -foodCostVal, pctOfRevenue: foodCostPct, barPct: foodCostPct, color: 'var(--red)', deltaPct: deltaFood ?? null, isSubtraction: true },
      { label: 'Gross Profit', value: grossProfitVal, pctOfRevenue: grossProfitPct, barPct: grossProfitPct, color: 'var(--blue)', deltaPct: null },
      { label: '− Labor Cost', value: -laborCostVal, pctOfRevenue: laborCostPct, barPct: laborCostPct, color: 'var(--red)', deltaPct: deltaLabor ?? null, isSubtraction: true },
      { label: 'Prime Profit', value: primeProfitVal, pctOfRevenue: primeProfitPct, barPct: primeProfitPct, color: 'var(--amber)', deltaPct: null },
      { label: '− Operating Expenses', value: -opExVal, pctOfRevenue: opExPct, barPct: opExPct, color: 'var(--red)', deltaPct: null, isSubtraction: true },
      {
        label: 'EBITDA',
        value: ebitdaVal,
        pctOfRevenue: ebitdaPct,
        barPct: Math.min(100, Math.max(0, ebitdaPct)),
        color: ebitdaPct > 15 ? 'var(--green)' : ebitdaPct >= 10 ? 'var(--amber)' : 'var(--red)',
        deltaPct: null,
      },
    ];
    return list;
  }, [
    revenue,
    foodCostVal,
    laborCostVal,
    opExVal,
    grossProfitVal,
    primeProfitVal,
    ebitdaVal,
    foodCostPct,
    laborCostPct,
    grossProfitPct,
    primeProfitPct,
    opExPct,
    ebitdaPct,
    deltaFood,
    deltaLabor,
  ]);

  const industryMedian = '12–15%';
  const vsMedian =
    ebitdaPct > 15 ? 'above' : ebitdaPct >= 12 && ebitdaPct <= 15 ? 'at' : 'below';

  const [showLogic, setShowLogic] = useState(false);

  return (
    <section className="executive-section card" style={{ padding: 24 }}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2
          className="executive-section-title"
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          P&L Snapshot
          {isEstimated && (
            <span
              className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium"
              style={{ background: 'var(--amber)', color: 'var(--bg-base)' }}
            >
              Estimated
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setShowLogic(!showLogic)}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          aria-expanded={showLogic}
        >
          <Info className="h-3.5 w-3.5" />
          {showLogic ? <>Hide logic <ChevronUp className="h-3.5 w-3.5" /></> : <>Logic & definitions <ChevronDown className="h-3.5 w-3.5" /></>}
        </button>
      </div>
      {showLogic && (
        <div className="mb-4 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <p className="text-xs text-[var(--text-secondary)] leading-[1.6] mb-2">{PL_METHODOLOGY.cascade}</p>
          <p className="text-xs text-[var(--text-secondary)] leading-[1.6] mb-2">{PL_METHODOLOGY.ebitdaBands}</p>
          {isEstimated && <p className="text-xs text-[var(--text-muted)]">{PL_METHODOLOGY.estimatedNote}</p>}
        </div>
      )}
      <div
        className="pl-waterfall"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        {columns.map((col, i) => (
          <div key={col.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {i > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }} aria-hidden>→</span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>{col.label}</span>
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                fontFamily: 'var(--font-outfit), Outfit, sans-serif',
                color: col.value < 0 ? 'var(--red)' : col.color,
              }}
            >
              {col.value < 0 ? '−' : ''}{formatCurrency(Math.abs(col.value))}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {col.pctOfRevenue.toFixed(1)}%
            </span>
            <div
              style={{
                width: '100%',
                maxWidth: 80,
                height: 8,
                borderRadius: 4,
                background: 'var(--border-subtle)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${col.barPct}%`,
                  height: '100%',
                  background: col.color,
                  borderRadius: 4,
                }}
              />
            </div>
            {col.deltaPct != null && (
              <span
                style={{
                  fontSize: 11,
                  color: col.deltaPct > 0 ? 'var(--red)' : 'var(--green)',
                }}
              >
                {col.deltaPct > 0 ? '↑' : '↓'} {Math.abs(col.deltaPct).toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>
      <p
        className="mt-4 text-[13px] leading-[1.7]"
        style={{ color: 'var(--text-secondary)' }}
      >
        EBITDA this {period}: {formatCurrency(ebitdaVal)} ({ebitdaPct.toFixed(1)}% margin) — {vsMedian} industry median of {industryMedian}.
      </p>
    </section>
  );
}

