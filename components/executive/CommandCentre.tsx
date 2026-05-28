'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
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
import { Radio, ClipboardList, Database, ArrowRight, CircleDot } from 'lucide-react';

export function CommandCentre() {
  const decisions = useDecisionsStore((s) => s.decisions);
  const addDecision = useDecisionsStore((s) => s.addDecision);
  const updateDecision = useDecisionsStore((s) => s.updateDecision);
  const ingestEvents = useIngestionLogStore((s) => s.events);
  const metrics = useMetricsStore((s) => s.metrics);
  const restaurantName = useSettingsStore((s) => s.restaurantProfile?.name) ?? 'Restaurant';

  const [title, setTitle] = useState('');
  const [rationale, setRationale] = useState('');
  const [priority, setPriority] = useState<DecisionPriority>('high');

  const stats = useMemo(() => computeDecisionStats(decisions), [decisions]);
  const ing = useMemo(() => ingestionStats(ingestEvents), [ingestEvents]);
  const avgDaily = getAvgDailyRevenue();
  const wow = getWoWChangePct();

  const handleCommit = useCallback(() => {
    if (!title.trim()) return;
    addDecision({
      title: title.trim(),
      rationale: rationale.trim() || '—',
      priority,
      source: 'command_centre',
    });
    setTitle('');
    setRationale('');
    setPriority('high');
  }, [addDecision, title, rationale, priority]);

  const recent = decisions.slice(0, 5);

  return (
    <section
      className="executive-section command-centre card no-print relative overflow-hidden"
      style={{ padding: 24 }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(90deg, var(--border-default) 1px, transparent 1px),
            linear-gradient(var(--border-default) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              className="executive-section-title flex items-center gap-2"
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              <Radio className="h-4 w-4 text-[var(--green)]" aria-hidden />
              COMMAND CENTRE
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {restaurantName} · Commit decisions here; they sync to the{' '}
              <Link href="/decisions" className="text-[var(--green)] hover:underline">
                Decisions
              </Link>{' '}
              log and export reports.
            </p>
          </div>
          <Link
            href="/decisions"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--green)] hover:text-[var(--green)]"
          >
            Open full log
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Open decisions</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
              {stats.byStatus.open + stats.byStatus.in_progress}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Done (7d)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--green)]">{stats.completedThisWeek}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Prime cost</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
              {formatPercent((metrics.prime_cost ?? 0) || (metrics.food_cost ?? 0) + (metrics.labor_cost ?? 0))}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Ingest runs</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">{ing.runCount}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--green)]/25 bg-[var(--bg-elevated)] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
              <ClipboardList className="h-4 w-4 text-[var(--green)]" />
              New decision
            </div>
            <label className="block text-[11px] text-[var(--text-muted)]">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Freeze beverage promo until margin recovers"
              className="mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)]"
            />
            <label className="mt-2 block text-[11px] text-[var(--text-muted)]">Rationale & expected outcome</label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              placeholder="Why now, what changes, how we measure success…"
              className="mt-1 w-full resize-y rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-ghost)]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-[11px] text-[var(--text-muted)]">Priority</span>
              {(['high', 'medium', 'low'] as const).map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <input
                    type="radio"
                    name="cmd-priority"
                    checked={priority === p}
                    onChange={() => setPriority(p)}
                    className="accent-[var(--green)]"
                  />
                  {p}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCommit}
              disabled={!title.trim()}
              className="mt-3 w-full rounded-lg bg-[var(--green)] px-4 py-2.5 text-sm font-semibold text-[var(--bg-base)] hover:opacity-90 disabled:opacity-40"
            >
              Commit decision
            </button>
          </div>

          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
              <CircleDot className="h-4 w-4 text-[var(--amber)]" />
              Recent commits
            </div>
            {recent.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No decisions yet. Log one from here or from Action Center.</p>
            ) : (
              <ul className="space-y-2">
                {recent.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{d.title}</p>
                      <select
                        value={d.status}
                        onChange={(e) => updateDecision(d.id, { status: e.target.value as DecisionStatus })}
                        className="rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
                        aria-label={`Status for ${d.title}`}
                      >
                        <option value="open">open</option>
                        <option value="in_progress">in progress</option>
                        <option value="done">done</option>
                        <option value="dropped">dropped</option>
                      </select>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {d.priority} · {new Date(d.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {ing.last && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-[var(--border-subtle)] p-2 text-[11px] text-[var(--text-secondary)]">
                <Database className="h-4 w-4 shrink-0 text-[var(--text-muted)] mt-0.5" />
                <div>
                  <span className="font-medium text-[var(--text-primary)]">Pipeline</span>{' '}
                  Last CSV: {ing.last.schema}, {ing.last.dailyDays} days
                  {ing.last.warnings.length > 0 && (
                    <span className="text-[var(--amber)]"> · {ing.last.warnings.length} warning(s)</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-[var(--text-ghost)]">
          Live context: avg daily revenue {formatCurrency(avgDaily)}, WoW {wow >= 0 ? '+' : ''}
          {wow.toFixed(1)}%. New commits snapshot KPIs for audit.
        </p>
      </div>
    </section>
  );
}
