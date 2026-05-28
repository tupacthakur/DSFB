'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { getAvgDailyRevenue } from '@/lib/store/metricsStore';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { PL_METHODOLOGY } from '@/lib/executive/methodology';
import { Info, ChevronDown, ChevronUp, TrendingDown, TrendingUp } from 'lucide-react';

export type ExecutivePeriod = 'week' | 'month' | 'quarter' | 'ytd';

const PERIOD_LABEL: Record<ExecutivePeriod, string> = {
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  ytd: 'YTD',
};

function periodMultiplier(period: ExecutivePeriod): number {
  switch (period) {
    case 'week':
      return 7;
    case 'month':
      return 30;
    case 'quarter':
      return 90;
    case 'ytd':
      return Math.min(
        365,
        90 + Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000)
      );
    default:
      return 30;
  }
}

interface PLSnapshotProps {
  period: ExecutivePeriod;
  isEstimated?: boolean;
}

type RowKind = 'revenue' | 'deduction' | 'subtotal' | 'ebitda';

interface PLRow {
  key: string;
  label: string;
  amount: number;
  pctOfRevenue: number;
  barPct: number;
  barColor: string;
  deltaPct: number | null;
  /** For cost lines: higher delta = worse */
  deltaIsCost: boolean;
  kind: RowKind;
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

  const rows: PLRow[] = useMemo(
    () => [
      {
        key: 'revenue',
        label: 'Revenue',
        amount: revenue,
        pctOfRevenue: 100,
        barPct: 100,
        barColor: 'var(--green)',
        deltaPct: null,
        deltaIsCost: false,
        kind: 'revenue',
      },
      {
        key: 'food',
        label: 'Food cost',
        amount: -foodCostVal,
        pctOfRevenue: foodCostPct,
        barPct: foodCostPct,
        barColor: 'var(--red)',
        deltaPct: deltaFood,
        deltaIsCost: true,
        kind: 'deduction',
      },
      {
        key: 'gross',
        label: 'Gross profit',
        amount: grossProfitVal,
        pctOfRevenue: grossProfitPct,
        barPct: grossProfitPct,
        barColor: 'var(--blue)',
        deltaPct: null,
        deltaIsCost: false,
        kind: 'subtotal',
      },
      {
        key: 'labor',
        label: 'Labor cost',
        amount: -laborCostVal,
        pctOfRevenue: laborCostPct,
        barPct: laborCostPct,
        barColor: 'var(--red)',
        deltaPct: deltaLabor,
        deltaIsCost: true,
        kind: 'deduction',
      },
      {
        key: 'prime',
        label: 'Prime profit',
        amount: primeProfitVal,
        pctOfRevenue: primeProfitPct,
        barPct: primeProfitPct,
        barColor: 'var(--amber)',
        deltaPct: null,
        deltaIsCost: false,
        kind: 'subtotal',
      },
      {
        key: 'opex',
        label: 'Operating expenses (est.)',
        amount: -opExVal,
        pctOfRevenue: opExPct,
        barPct: opExPct,
        barColor: 'var(--text-muted)',
        deltaPct: null,
        deltaIsCost: false,
        kind: 'deduction',
      },
      {
        key: 'ebitda',
        label: 'EBITDA',
        amount: ebitdaVal,
        pctOfRevenue: ebitdaPct,
        barPct: Math.min(100, Math.max(0, ebitdaPct)),
        barColor: ebitdaPct > 15 ? 'var(--green)' : ebitdaPct >= 10 ? 'var(--amber)' : 'var(--red)',
        deltaPct: null,
        deltaIsCost: false,
        kind: 'ebitda',
      },
    ],
    [
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
    ]
  );

  const industryMedian = '12–15%';
  const vsMedian =
    ebitdaPct > 15 ? 'above' : ebitdaPct >= 12 && ebitdaPct <= 15 ? 'in line with' : 'below';

  const [showLogic, setShowLogic] = useState(false);

