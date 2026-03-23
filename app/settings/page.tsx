'use client';

import { Suspense, lazy } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const ApiKeyVaultLazy = lazy(() => import('@/components/settings/ApiKeyVault').then((m) => ({ default: m.ApiKeyVault })));

function SettingsContentSkeleton() {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 animate-pulse">
      <div className="h-5 w-32 rounded bg-[var(--border-subtle)] mb-4" />
      <div className="h-20 rounded bg-[var(--border-subtle)]" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ErrorBoundary level="page">
      <div className="min-h-screen bg-[var(--bg-base)]">
        <header className="border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href="/" className="text-base font-semibold text-[var(--text-primary)] sm:text-lg hover:text-[var(--green)] transition-colors">
              Koravo
            </Link>
            <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link href="/" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">Home</Link>
              <Link href="/analytics" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">Analytics</Link>
              <Link href="/executive" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">Executive</Link>
              <Link href="/insights" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">Insights</Link>
              <Link href="/chat" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">SAGE Chat</Link>
              <Link href="/settings" className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--green)]">Settings</Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-3 py-4 sm:p-6">
          <h1 className="mb-4 text-lg font-semibold text-[var(--text-primary)] sm:mb-6">Settings</h1>
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Appearance</h2>
            <ThemeToggle variant="buttons" />
          </section>
          <Suspense fallback={<SettingsContentSkeleton />}>
            <ApiKeyVaultLazy />
          </Suspense>
        </div>
      </div>
    </ErrorBoundary>
  );
}
