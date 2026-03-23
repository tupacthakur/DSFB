'use client';

import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BarChart3, UtensilsCrossed, LineChart, Database } from 'lucide-react';
import { AnalyticsTabSkeleton } from '@/components/ui/Skeleton';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const TAB_IDS = ['performance', 'menu-engineering', 'forecasting', 'data-intelligence'] as const;
type TabId = (typeof TAB_IDS)[number];

const TAB_CONFIG: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'performance', label: 'Performance', icon: BarChart3 },
  { id: 'menu-engineering', label: 'Menu Engineering', icon: UtensilsCrossed },
  { id: 'forecasting', label: 'Forecasting', icon: LineChart },
  { id: 'data-intelligence', label: 'Data Intelligence', icon: Database },
];

const PerformanceTab = lazy(() => import('@/components/analytics/PerformanceTab'));
const MenuEngineeringTab = lazy(() => import('@/components/analytics/MenuEngineeringTab'));
const ForecastingTab = lazy(() => import('@/components/analytics/ForecastingTab'));
const DataIntelligenceTab = lazy(() => import('@/components/analytics/DataIntelligenceTab'));

const TAB_COMPONENTS: Record<TabId, React.LazyExoticComponent<React.ComponentType>> = {
  'performance': PerformanceTab,
  'menu-engineering': MenuEngineeringTab,
  'forecasting': ForecastingTab,
  'data-intelligence': DataIntelligenceTab,
};

function parseTabFromUrl(value: string | null): TabId {
  if (value && TAB_IDS.includes(value as TabId)) return value as TabId;
  return 'performance';
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabId>(() => parseTabFromUrl(urlTab));

  const setTab = useCallback(
    (tab: TabId) => {
      setActiveTab(tab);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    },
    []
  );

  useEffect(() => {
    const parsed = parseTabFromUrl(urlTab);
    setActiveTab(parsed);
  }, [urlTab]);

  const ActiveContent = TAB_COMPONENTS[activeTab];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <header className="border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 sm:px-4 flex items-center justify-between gap-2">
        <Link href="/" className="text-base font-semibold text-[var(--text-primary)] sm:text-lg hover:text-[var(--green)] transition-colors shrink-0">
          Koravo
        </Link>
        <nav className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <Link href="/" className="rounded-lg px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">Home</Link>
          <Link href="/executive" className="rounded-lg px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">Executive</Link>
          <Link href="/insights" className="rounded-lg px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">Insights</Link>
          <Link href="/chat" className="rounded-lg px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">SAGE Chat</Link>
          <Link href="/settings" className="rounded-lg px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">Settings</Link>
          <ThemeToggle />
        </nav>
      </header>
      <nav
        className="border-b border-[var(--border-default)] bg-[var(--bg-surface)]"
        role="tablist"
      >
        <div className="flex gap-0 overflow-x-auto">
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${id}`}
                id={`tab-${id}`}
                onClick={() => setTab(id)}
                className="flex min-h-[44px] min-w-[44px] touch-manipulation shrink-0 items-center justify-center gap-2 px-3 py-3 font-medium uppercase tracking-[0.06em] transition-colors sm:px-4 md:px-6"
                style={{
                  fontFamily: 'var(--font-outfit), Outfit, sans-serif',
                  fontSize: '12px',
                  color: isActive ? 'var(--green)' : 'var(--text-muted)',
                  borderBottom: isActive ? '1px solid var(--green)' : '1px solid transparent',
                }}
              >
                <Icon className="h-4 w-4 shrink-0 md:mr-1" aria-hidden />
                <span className="hidden md:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="p-4 md:p-6"
      >
        <ErrorBoundary level="section">
          <Suspense fallback={<AnalyticsTabSkeleton />}>
            <ActiveContent />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsTabSkeleton />}>
      <AnalyticsContent />
    </Suspense>
  );
}
