'use client';

import { useMemo } from 'react';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { getAvgDailyRevenue, getWoWChangePct, getAvgGrossMarginPct } from '@/lib/store/metricsStore';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export function InstantAnalysis() {
  const daily = useMetricsStore((s) => s.daily);
  const categoryPL = useMetricsStore((s) => s.categoryPL);
  const metrics = useMetricsStore((s) => s.metrics);
  const menuItems = useMetricsStore((s) => s.menuItemsForEngineering);

  const avgRevenue = getAvgDailyRevenue();
  const wowPct = getWoWChangePct();
  const avgMargin = getAvgGrossMarginPct();

  const revenueChartData = useMemo(
    () => (daily ?? []).slice(-30).map((d) => ({ date: d.date.slice(5), revenue: d.revenue, margin: d.grossMarginPct })),
    [daily]
  );

  const categoryData = useMemo(() => categoryPL ?? [], [categoryPL]);
  const topMenu = useMemo(
    () => [...(menuItems ?? [])].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    [menuItems]
  );

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Instant analysis — Excel-style overview
      </h2>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <div className="text-[10px] uppercase text-[var(--text-muted)]">Avg daily revenue</div>
          <div className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]">{formatCurrency(avgRevenue)}</div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <div className="text-[10px] uppercase text-[var(--text-muted)]">WoW change</div>
          <div className={`mt-0.5 text-lg font-semibold ${wowPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
            {wowPct >= 0 ? '+' : ''}{wowPct.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <div className="text-[10px] uppercase text-[var(--text-muted)]">Gross margin</div>
          <div className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]">{formatPercent(avgMargin)}</div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <div className="text-[10px] uppercase text-[var(--text-muted)]">Food cost</div>
          <div className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]">{formatPercent(metrics.food_cost)}</div>
        </div>
      </div>

      {/* Revenue trend */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
        <h3 className="mb-3 text-xs font-semibold text-[var(--text-muted)]">Revenue (last 30 days)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={revenueChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="iaRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--green)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, true)} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 6 }} />
            <Area type="monotone" dataKey="revenue" stroke="var(--green)" strokeWidth={2} fill="url(#iaRevenue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Category P&L + Top menu */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
          <h3 className="mb-3 text-xs font-semibold text-[var(--text-muted)]">Category margin</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 60, right: 24 }}>
                <XAxis type="number" hide domain={[0, 'auto']} />
                <YAxis type="category" dataKey="category" width={58} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatPercent(v)} />
                <Bar dataKey="marginPct" fill="var(--blue)" fillOpacity={0.7} radius={[0, 3, 3, 0]} name="Margin %" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">No category data</p>
          )}
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
          <h3 className="mb-3 text-xs font-semibold text-[var(--text-muted)]">Top 10 by revenue</h3>
          {topMenu.length > 0 ? (
            <ul className="space-y-1.5 text-xs">
              {topMenu.map((item, i) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span className="truncate text-[var(--text-secondary)]">{(i + 1)}. {item.name}</span>
                  <span className="shrink-0 font-medium text-[var(--text-primary)]">{formatCurrency(item.revenue, true)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">No menu data</p>
          )}
        </div>
      </div>
    </div>
  );
}
