'use client';

import { useCallback, useMemo, Suspense, lazy } from 'react';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useMetricsStore, getAvgDailyRevenue, getWoWChangePct, getAvgGrossMarginPct } from '@/lib/store/metricsStore';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { METRIC_LABELS } from '@/lib/symbolic/benchmarks';
import { BarChart3, TrendingUp, FileDown } from 'lucide-react';
import { getKpiInsights } from '@/lib/insights/kpiInsights';

const HomeRevenueChart = lazy(() => import('@/components/home/HomeRevenueChart').then((m) => ({ default: m.HomeRevenueChart })));
const HomeInsightsBlock = lazy(() => import('@/components/home/HomeInsightsBlock').then((m) => ({ default: m.HomeInsightsBlock })));

export default function HomePage() {
  const daily = useMetricsStore((s) => s.daily);
  const metrics = useMetricsStore((s) => s.metrics);
  const avgDailyRevenue = getAvgDailyRevenue();
  const wowPct = getWoWChangePct();
  const avgMarginPct = getAvgGrossMarginPct();

  const chartData = useMemo(
    () =>
      (daily ?? []).slice(-14).map((d) => ({
        date: d.date.slice(5),
        revenue: d.revenue,
        margin: d.grossMarginPct,
      })),
    [daily]
  );

  const insights = useMemo(
    () => getKpiInsights(avgMarginPct, wowPct, Number(metrics.food_cost) ?? 30),
    [avgMarginPct, wowPct, metrics.food_cost]
  );

  const handleExportPdf = useCallback(() => {
    import('@/lib/reports/pdfReport').then(({ generateReportPdf }) => {
      generateReportPdf({
        title: 'Koravo — Performance Briefing',
        periodLabel: 'Last 30 days',
        avgDailyRevenue,
        wowPct,
        avgMarginPct,
        metrics,
        insights: insights.map((i) => ({ title: i.title, summary: i.summary })),
        revenueTable: chartData.map((d) => ({
          date: d.date,
          revenue: d.revenue,
          margin: d.margin,
        })),
      });
    }).catch((err) => {
      console.error('PDF export failed:', err);
    });
  }, [avgDailyRevenue, wowPct, avgMarginPct, metrics, insights, chartData]);

  return (
    <ErrorBoundary level="page">
      <div className="min-h-screen bg-[var(--bg-base)]">
        <header className="border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href="/" className="text-base font-semibold text-[var(--text-primary)] sm:text-lg hover:text-[var(--green)] transition-colors">
              Koravo
            </Link>
            <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleExportPdf}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]"
                title="Export PDF report"
              >
                <FileDown className="h-4 w-4" />
                <span className="hidden sm:inline">Export PDF</span>
              </button>
              <Link href="/analytics" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)] sm:min-h-0 sm:min-w-0">
                Analytics
              </Link>
              <Link href="/insights" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)] sm:min-h-0 sm:min-w-0">
                Insights
              </Link>
              <Link href="/executive" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)] sm:min-h-0 sm:min-w-0">
                Executive
              </Link>
              <Link href="/decisions" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)] sm:min-h-0 sm:min-w-0">
                Decisions
              </Link>
              <Link href="/chat" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)] sm:min-h-0 sm:min-w-0">
                SAGE Chat
              </Link>
              <Link href="/settings" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)] sm:min-h-0 sm:min-w-0">
                Settings
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
          <section className="info-banner mb-5">
            <p className="text-sm font-medium text-[var(--text-primary)]">Live operating summary</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              This page tracks real uploaded data only. Use Analytics for drill-down, Executive for the command centre, Decisions for the audit log, and SAGE Chat for action plans.
            </p>
          </section>
          <section className="mb-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Overview
            </h2>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="surface-card tap-feedback p-4">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs font-medium">Avg daily revenue</span>
                </div>
                <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {formatCurrency(avgDailyRevenue)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Last 30 days</p>
              </div>
              <div className="surface-card tap-feedback p-4">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">WoW change</span>
                </div>
                <p
                  className={`mt-1 text-xl font-semibold ${
                    wowPct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'
                  }`}
                >
                  {wowPct >= 0 ? '+' : ''}{wowPct.toFixed(1)}%
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Week over week</p>
              </div>
              <div className="surface-card tap-feedback p-4">
                <div className="text-xs font-medium text-[var(--text-muted)]">Gross margin</div>
                <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {formatPercent(avgMarginPct)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Blended</p>
              </div>
              <div className="surface-card tap-feedback p-4">
                <div className="text-xs font-medium text-[var(--text-muted)]">
                  {METRIC_LABELS.food_cost}
                </div>
                <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {formatPercent(metrics.food_cost)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Current</p>
              </div>
            </div>
          </section>

          <Suspense fallback={<div className="mb-8 h-48 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] animate-pulse" />}>
            <HomeRevenueChart />
          </Suspense>

          <Suspense fallback={<div className="mb-8 h-40 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] animate-pulse" />}>
            <HomeInsightsBlock />
          </Suspense>
        </main>
      </div>
    </ErrorBoundary>
  );
}
