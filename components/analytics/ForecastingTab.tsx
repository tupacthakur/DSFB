'use client';

import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Brush,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Legend,
} from 'recharts';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { Flag } from 'lucide-react';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { runForecast } from '@/lib/forecasting';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { safeDivide } from '@/lib/utils/math';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils/cn';

const HISTORICAL_DAYS = 30;
const MODEL_OPTIONS = ['ets', 'linear', 'ensemble'] as const;
const HORIZON_OPTIONS = [7, 14, 21, 30] as const;
const METRIC_OPTIONS = [
  { id: 'revenue', label: 'Revenue', format: (v: number) => formatCurrency(v), isPct: false },
  { id: 'covers', label: 'Covers', format: (v: number) => String(Math.round(v)), isPct: false },
  { id: 'foodCostPct', label: 'Food Cost %', format: (v: number) => formatPercent(v), isPct: true },
  { id: 'laborCostPct', label: 'Labor Cost %', format: (v: number) => formatPercent(v), isPct: true },
  { id: 'avgCheck', label: 'Avg Check', format: (v: number) => formatCurrency(v), isPct: false },
] as const;

type ModelKey = (typeof MODEL_OPTIONS)[number];
type MetricId = (typeof METRIC_OPTIONS)[number]['id'];

function getSeriesFromStore(
  metricId: MetricId,
  daily: { date: string; revenue: number; cost: number; covers: number }[],
  laborCostPctFallback: number
): number[] {
  const slice = daily.slice(-HISTORICAL_DAYS);
  if (metricId === 'revenue') return slice.map((d) => d.revenue);
  if (metricId === 'covers') return slice.map((d) => d.covers);
  if (metricId === 'foodCostPct') return slice.map((d) => safeDivide(d.cost, d.revenue, 0) * 100);
  if (metricId === 'laborCostPct') return slice.map((_, i) => laborCostPctFallback + (i % 5) * 0.3 - 0.6);
  if (metricId === 'avgCheck') return slice.map((d) => safeDivide(d.revenue, d.covers, 0));
  return slice.map((d) => d.revenue);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

// ----- Section 2: Main forecast chart -----
function ForecastChart({
  chartData,
  showBands,
  metricFormat,
  lastHistoricalIndex,
}: {
  chartData: { date: string; actual?: number; smoothed?: number; forecast?: number; upper?: number; lower?: number; isForecast: boolean }[];
  showBands: boolean;
  metricFormat: (v: number) => string;
  lastHistoricalIndex: number;
}) {
  const todayDate = chartData[lastHistoricalIndex]?.date ?? '';
  if (!chartData.length) {
    return <EmptyState message="No forecast data" height={320} />;
  }
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={2}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (typeof v === 'number' && (v >= 1000 || v <= 0.1) ? metricFormat(v) : String(v))}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length || !label) return null;
              const p = payload[0]?.payload as typeof chartData[0];
              return (
                <div className="rounded border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-xs">
                  <div className="font-medium text-[var(--text-muted)]">{label}</div>
                  {p.isForecast ? (
                    <>
                      <div>Projected: {p.forecast != null ? metricFormat(p.forecast) : '—'}</div>
                      <div>Upper: {p.upper != null ? metricFormat(p.upper) : '—'}</div>
                      <div>Lower: {p.lower != null ? metricFormat(p.lower) : '—'}</div>
                      <div>
                        Uncertainty: {p.upper != null && p.lower != null ? metricFormat(p.upper - p.lower) : '—'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>Actual: {p.actual != null ? metricFormat(p.actual) : '—'}</div>
                      <div>Smoothed: {p.smoothed != null ? metricFormat(p.smoothed) : '—'}</div>
                    </>
                  )}
                </div>
              );
            }}
          />
          {showBands && (
            <>
              <Area yAxisId="left" type="monotone" dataKey="upper" fill="var(--purple)" fillOpacity={0.12} stroke="none" />
              <Area yAxisId="left" type="monotone" dataKey="lower" fill="var(--bg-base)" fillOpacity={1} stroke="none" />
            </>
          )}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="actual"
            stroke="var(--green)"
            strokeWidth={2}
            fill="url(#actualGrad)"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="forecast"
            stroke="var(--purple)"
            strokeWidth={2}
            strokeDasharray="7 4"
            dot={false}
            connectNulls={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="smoothed"
            stroke="var(--amber)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            dot={false}
          />
          <ReferenceLine
            yAxisId="left"
            x={todayDate}
            stroke="var(--border-strong)"
            strokeDasharray="4 2"
            label={{ value: 'Today', position: 'top', fill: 'var(--text-muted)', fontSize: 10 }}
          />
          <Brush dataKey="date" height={18} stroke="var(--border-subtle)" fill="var(--bg-base)" travellerWidth={5} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ----- Section 5: Forecast table -----
function ForecastTable({
  rows,
  metricFormat,
  flaggedDates,
  onToggleFlag,
  onExport,
}: {
  rows: { date: string; projected: number; lower: number; upper: number; dayOfWeek: string }[];
  metricFormat: (v: number) => string;
  flaggedDates: string[];
  onToggleFlag: (date: string, flag: boolean) => void;
  onExport: () => void;
}) {
  const columns: ColumnDef<typeof rows[0]>[] = useMemo(
    () => [
      { accessorKey: 'date', header: 'Date' },
      { accessorKey: 'projected', header: 'Projected Value', cell: (c) => metricFormat(Number(c.getValue())) },
      { accessorKey: 'lower', header: 'Lower Bound', cell: (c) => metricFormat(Number(c.getValue())) },
      { accessorKey: 'upper', header: 'Upper Bound', cell: (c) => metricFormat(Number(c.getValue())) },
      {
        id: 'uncertainty',
        header: 'Uncertainty Range',
        cell: ({ row }) => {
          const u = row.original.upper;
          const l = row.original.lower;
          const pct = safeDivide(u - l, u, 0) * 100;
          return (
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded bg-[var(--bg-elevated)]">
                <div
                  className="h-full rounded bg-[var(--purple)]"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <span className="text-xs text-[var(--text-muted)]">{metricFormat(u - l)}</span>
            </div>
          );
        },
      },
      { accessorKey: 'dayOfWeek', header: 'Day of Week' },
      {
        id: 'flagged',
        header: 'Flagged?',
        cell: ({ row }) => {
          const date = row.original.date;
          const flagged = flaggedDates.includes(date);
          return (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFlag(date, !flagged); }}
              className={cn('rounded p-1', flagged ? 'text-[var(--red)]' : 'text-[var(--text-muted)]')}
              title={flagged ? 'Unflag' : 'Flag day'}
            >
              <Flag className="h-4 w-4" />
            </button>
          );
        },
      },
    ],
    [metricFormat, flaggedDates, onToggleFlag]
  );
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="flex justify-end border-b border-[var(--border-subtle)] p-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
        >
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--bg-elevated)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="border-b border-[var(--border-default)] px-3 py-2 font-medium text-[var(--text-muted)]">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={cn(
                  i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-base)]',
                  'hover:bg-[var(--bg-elevated)] transition-colors duration-150'
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-b border-[var(--border-subtle)] px-3 py-2 text-[var(--text-secondary)]">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ForecastingTab() {
  const daily = useMetricsStore((s) => s.daily);
  const metrics = useMetricsStore((s) => s.metrics);
  const flaggedForecastDates = useMetricsStore((s) => s.flaggedForecastDates);
  const setFlaggedForecastDate = useMetricsStore((s) => s.setFlaggedForecastDate);

  const [model, setModel] = useState<ModelKey>('ets');
  const [alpha, setAlpha] = useState(0.4);
  const [horizon, setHorizon] = useState(14);
  const [metricId, setMetricId] = useState<MetricId>('revenue');
  const [showBands, setShowBands] = useState(true);
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(new Set(['Revenue', 'Covers', 'Food Cost %', 'Labor Cost %', 'Avg Check']));

  const laborCostPct = metrics.labor_cost ?? 30;
  const series = useMemo(
    () => getSeriesFromStore(metricId, daily, laborCostPct),
    [metricId, daily, laborCostPct]
  );
  const tooFewPoints = series.length < 7;
  const allZero = series.length > 0 && series.every((v) => v === 0);
  const result = useMemo(() => {
    if (tooFewPoints || allZero) {
      return {
        smoothed: [] as number[],
        forecast: [] as number[],
        upper: [] as number[],
        lower: [] as number[],
        mape: null as number | null,
        rmse: 0,
        mae: 0,
      };
    }
    return runForecast(series, model, alpha, horizon, 1.645, {
      floorAtZero: metricId === 'revenue' || metricId === 'covers',
    });
  }, [series, model, alpha, horizon, metricId, tooFewPoints, allZero]);

  const metricOpt = METRIC_OPTIONS.find((m) => m.id === metricId)!;
  const dates = useMemo(() => {
    const hist = daily.slice(-HISTORICAL_DAYS).map((d) => d.date);
    const last = hist[hist.length - 1] ?? new Date().toISOString().slice(0, 10);
    const fore: string[] = [];
    for (let h = 1; h <= horizon; h++) fore.push(addDays(last, h));
    return [...hist, ...fore];
  }, [daily, horizon]);

  const chartData = useMemo(() => {
    const arr: { date: string; actual?: number; smoothed?: number; forecast?: number; upper?: number; lower?: number; isForecast: boolean }[] = [];
    for (let i = 0; i < dates.length; i++) {
      const isForecast = i >= HISTORICAL_DAYS;
      arr.push({
        date: dates[i]!,
        actual: !isForecast ? series[i] : undefined,
        smoothed: result.smoothed[i] != null && !Number.isNaN(result.smoothed[i]) ? result.smoothed[i] : undefined,
        forecast: result.forecast[i] != null && !Number.isNaN(result.forecast[i]) ? result.forecast[i] : undefined,
        upper: result.upper[i] != null && !Number.isNaN(result.upper[i]) ? result.upper[i] : undefined,
        lower: result.lower[i] != null && !Number.isNaN(result.lower[i]) ? result.lower[i] : undefined,
        isForecast,
      });
    }
    return arr;
  }, [dates, series, result]);

  const tableRows = useMemo(() => {
    const rows: { date: string; projected: number; lower: number; upper: number; dayOfWeek: string }[] = [];
    for (let h = 0; h < horizon; h++) {
      const i = HISTORICAL_DAYS + h;
      rows.push({
        date: dates[i]!,
        projected: result.forecast[i] ?? 0,
        lower: result.lower[i] ?? 0,
        upper: result.upper[i] ?? 0,
        dayOfWeek: dayOfWeek(dates[i]!),
      });
    }
    return rows;
  }, [dates, horizon, result]);

  const avgForecast = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (let h = 0; h < horizon; h++) {
      const v = result.forecast[HISTORICAL_DAYS + h];
      if (v != null && !Number.isNaN(v)) { sum += v; count++; }
    }
    return count ? sum / count : 0;
  }, [result, horizon]);

  const priorAvg = useMemo(() => {
    if (series.length === 0) return 0;
    return series.reduce((s, v) => s + v, 0) / series.length;
  }, [series]);

  const direction = avgForecast >= priorAvg ? 'up' : 'down';
  const modelLabel = model === 'ets' ? 'ETS' : model === 'linear' ? 'Linear' : 'Ensemble';
  const mapeStr = result.mape != null ? `${result.mape.toFixed(1)}%` : 'N/A';
  const insightText = `Based on ${modelLabel} model (MAPE ${mapeStr}), projected ${metricOpt.label} for next ${horizon} days is ${metricOpt.format(avgForecast)}, ${direction} vs prior period.`;

  const multiMetricSeries = useMemo(() => {
    const rev = getSeriesFromStore('revenue', daily, laborCostPct);
    const cov = getSeriesFromStore('covers', daily, laborCostPct);
    const food = getSeriesFromStore('foodCostPct', daily, laborCostPct);
    const labor = getSeriesFromStore('laborCostPct', daily, laborCostPct);
    const avg = getSeriesFromStore('avgCheck', daily, laborCostPct);
    const results = [
      runForecast(rev, model, alpha, horizon),
      runForecast(cov, model, alpha, horizon),
      runForecast(food, model, alpha, horizon),
      runForecast(labor, model, alpha, horizon),
      runForecast(avg, model, alpha, horizon),
    ];
    const lastIdx = HISTORICAL_DAYS;
    const horizonDates: string[] = [];
    const lastDate = daily.slice(-HISTORICAL_DAYS).pop()?.date ?? new Date().toISOString().slice(0, 10);
    for (let h = 1; h <= horizon; h++) horizonDates.push(addDays(lastDate, h));
    const allDates = [...daily.slice(-HISTORICAL_DAYS).map((d) => d.date), ...horizonDates];
    const norm = (vals: number[]) => {
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || 1;
      return vals.map((v) => ((v - min) / range) * 100);
    };
    return allDates.map((date, i) => {
      const isForecast = i >= HISTORICAL_DAYS;
      const h = i - HISTORICAL_DAYS;
      const revF = isForecast ? results[0].forecast[lastIdx + h] : rev[i];
      const covF = isForecast ? results[1].forecast[lastIdx + h] : cov[i];
      const foodF = isForecast ? results[2].forecast[lastIdx + h] : food[i];
      const laborF = isForecast ? results[3].forecast[lastIdx + h] : labor[i];
      const avgF = isForecast ? results[4].forecast[lastIdx + h] : avg[i];
      const allV = [revF ?? 0, covF ?? 0, foodF ?? 0, laborF ?? 0, avgF ?? 0];
      const normV = norm(allV);
      return {
        date,
        Revenue: normV[0],
        Covers: normV[1],
        'Food Cost %': normV[2],
        'Labor Cost %': normV[3],
        'Avg Check': normV[4],
      };
    });
  }, [daily, model, alpha, horizon, laborCostPct]);

  const mapeNum = result.mape ?? 0;
  const mapeColor = mapeNum < 5 ? 'var(--green)' : mapeNum < 10 ? 'var(--amber)' : 'var(--red)';
  const confidencePct = result.mape != null ? Math.max(0, (1 - result.mape / 100) * 100) : 0;

  if (tooFewPoints) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-center">
          <p className="text-[var(--text-primary)]">
            Forecasting requires at least 7 days of data. You have {series.length} days. Upload more data to enable forecasting.
          </p>
        </div>
      </div>
    );
  }
  if (allZero) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-center">
          <p className="text-[var(--text-primary)]">Cannot forecast from zero values.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Controls */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Model</span>
          {MODEL_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModel(m)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium',
                model === m ? 'bg-[var(--green)]/20 text-[var(--green)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
              )}
            >
              {m === 'ets' ? 'ETS' : m === 'linear' ? 'Linear' : 'Ensemble'}
            </button>
          ))}
        </div>
        {model === 'ets' && (
          <div className="flex items-center gap-2" title="Lower = smoother, Higher = more reactive">
            <label className="text-xs text-[var(--text-muted)]">Smoothing α = {alpha.toFixed(2)}</label>
            <input
              type="range"
              min={0.05}
              max={0.95}
              step={0.05}
              value={alpha}
              onChange={(e) => setAlpha(Math.min(0.95, Math.max(0.05, Number(e.target.value))))}
              className="w-24"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Horizon</span>
          {HORIZON_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={cn(
                'rounded-full px-3 py-1 text-xs',
                horizon === h ? 'bg-[var(--green)]/20 text-[var(--green)]' : 'text-[var(--text-muted)]'
              )}
            >
              {h}d
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Metric</span>
          <select
            value={metricId}
            onChange={(e) => setMetricId(e.target.value as MetricId)}
            className="rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--text-primary)]"
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <input type="checkbox" checked={showBands} onChange={(e) => setShowBands(e.target.checked)} />
          Show confidence bands
        </label>
      </div>

      {/* Section 2: Main chart */}
      <ForecastChart
        chartData={chartData}
        showBands={showBands}
        metricFormat={metricOpt.format}
        lastHistoricalIndex={HISTORICAL_DAYS - 1}
      />

      {/* Section 3: Accuracy metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3" title="Lower is better. Under 5% is excellent for F&B.">
          <div className="text-[10px] uppercase text-[var(--text-muted)]">Mean Abs % Error</div>
          <div className="text-lg font-semibold" style={{ color: mapeColor }}>{result.mape != null ? `${result.mape.toFixed(1)}%` : 'N/A'}</div>
        </div>
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3" title="Measures average prediction error in original units.">
          <div className="text-[10px] uppercase text-[var(--text-muted)]">Root Mean Sq Error</div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">{result.rmse.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
          <div className="text-[10px] uppercase text-[var(--text-muted)]">Mean Abs Error</div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">{result.mae.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
          <div className="text-[10px] uppercase text-[var(--text-muted)]">Model confidence</div>
          <div className="text-lg font-semibold" style={{ color: mapeColor }}>{confidencePct.toFixed(1)}%</div>
        </div>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{insightText}</p>

      {/* Section 4: Multi-metric comparison */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Multi-metric forecast (normalized 0–100)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={multiMetricSeries} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={3} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              onClick={(e) => {
                const key = e.value;
                setVisibleMetrics((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                });
              }}
            />
            <Line type="monotone" dataKey="Revenue" stroke="var(--chart-1)" dot={false} strokeWidth={1.5} hide={!visibleMetrics.has('Revenue')} />
            <Line type="monotone" dataKey="Covers" stroke="var(--chart-2)" dot={false} strokeWidth={1.5} hide={!visibleMetrics.has('Covers')} />
            <Line type="monotone" dataKey="Food Cost %" stroke="var(--chart-3)" dot={false} strokeWidth={1.5} hide={!visibleMetrics.has('Food Cost %')} />
            <Line type="monotone" dataKey="Labor Cost %" stroke="var(--chart-4)" dot={false} strokeWidth={1.5} hide={!visibleMetrics.has('Labor Cost %')} />
            <Line type="monotone" dataKey="Avg Check" stroke="var(--chart-5)" dot={false} strokeWidth={1.5} hide={!visibleMetrics.has('Avg Check')} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Section 5: Forecast table */}
      <ForecastTable
        rows={tableRows}
        metricFormat={metricOpt.format}
        flaggedDates={flaggedForecastDates}
        onToggleFlag={setFlaggedForecastDate}
        onExport={() => {
          const headers = ['Date', 'Projected Value', 'Lower Bound', 'Upper Bound', 'Uncertainty Range', 'Day of Week', 'Flagged'];
          const csvRows = tableRows.map((r) => [
            r.date,
            metricOpt.format(r.projected),
            metricOpt.format(r.lower),
            metricOpt.format(r.upper),
            metricOpt.format(r.upper - r.lower),
            r.dayOfWeek,
            flaggedForecastDates.includes(r.date) ? 'Yes' : 'No',
          ].join(','));
          const csv = [headers.join(','), ...csvRows].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `koravo-forecast-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      />
    </div>
  );
}
