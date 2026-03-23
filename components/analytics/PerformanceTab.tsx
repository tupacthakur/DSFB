'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Brush,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useMetricsStore, getDeltaPct, getWoWChangePct, getMoMChangePct, getAvgDailyRevenue, getAvgGrossMarginPct } from '@/lib/store/metricsStore';
import type { MetricKey } from '@/lib/symbolic/benchmarks';
import { METRIC_LABELS, METRIC_UNITS, BENCHMARKS } from '@/lib/symbolic/benchmarks';
import { getSeverity } from '@/lib/utils/colors';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { domainWithBreathingRoom } from '@/lib/utils/math';
import { detectOutliers } from '@/lib/utils/outliers';
import { MetricCard } from '@/components/ui/MetricCard';
import { Badge } from '@/components/ui/Badge';
import { CustomTooltip } from '@/components/charts/CustomTooltip';
import { EmptyState } from '@/components/ui/EmptyState';
import { RadarScore } from '@/components/charts/RadarScore';
import { MenuScatterMatrix } from '@/components/charts/MenuScatterMatrix';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const METRIC_ORDER: MetricKey[] = [
  'food_cost',
  'labor_cost',
  'bev_margin',
  'table_turns',
  'avg_check',
  'waste_pct',
  'prime_cost',
  'sat_score',
  'no_shows',
  'repeat_rate',
];

function RevenueCompositeChart() {
  const daily = useMetricsStore((s) => s.daily);
  const revenueRolling7 = useMetricsStore((s) => s.revenueRolling7);

  const { chartData, hasNegatives, leftDomain, outlierCount } = useMemo(() => {
    const slice = (daily ?? []).slice(-30);
    const roll = (revenueRolling7 ?? []).slice(-30);
    const data = slice.map((d, i) => ({
      ...d,
      revenue: d.revenue ?? 0,
      cost: d.cost ?? 0,
      grossMarginPct: d.grossMarginPct ?? 0,
      revenueRolling7: roll[i] ?? null,
    }));
    const revenueVals = data.map((d) => d.revenue).filter((v): v is number => v != null && Number.isFinite(v));
    const { indices } = detectOutliers(revenueVals, 'iqr');
    const outlierCount = indices.length;
    const allVals = data.flatMap((d) => [d.revenue, d.cost, d.revenueRolling7].filter((v): v is number => v != null && Number.isFinite(v)));
    const min = allVals.length ? Math.min(...allVals) : 0;
    const max = allVals.length ? Math.max(...allVals) : 100;
    const leftDomain = domainWithBreathingRoom(min, max) as [number, number];
    const hasNegatives = allVals.some((v) => v < 0);
    return { chartData: data, hasNegatives, leftDomain, outlierCount };
  }, [daily, revenueRolling7]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  if (!chartData.length) {
    return <EmptyState message="No revenue data" height={280} />;
  }

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      {outlierCount > 0 && (
        <div className="mb-2 text-xs text-[var(--amber)]">
          ⚠ {outlierCount} outlier(s) detected — chart scaled to clean range
        </div>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 40, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            yAxisId="left"
            domain={leftDomain}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v, true)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 60]}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          {hasNegatives && <ReferenceLine yAxisId="left" y={0} stroke="var(--border-strong)" strokeDasharray="2 2" />}
          <ReferenceLine
            yAxisId="left"
            x={todayStr}
            stroke="var(--border-strong)"
            strokeDasharray="4 2"
            label={{ value: 'Today', position: 'top', fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <ReferenceLine
            yAxisId="right"
            y={35}
            stroke="var(--red)"
            strokeOpacity={0.3}
            strokeDasharray="2 2"
          />
          <Bar
            yAxisId="left"
            dataKey="cost"
            fill="var(--red)"
            fillOpacity={0.35}
            radius={[2, 2, 0, 0]}
          />
          <Area
            yAxisId="left"
            dataKey="revenue"
            type="monotone"
            stroke="var(--green)"
            strokeWidth={2}
            fill="url(#revenueGrad)"
            connectNulls={false}
          />
          <Line
            yAxisId="left"
            dataKey="revenueRolling7"
            type="monotone"
            stroke="var(--amber)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={chartData.length === 1}
            connectNulls={false}
          />
          <Line
            yAxisId="right"
            dataKey="grossMarginPct"
            type="monotone"
            stroke="var(--teal)"
            strokeWidth={1}
            strokeOpacity={0.7}
            dot={chartData.length === 1}
            connectNulls={false}
          />
          <Brush
            dataKey="date"
            height={18}
            stroke="var(--border-subtle)"
            fill="var(--bg-base)"
            travellerWidth={5}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PerformanceTab() {
  const metrics = useMetricsStore((s) => s.metrics);
  const sparklines = useMetricsStore((s) => s.sparklines);
  const radar = useMetricsStore((s) => s.radar);
  const menuItems = useMetricsStore((s) => s.menuItems);
  const avgVolumeThreshold = useMetricsStore((s) => s.avgVolumeThreshold);
  const targetMargin = useMetricsStore((s) => s.targetMargin);

  const wowPct = useMemo(() => getWoWChangePct(), []);
  const momPct = useMemo(() => getMoMChangePct(), []);
  const avgDailyRevenue = useMemo(() => getAvgDailyRevenue(), []);
  const avgGrossMarginPct = useMemo(() => getAvgGrossMarginPct(), []);

  return (
    <div className="space-y-6">
      {/* Section 1 — KPI Metric Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {METRIC_ORDER.map((metric) => {
          const value = metrics[metric];
          const severity = getSeverity(metric, value);
          const deltaPct = getDeltaPct(metric);
          const higherIsBetter = BENCHMARKS[metric].higherIsBetter;
          return (
            <MetricCard
              key={metric}
              label={METRIC_LABELS[metric]}
              value={value}
              unit={METRIC_UNITS[metric]}
              deltaPct={deltaPct}
              deltaVariant={higherIsBetter ? 'good' : 'bad'}
              severity={severity}
              sparklineData={sparklines[metric] ?? []}
            />
          );
        })}
      </div>

      {/* Section 2 — 30-Day Revenue + Cost Composite Chart */}
      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]" style={{ fontSize: 14 }}>
              30-Day Revenue Overview
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Avg daily revenue {formatCurrency(avgDailyRevenue, true)} · Gross margin{' '}
              {formatPercent(avgGrossMarginPct)}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant={wowPct >= 0 ? 'green' : 'red'}>
              WoW {wowPct >= 0 ? '↑' : '↓'} {Math.abs(wowPct).toFixed(1)}%
            </Badge>
            <Badge variant={momPct >= 0 ? 'green' : 'red'}>
              MoM {momPct >= 0 ? '↑' : '↓'} {Math.abs(momPct).toFixed(1)}%
            </Badge>
          </div>
        </div>
        <ErrorBoundary level="chart">
          <RevenueCompositeChart />
        </ErrorBoundary>
      </div>

      {/* Section 3 — Radar + Scatter */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ErrorBoundary level="chart">
          <RadarScore data={radar} height={240} />
        </ErrorBoundary>
        <ErrorBoundary level="chart">
        <MenuScatterMatrix
          data={menuItems}
          avgVolumeThreshold={avgVolumeThreshold}
          targetMargin={targetMargin}
          height={240}
        />
        </ErrorBoundary>
      </div>
    </div>
  );
}