  return (
    <section className="executive-section card overflow-hidden p-0">
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                P&amp;L snapshot
              </h2>
              {isEstimated && (
                <span className="rounded-md bg-[var(--amber)]/20 px-2 py-0.5 text-[11px] font-semibold text-[var(--amber)]">
                  Estimated
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {PERIOD_LABEL[period]} view · {days}-day revenue roll-up from average daily sales
              {avgDaily <= 0 && ' · upload CSV to populate revenue'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLogic(!showLogic)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            aria-expanded={showLogic}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
            {showLogic ? (
              <>
                Hide definitions <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Definitions <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--green-border)] bg-[var(--green-dim)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Revenue</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--text-primary)] sm:text-xl">
              {formatCurrency(revenue)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Prime profit</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--amber)] sm:text-xl">
              {formatCurrency(primeProfitVal)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{formatPercent(primeProfitPct)} of revenue</p>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">EBITDA</p>
            <p
              className="mt-0.5 text-lg font-semibold tabular-nums sm:text-xl"
              style={{ color: ebitdaPct > 15 ? 'var(--green)' : ebitdaPct >= 10 ? 'var(--amber)' : 'var(--red)' }}
            >
              {formatCurrency(ebitdaVal)}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{ebitdaPct.toFixed(1)}% margin</p>
          </div>
        </div>
      </div>

      {showLogic && (
        <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3 sm:px-5">
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{PL_METHODOLOGY.cascade}</p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{PL_METHODOLOGY.ebitdaBands}</p>
          {isEstimated && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">{PL_METHODOLOGY.estimatedNote}</p>
          )}
        </div>
      )}

      <div className="overflow-x-auto px-2 pb-4 pt-2 sm:px-4 sm:pb-5 sm:pt-3">
        <table className="pl-snapshot-table w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-default)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <th className="py-3 pl-3 pr-2 sm:pl-4">Line item</th>
              <th className="py-3 pr-3 text-right tabular-nums">Amount</th>
              <th className="py-3 pr-3 text-right tabular-nums">% of revenue</th>
              <th className="hidden py-3 pr-3 text-right sm:table-cell sm:w-[100px]">vs prior</th>
              <th className="py-3 pr-3 sm:pl-2 sm:pr-4">
                <span className="sr-only">Share of revenue</span>
                <span className="hidden sm:inline">Mix</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isDeduction = row.kind === 'deduction';
              const isEbitda = row.kind === 'ebitda';
              const isRevenue = row.kind === 'revenue';
              const rowBg =
                isEbitda
                  ? 'bg-[var(--bg-elevated)]'
                  : isRevenue
                  ? 'bg-[var(--green-dim)]/40'
                  : 'bg-transparent';
              const borderLeft =
                isRevenue
                  ? 'border-l-[3px] border-l-[var(--green)]'
                  : isDeduction
                  ? 'border-l-[3px] border-l-[var(--red)]/60'
                  : isEbitda
                  ? 'border-l-[3px] border-l-[var(--amber)]'
                  : 'border-l-[3px] border-l-transparent';

              let deltaContent: ReactNode = '—';
              if (row.deltaPct != null) {
                const up = row.deltaPct > 0;
                const badForCost = row.deltaIsCost && up;
                const goodForCost = row.deltaIsCost && !up;
                const tone = row.deltaIsCost ? (badForCost ? 'text-[var(--red)]' : 'text-[var(--green)]') : 'text-[var(--text-muted)]';
                deltaContent = (
                  <span className={`inline-flex items-center justify-end gap-0.5 font-medium tabular-nums ${tone}`}>
                    {up ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
                    {Math.abs(row.deltaPct).toFixed(1)}%
                  </span>
                );
              }

              return (
                <tr
                  key={row.key}
                  className={`border-b border-[var(--border-subtle)] ${rowBg} ${borderLeft} ${isEbitda ? 'font-semibold' : ''}`}
                >
                  <td className={`py-3 pl-3 pr-2 sm:pl-4 ${isEbitda ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    <span className={isDeduction ? 'text-[var(--text-secondary)]' : ''}>{row.label}</span>
                  </td>
                  <td
                    className={`py-3 pr-3 text-right tabular-nums ${
                      row.amount < 0 ? 'text-[var(--red)]' : isEbitda || isRevenue ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {row.amount < 0 ? '−' : ''}
                    {formatCurrency(Math.abs(row.amount))}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums text-[var(--text-muted)]">
                    {formatPercent(row.pctOfRevenue)}
                  </td>
                  <td className="hidden py-3 pr-3 text-right sm:table-cell">{deltaContent}</td>
                  <td className="py-3 pr-3 sm:pr-4">
                    <div
                      className="h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-[var(--border-subtle)] sm:ml-auto"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{
                          width: `${row.barPct}%`,
                          backgroundColor: row.barColor,
                          maxWidth: '100%',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3 sm:px-5">
        <p className="text-xs leading-relaxed text-[var(--text-secondary)] sm:text-[13px]">
          <strong className="font-medium text-[var(--text-primary)]">EBITDA ({PERIOD_LABEL[period].toLowerCase()}):</strong>{' '}
          {formatCurrency(ebitdaVal)} ({ebitdaPct.toFixed(1)}% margin) — {vsMedian} a typical full-service median of{' '}
          {industryMedian}.
        </p>
      </div>
    </section>
  );
}
