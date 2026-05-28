'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import {
  useDecisionsStore,
  computeDecisionStats,
  type DecisionPriority,
  type DecisionStatus,
} from '@/lib/store/decisionsStore';
import { useIngestionLogStore, ingestionStats } from '@/lib/store/ingestionLogStore';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { getAvgDailyRevenue, getWoWChangePct } from '@/lib/store/metricsStore';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { FileDown, Trash2 } from 'lucide-react';

export function DecisionsClient() {
  const searchParams = useSearchParams();
  const decisions = useDecisionsStore((s) => s.decisions);
  const addDecision = useDecisionsStore((s) => s.addDecision);
  const updateDecision = useDecisionsStore((s) => s.updateDecision);
  const removeDecision = useDecisionsStore((s) => s.removeDecision);
  const ingestEvents = useIngestionLogStore((s) => s.events);
  const metrics = useMetricsStore((s) => s.metrics);
  const restaurantName = useSettingsStore((s) => s.restaurantProfile?.name) ?? 'Restaurant';

  const [title, setTitle] = useState('');
  const [rationale, setRationale] = useState('');
  const [priority, setPriority] = useState<DecisionPriority>('high');
  const [linkedSignalId, setLinkedSignalId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DecisionStatus | 'all'>('all');

  useEffect(() => {
    const t = searchParams.get('title');
    const d = searchParams.get('detail');
    const sig = searchParams.get('signal');
    if (t) setTitle(t);
    if (d) setRationale(d);
    if (sig) setLinkedSignalId(sig);
  }, [searchParams]);

  const stats = useMemo(() => computeDecisionStats(decisions), [decisions]);
  const ing = useMemo(() => ingestionStats(ingestEvents), [ingestEvents]);
  const avgDaily = getAvgDailyRevenue();
  const wow = getWoWChangePct();

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return decisions;
    return decisions.filter((x) => x.status === statusFilter);
  }, [decisions, statusFilter]);

  const handleAdd = useCallback(() => {
    if (!title.trim()) return;
    addDecision({
      title: title.trim(),
      rationale: rationale.trim() || '—',
      priority,
      source: linkedSignalId ? 'action_center' : 'decisions_page',
      linkedSignalId: linkedSignalId ?? undefined,
    });
    setTitle('');
    setRationale('');
    setPriority('high');
    setLinkedSignalId(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/decisions');
    }
  }, [addDecision, title, rationale, priority, linkedSignalId]);

  const handleExportPdf = useCallback(() => {
    import('@/lib/reports/decisionPipelineReport').then(({ generateDecisionPipelineReportPdf }) => {
      generateDecisionPipelineReportPdf({
        restaurantName,
        decisions,
        ingestions: ingestEvents,
        metrics: metrics as Record<string, number>,
        avgDailyRevenue: avgDaily,
        wowPct: wow,
      });
    });
  }, [restaurantName, decisions, ingestEvents, metrics, avgDaily, wow]);

  return (
    <ErrorBoundary level="page">
      <div className="min-h-screen bg-[var(--bg-base)]">
        <header className="border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href="/" className="text-base font-semibold text-[var(--text-primary)] sm:text-lg hover:text-[var(--green)]">
              Koravo
            </Link>
            <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link href="/" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">
                Home
              </Link>
              <Link href="/analytics" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">
                Analytics
              </Link>
              <Link href="/executive" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">
                Executive
              </Link>
              <Link href="/decisions" className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--green)] bg-[var(--green)]/10">
                Decisions
              </Link>
              <Link href="/chat" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">
                SAGE Chat
              </Link>
              <Link href="/settings" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">
                Settings
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4 pb-12">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">Decisions & pipeline report</h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {restaurantName} · Command-centre log, CSV ingestion history, and exportable audit report.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--green)] hover:text-[var(--green)]"
            >
              <FileDown className="h-4 w-4" />
              Export PDF report
            </button>
          </div>

          <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">Total decisions</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{stats.total}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">Open / in progress</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--amber)]">
                {stats.byStatus.open + stats.byStatus.in_progress}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">Completed (7d)</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--green)]">{stats.completedThisWeek}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">CSV ingest runs</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{ing.runCount}</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">{ing.totalWarnings} total warnings logged</p>
            </div>
          </section>

          <section className="mb-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Log a decision</h2>
            {linkedSignalId && (
              <p className="mt-1 text-xs text-[var(--green)]">Linked to Action Center signal: {linkedSignalId}</p>
            )}
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <label className="text-xs text-[var(--text-muted)]">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as DecisionPriority)}
                  className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </div>
            </div>
            <label className="mt-3 block text-xs text-[var(--text-muted)]">Rationale</label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!title.trim()}
              className="mt-3 rounded-lg bg-[var(--green)] px-4 py-2 text-sm font-semibold text-[var(--bg-base)] disabled:opacity-40"
            >
              Save decision
            </button>
          </section>

          <section className="mb-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Ingestion log</h2>
              <p className="text-xs text-[var(--text-muted)]">Last {Math.min(12, ingestEvents.length)} runs</p>
            </div>
            {ingestEvents.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Upload a CSV under Analytics → Data Intelligence to populate this log.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-default)] text-[var(--text-muted)]">
                      <th className="py-2 pr-2">When</th>
                      <th className="py-2 pr-2">File</th>
                      <th className="py-2 pr-2">Schema</th>
                      <th className="py-2 pr-2 text-right">Rows</th>
                      <th className="py-2 pr-2 text-right">Skipped</th>
                      <th className="py-2 pr-2 text-right">Days</th>
                      <th className="py-2 pr-2 text-right">Warn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingestEvents.slice(0, 12).map((e) => (
                      <tr key={e.id} className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {new Date(e.at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-2 pr-2 max-w-[140px] truncate">{e.fileName ?? '—'}</td>
                        <td className="py-2 pr-2">{e.schema}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{e.rowCount}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{e.skippedRowCount}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{e.dailyDays}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{e.warnings.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">All decisions</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as DecisionStatus | 'all')}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>
            {filtered.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">No decisions in this filter.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {filtered.map((d) => (
                  <li key={d.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[var(--text-primary)]">{d.title}</p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">{d.rationale}</p>
                        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                          {d.priority} · {d.source.replace(/_/g, ' ')}
                          {d.linkedSignalId ? ` · signal ${d.linkedSignalId}` : ''} ·{' '}
                          {new Date(d.createdAt).toLocaleString('en-IN')}
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--text-ghost)]">
                          KPI snapshot: prime{' '}
                          {formatPercent(
                            d.metricsSnapshot.prime_cost ??
                              (Number(d.metricsSnapshot.food_cost) || 0) + (Number(d.metricsSnapshot.labor_cost) || 0)
                          )}
                          · food {formatPercent(Number(d.metricsSnapshot.food_cost) || 0)} · check{' '}
                          {formatCurrency(Number(d.metricsSnapshot.avg_check) || 0)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:items-end">
                        <select
                          value={d.status}
                          onChange={(e) => updateDecision(d.id, { status: e.target.value as DecisionStatus })}
                          className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
                          aria-label={`Status: ${d.title}`}
                        >
                          <option value="open">open</option>
                          <option value="in_progress">in progress</option>
                          <option value="done">done</option>
                          <option value="dropped">dropped</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeDecision(d.id)}
                          className="inline-flex items-center gap-1 text-xs text-[var(--red)] hover:underline"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-6 text-center text-xs text-[var(--text-ghost)]">
            Context: avg daily revenue {formatCurrency(avgDaily)}, WoW {wow >= 0 ? '+' : ''}
            {wow.toFixed(1)}%.
          </p>
        </main>
      </div>
    </ErrorBoundary>
  );
}
