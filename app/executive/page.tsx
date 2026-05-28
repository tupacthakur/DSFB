'use client';

import { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useSettingsStore } from '@/lib/store/settingsStore';
import type { ExecutivePeriod } from '@/components/executive/PLSnapshot';

const PLSnapshotLazy = lazy(() => import('@/components/executive/PLSnapshot').then((m) => ({ default: m.PLSnapshot })));
const HealthScoreLazy = lazy(() => import('@/components/executive/HealthScore').then((m) => ({ default: m.HealthScore })));
const StrategicIntelligenceLazy = lazy(() => import('@/components/executive/StrategicIntelligence').then((m) => ({ default: m.StrategicIntelligence })));
const PeriodComparisonTableLazy = lazy(() => import('@/components/executive/PeriodComparisonTable').then((m) => ({ default: m.PeriodComparisonTable })));
const ExecutiveBriefingLazy = lazy(() => import('@/components/executive/ExecutiveBriefing').then((m) => ({ default: m.ExecutiveBriefing })));
const StrategicOutlookLazy = lazy(() => import('@/components/executive/StrategicOutlook').then((m) => ({ default: m.StrategicOutlook })));
const ActionCenterLazy = lazy(() => import('@/components/executive/ActionCenter').then((m) => ({ default: m.ActionCenter })));
const ExecutiveCoverageFrameworkLazy = lazy(() =>
  import('@/components/executive/ExecutiveCoverageFramework').then((m) => ({ default: m.ExecutiveCoverageFramework }))
);
const CommandCentreLazy = lazy(() => import('@/components/executive/CommandCentre').then((m) => ({ default: m.CommandCentre })));

function ExecutiveSectionSkeleton() {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 animate-pulse">
      <div className="h-4 w-48 rounded bg-[var(--border-subtle)] mb-4" />
      <div className="h-24 rounded bg-[var(--border-subtle)]" />
    </div>
  );
}

const PERIODS: { id: ExecutivePeriod; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'ytd', label: 'YTD' },
];

function LastUpdated() {
  const [ago, setAgo] = useState('Updated 0 min ago');
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const mins = Math.max(0, Math.floor((Date.now() - start) / 60000));
      setAgo(mins <= 1 ? 'Updated just now' : `Updated ${mins} min ago`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ fontSize: 12, color: 'var(--text-ghost)' }}>{ago}</span>;
}

export default function ExecutivePage() {
  const [period, setPeriod] = useState<ExecutivePeriod>('month');
  const restaurantName = useSettingsStore((s) => s.restaurantProfile?.name) ?? 'Restaurant';

  const handleExportPdf = useCallback(() => {
    document.documentElement.classList.add('print-mode');
    window.print();
    setTimeout(() => document.documentElement.classList.remove('print-mode'), 500);
  }, []);

  return (
    <ErrorBoundary level="page">
      <div className="min-h-screen bg-[var(--bg-base)]">
        <header className="border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3 sm:px-4 no-print">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">Koravo</h1>
            <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link href="/" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)] sm:min-h-0 sm:min-w-0">
                Home
              </Link>
              <Link href="/analytics" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)] sm:min-h-0 sm:min-w-0">
                Analytics
              </Link>
              <Link href="/insights" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)] sm:min-h-0 sm:min-w-0">
                Insights
              </Link>
              <Link href="/executive" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-[var(--green)] bg-[var(--green)]/10 sm:min-h-0 sm:min-w-0">
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

        <main className="executive-page mx-auto max-w-5xl px-3 py-6 sm:px-4 pt-6 pb-12">
          <section className="info-banner mb-5 no-print">
            <p className="text-sm font-medium text-[var(--text-primary)]">Executive decision cockpit</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Board-level clarity: liquidity (payouts, cash flow, demand), inventory and sales interpretation (franchise,
              SKU cost, margins, transit), bottom-line profit by timeframe, plus a checklist and phased timeline in the
              SAGE briefing.
            </p>
          </section>
          <div className="executive-print-header text-xs text-[var(--text-muted)] border-b border-[var(--border-default)] pb-2 mb-6">
            Koravo Executive Report — {restaurantName} — {new Date().toLocaleDateString()}
          </div>
          <header className="flex flex-wrap items-start justify-between gap-4 mb-6 no-print">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">
                Executive Intelligence
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Board-ready analysis · Updated live
              </p>
            </div>
            <div className="header-actions flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriod(p.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      period === p.id
                        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleExportPdf}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]"
              >
                Export report (PDF)
              </button>
              <LastUpdated />
            </div>
          </header>

          <div className="flex flex-col gap-4">
            <Suspense fallback={<ExecutiveSectionSkeleton />}>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <PLSnapshotLazy period={period} isEstimated />
              </div>
            </Suspense>
            <Suspense fallback={<ExecutiveSectionSkeleton />}>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <HealthScoreLazy />
              </div>
            </Suspense>
            <Suspense fallback={<ExecutiveSectionSkeleton />}>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <CommandCentreLazy />
              </div>
            </Suspense>
            <Suspense fallback={<ExecutiveSectionSkeleton />}>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <StrategicIntelligenceLazy />
              </div>
            </Suspense>
            <Suspense fallback={<ExecutiveSectionSkeleton />}>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <ActionCenterLazy />
              </div>
            </Suspense>
            <Suspense fallback={<ExecutiveSectionSkeleton />}>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <PeriodComparisonTableLazy period={period} />
              </div>
            </Suspense>
            <Suspense fallback={<ExecutiveSectionSkeleton />}>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <ExecutiveCoverageFrameworkLazy />
              </div>
            </Suspense>
            <Suspense fallback={<ExecutiveSectionSkeleton />}>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <ExecutiveBriefingLazy period={period} />
              </div>
            </Suspense>
            <Suspense fallback={<ExecutiveSectionSkeleton />}>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <StrategicOutlookLazy period={period} />
              </div>
            </Suspense>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
