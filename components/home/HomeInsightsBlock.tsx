'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { getAvgGrossMarginPct, getWoWChangePct } from '@/lib/store/metricsStore';
import { getKpiInsights } from '@/lib/insights/kpiInsights';
import { MessageCircle, Lightbulb, AlertTriangle } from 'lucide-react';

export function HomeInsightsBlock() {
  const metrics = useMetricsStore((s) => s.metrics);
  const avgMarginPct = getAvgGrossMarginPct();
  const wowPct = getWoWChangePct();
  const foodCostPct = Number(metrics?.food_cost) ?? 30;
  const insights = useMemo(
    () => getKpiInsights(avgMarginPct, wowPct, foodCostPct),
    [avgMarginPct, wowPct, foodCostPct]
  );

  return (
    <section className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        <AlertTriangle className="h-4 w-4" />
        Insights — Ask SAGE
      </h2>
      {insights.length === 0 ? (
        <p className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-muted)]">
          No KPI issues right now — margin, revenue, and food cost are within target.
        </p>
      ) : (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
            >
              <h3 className="text-sm font-medium text-[var(--text-primary)]">{insight.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{insight.summary}</p>
              <Link
                href={`/chat?q=${encodeURIComponent(insight.query)}`}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--green)] hover:underline"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Ask SAGE about this
              </Link>
            </div>
          ))}
        </div>
      )}
      <Link
        href="/insights"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--green)] hover:underline"
      >
        <Lightbulb className="h-3.5 w-3.5" />
        View full Insights page (SAGE + chat context)
      </Link>
    </section>
  );
}
