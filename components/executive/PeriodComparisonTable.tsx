'use client';

import { useMemo, useState, useCallback } from 'react';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { getAvgDailyRevenue } from '@/lib/store/metricsStore';
import { BENCHMARKS, METRIC_LABELS, METRIC_UNITS } from '@/lib/symbolic/benchmarks';
import type { MetricKey } from '@/lib/symbolic/benchmarks';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { Sparkline } from '@/components/ui/Sparkline';
import { safeDivide } from '@/lib/utils/math';
import { PERIOD_TABLE_METHODOLOGY } from '@/lib/executive/methodology';
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

interface TableRow {
  key: string;
  label: string;
  thisPeriod: number;
  priorPeriod: number;
  change: number | null;
  budget: number | null;
  vsBudget: number | null;
  ideal: number | null;
  vsIndustry: number | null;
  trend: number[];
  isComputed?: boolean;
  unit: '%' | '' | '/5';
}

interface PeriodComparisonTableProps {
  period: ExecutivePeriod;
}

export function PeriodComparisonTable({ period }: PeriodComparisonTableProps) {
  const metrics = useMetricsStore((s) => s.metrics);
  const priorMetrics = useMetricsStore((s) => s.priorMetrics);
  const sparklines = useMetricsStore((s) => s.sparklines);
  const budgetTargets = useMetricsStore((s) => s.budgetTargets);
  const setBudgetTarget = useMetricsStore((s) => s.setBudgetTarget);
  const daily = useMetricsStore((s) => s.daily);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const days = periodMultiplier(period);
  const avgDaily = getAvgDailyRevenue();
  const totalRevenue = avgDaily * days;
  const priorRevenue = avgDaily * (days * 0.95);
  const totalCovers = totalRevenue / (metrics.avg_check || 28);
  const priorCovers = priorRevenue / (priorMetrics.avg_check || 28);
  const laborHoursEst = (totalRevenue * ((metrics.labor_cost ?? 30) / 100)) / 120;
  const revPerLaborHour = laborHoursEst > 0 ? totalRevenue / laborHoursEst : 0;
  const seats = 80;
  const operatingHours = 12 * 7;
  const revPASH = totalRevenue / (seats * operatingHours);
  const ebitdaPct = 100 - (metrics.food_cost ?? 0) - (metrics.labor_cost ?? 0) - 14;
  const contributionPerCover = (metrics.avg_check ?? 28) * (1 - (metrics.food_cost ?? 30) / 100);
  const fixedCostsEst = totalRevenue * 0.14;
  const breakEvenCovers = contributionPerCover > 0 ? fixedCostsEst / contributionPerCover : 0;

  const rows: TableRow[] = useMemo(() => {
    const core: TableRow[] = (Object.keys(BENCHMARKS) as MetricKey[]).map((key) => {
      const curr = metrics[key] ?? 0;
      const prior = priorMetrics[key] ?? 0;
      const change = prior !== 0 ? safeDivide(curr - prior, prior, 0) * 100 : null;
      const budget = budgetTargets[key] ?? null;
      const vsBudget = budget != null ? (curr - budget) : null;
      const ideal = BENCHMARKS[key]?.ideal ?? null;
      const vsIndustry = ideal != null ? (curr - ideal) : null;
      const trend = sparklines[key] ?? [];
      return {
        key,
        label: METRIC_LABELS[key],
        thisPeriod: curr,
        priorPeriod: prior,
        change,
        budget,
        vsBudget,
        ideal,
        vsIndustry,
        trend,
        unit: (METRIC_UNITS[key] as '%' | '' | '/5') ?? '%',
      };
    });
    const revPashTrend = sparklines.food_cost?.length ? Array(7).fill(revPASH) : [];
    return [
      ...core,
      {
        key: 'total_revenue',
        label: 'Total Revenue',
        thisPeriod: totalRevenue,
        priorPeriod: priorRevenue,
        change: priorRevenue ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : null,
        budget: budgetTargets['total_revenue'] ?? null,
        vsBudget: budgetTargets['total_revenue'] != null ? totalRevenue - budgetTargets['total_revenue']! : null,
        ideal: null,
        vsIndustry: null,
        trend: revenueTrend(daily, 7),
        isComputed: true,
        unit: '' as const,
      },
      {
        key: 'total_covers',
        label: 'Total Covers',
        thisPeriod: totalCovers,
        priorPeriod: priorCovers,
        change: priorCovers ? ((totalCovers - priorCovers) / priorCovers) * 100 : null,
        budget: budgetTargets['total_covers'] ?? null,
        vsBudget: budgetTargets['total_covers'] != null ? totalCovers - budgetTargets['total_covers']! : null,
        ideal: null,
        vsIndustry: null,
        trend: [],
        isComputed: true,
        unit: '' as const,
      },
      {
        key: 'revpash',
        label: 'RevPASH',
        thisPeriod: revPASH,
        priorPeriod: revPASH,
        change: null,
        budget: budgetTargets['revpash'] ?? null,
        vsBudget: budgetTargets['revpash'] != null ? revPASH - budgetTargets['revpash']! : null,
        ideal: null,
        vsIndustry: null,
        trend: revPashTrend,
        isComputed: true,
        unit: '' as const,
      },
      {
        key: 'rev_per_labor_hour',
        label: 'Revenue per Labor Hour',
        thisPeriod: revPerLaborHour,
        priorPeriod: revPerLaborHour,
        change: null,
        budget: budgetTargets['rev_per_labor_hour'] ?? null,
        vsBudget: budgetTargets['rev_per_labor_hour'] != null ? revPerLaborHour - budgetTargets['rev_per_labor_hour']! : null,
        ideal: null,
        vsIndustry: null,
        trend: [],
        isComputed: true,
        unit: '' as const,
      },
      {
        key: 'ebitda_pct',
        label: 'EBITDA %',
        thisPeriod: ebitdaPct,
        priorPeriod: ebitdaPct,
        change: null,
        budget: budgetTargets['ebitda_pct'] ?? null,
        vsBudget: budgetTargets['ebitda_pct'] != null ? ebitdaPct - budgetTargets['ebitda_pct']! : null,
        ideal: null,
        vsIndustry: null,
        trend: [],
        isComputed: true,
        unit: '%' as const,
      },
      {
        key: 'break_even_covers',
        label: 'Break-even Covers',
        thisPeriod: breakEvenCovers,
        priorPeriod: breakEvenCovers,
        change: null,
        budget: budgetTargets['break_even_covers'] ?? null,
        vsBudget: budgetTargets['break_even_covers'] != null ? breakEvenCovers - budgetTargets['break_even_covers']! : null,
        ideal: null,
        vsIndustry: null,
        trend: [],
        isComputed: true,
        unit: '' as const,
      },
    ];
  }, [
    metrics,
    priorMetrics,
    budgetTargets,
    sparklines,
    daily,
    totalRevenue,
    priorRevenue,
    totalCovers,
    priorCovers,
    revPASH,
    revPerLaborHour,
    ebitdaPct,
    breakEvenCovers,
  ]);

  function revenueTrend(d: { date: string; revenue: number }[], n: number): number[] {
    if (!d?.length) return [];
    return d.slice(-n).map((x) => x.revenue);
  }

  const handleBudgetClick = useCallback((key: string, current: number | null) => {
    setEditingCell(key);
    setEditValue(current != null ? String(current) : '');
  }, []);

  const handleBudgetBlur = useCallback(() => {
    if (editingCell) {
      const num = parseFloat(editValue);
      if (!Number.isNaN(num)) setBudgetTarget(editingCell, num);
      else setBudgetTarget(editingCell, null);
      setEditingCell(null);
    }
  }, [editingCell, editValue, setBudgetTarget]);

  const exportCsv = useCallback(() => {
    const headers = ['Metric', 'This Period', 'Prior Period', 'Change %', 'Budget', 'vs Budget', 'vs Industry', 'Trend'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const changeStr = r.change != null ? `${r.change.toFixed(1)}%` : '';
      const budgetStr = r.budget != null ? String(r.budget) : '';
      const vsBudgetStr = r.vsBudget != null ? String(r.vsBudget) : '';
      const vsIndStr = r.vsIndustry != null ? String(r.vsIndustry) : '';
      const trendStr = r.trend.length ? r.trend.join(';') : '';
      const thisVal = r.unit === '%' ? `${r.thisPeriod.toFixed(1)}%` : r.unit === '/5' ? r.thisPeriod.toFixed(1) : r.key.includes('revenue') || r.key.includes('revpash') || r.key.includes('rev_per') ? r.thisPeriod.toFixed(0) : r.thisPeriod.toFixed(1);
      const priorVal = r.unit === '%' ? `${r.priorPeriod.toFixed(1)}%` : r.unit === '/5' ? r.priorPeriod.toFixed(1) : r.priorPeriod.toFixed(0);
      lines.push([r.label, thisVal, priorVal, changeStr, budgetStr, vsBudgetStr, vsIndStr, trendStr].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `executive-comparison-${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [rows, period]);

  const [showGuide, setShowGuide] = useState(false);

  return (
    <section className="executive-section card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
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
          Period Comparison
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            aria-expanded={showGuide}
          >
            <Info className="h-3.5 w-3.5" />
            {showGuide ? <>Hide column guide <ChevronUp className="h-3.5 w-3.5" /></> : <>Column guide <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="text-xs font-medium"
            style={{ color: 'var(--green)' }}
          >
            Export as CSV
          </button>
        </div>
      </div>
      {showGuide && (
        <div className="mb-4 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <ul className="grid gap-1.5 sm:grid-cols-2 text-xs text-[var(--text-secondary)] leading-[1.5]">
            <li><strong className="text-[var(--text-primary)]">This Period:</strong> {PERIOD_TABLE_METHODOLOGY.thisPeriod}</li>
            <li><strong className="text-[var(--text-primary)]">Prior Period:</strong> {PERIOD_TABLE_METHODOLOGY.priorPeriod}</li>
            <li><strong className="text-[var(--text-primary)]">Change:</strong> {PERIOD_TABLE_METHODOLOGY.change}</li>
            <li><strong className="text-[var(--text-primary)]">vs Budget:</strong> {PERIOD_TABLE_METHODOLOGY.vsBudget}</li>
            <li><strong className="text-[var(--text-primary)]">vs Industry:</strong> {PERIOD_TABLE_METHODOLOGY.vsIndustry}</li>
            <li><strong className="text-[var(--text-primary)]">Trend:</strong> {PERIOD_TABLE_METHODOLOGY.trend}</li>
          </ul>
          <p className="text-xs text-[var(--text-muted)] mt-2">{PERIOD_TABLE_METHODOLOGY.computed}</p>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Metric</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>This Period</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Prior Period</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Change</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>vs Budget</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>vs Industry</th>
              <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const negativeChangeAndBudget = r.change != null && r.change < 0 && r.vsBudget != null && r.vsBudget < 0;
              const positiveChangeAndIndustry = r.change != null && r.change > 0 && r.vsIndustry != null && (BENCHMARKS[r.key as MetricKey]?.higherIsBetter ? r.vsIndustry > 0 : r.vsIndustry < 0);
              const bg = negativeChangeAndBudget ? 'rgba(248, 113, 113, 0.06)' : positiveChangeAndIndustry ? 'rgba(99, 215, 146, 0.06)' : undefined;
              const isMoney = r.key.includes('revenue') || r.key.includes('revpash') || r.key.includes('rev_per');
              return (
                <tr key={r.key} style={{ borderBottom: '1px solid var(--border-subtle)', background: bg }}>
                  <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>
                    {r.label}{r.isComputed ? ' *' : ''}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-primary)' }}>
                    {isMoney && r.unit === '' ? formatCurrency(r.thisPeriod) : r.unit === '%' ? formatPercent(r.thisPeriod) : r.unit === '/5' ? r.thisPeriod.toFixed(1) : r.thisPeriod.toFixed(1)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)' }}>
                    {isMoney && r.unit === '' ? formatCurrency(r.priorPeriod) : r.unit === '%' ? formatPercent(r.priorPeriod) : r.unit === '/5' ? r.priorPeriod.toFixed(1) : r.priorPeriod.toFixed(1)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: r.change != null && r.change < 0 ? 'var(--red)' : 'var(--green)' }}>
                    {r.change != null ? `${r.change >= 0 ? '+' : ''}${r.change.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                    {editingCell === r.key ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleBudgetBlur}
                        onKeyDown={(e) => e.key === 'Enter' && handleBudgetBlur()}
                        autoFocus
                        style={{
                          width: 72,
                          padding: '4px 6px',
                          fontSize: 12,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 4,
                          color: 'var(--text-primary)',
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBudgetClick(r.key, r.budget)}
                        style={{
                          fontSize: 12,
                          color: r.vsBudget != null ? (r.vsBudget >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {r.budget != null ? (r.unit === '%' ? formatPercent(r.budget) : r.unit === '' && isMoney ? formatCurrency(r.budget) : String(r.budget)) : 'Set'}
                      </button>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: r.vsIndustry != null ? (BENCHMARKS[r.key as MetricKey]?.higherIsBetter ? (r.vsIndustry >= 0 ? 'var(--green)' : 'var(--red)') : (r.vsIndustry <= 0 ? 'var(--green)' : 'var(--red)')) : 'var(--text-muted)' }}>
                    {r.vsIndustry != null && r.ideal != null ? `${r.vsIndustry >= 0 ? '+' : ''}${r.vsIndustry.toFixed(1)} vs ${r.ideal}` : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', width: 80 }}>
                    <Sparkline data={r.trend} height={24} color="var(--blue)" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-ghost)', marginTop: 12 }}>
        {PERIOD_TABLE_METHODOLOGY.computed}
      </p>
    </section>
  );
}
