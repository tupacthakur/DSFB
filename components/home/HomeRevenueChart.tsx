'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { formatCurrency } from '@/lib/utils/formatters';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

export function HomeRevenueChart() {
  const daily = useMetricsStore((s) => s.daily);
  const chartData = useMemo(
    () =>
      (daily ?? []).slice(-14).map((d) => ({
        date: d.date.slice(5),
        revenue: d.revenue,
        margin: d.grossMarginPct,
      })),
    [daily]
  );

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Revenue (last 14 days)
      </h2>
      <div className="h-48 min-h-[12rem] sm:h-56 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 sm:p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <defs>
              <linearGradient id="homeRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--green)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrency(v, true)}
            />
            <Tooltip
              formatter={(v: number) => formatCurrency(v)}
              contentStyle={{
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
              }}
              labelStyle={{ color: 'var(--text-muted)' }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--green)"
              strokeWidth={2}
              fill="url(#homeRevenueGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
