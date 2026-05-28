'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useMetricsStore, getAvgDailyRevenue, getWoWChangePct, getAvgGrossMarginPct } from '@/lib/store/metricsStore';
import { useChatStore } from '@/lib/store/chatStore';
import { useIngestedContextStore } from '@/lib/store/ingestedContextStore';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { buildDataContext } from '@/lib/context/dataContext';
import { getKpiInsights, type KpiInsight } from '@/lib/insights/kpiInsights';
import { MessageCircle, Lightbulb, RefreshCw } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import type { SageInsightItem } from '@/lib/api/sage';

const CHAT_SUMMARY_MAX_MESSAGES = 30;
const CHAT_SUMMARY_MAX_CHARS = 1500;

function buildChatSummary(): string {
  try {
    const { sessions } = useChatStore.getState();
    const allAssistantMessages: string[] = [];
    for (const session of sessions) {
      for (const msg of session.messages) {
        if (msg.role === 'assistant' && msg.content?.trim()) {
          allAssistantMessages.push(msg.content.trim());
        }
      }
    }
    const recent = allAssistantMessages.slice(-CHAT_SUMMARY_MAX_MESSAGES);
    const joined = recent.join(' ');
    return joined.slice(-CHAT_SUMMARY_MAX_CHARS);
  } catch {
    return '';
  }
}

export default function InsightsPage() {
  const metrics = useMetricsStore((s) => s.metrics);
  const ingestedSummary = useIngestedContextStore((s) => s.summary);
  const keyConfigured = useSettingsStore((s) => s.keyConfigured);
  const { keySource, anthropicKey } = useSettingsStore();

  const avgMarginPct = useMemo(() => getAvgGrossMarginPct(), []);
  const wowPct = useMemo(() => getWoWChangePct(), []);
  const foodCostPct = Number(metrics?.food_cost) ?? 30;

  const kpiInsights = useMemo(
    () => getKpiInsights(avgMarginPct, wowPct, foodCostPct),
    [avgMarginPct, wowPct, foodCostPct]
  );

  const [sageInsights, setSageInsights] = useState<SageInsightItem[]>([]);
  const [sageLoading, setSageLoading] = useState(false);
  const [sageError, setSageError] = useState<string | null>(null);

  const fetchSageInsights = useCallback(async () => {
    if (!keyConfigured) {
      setSageInsights([]);
      return;
    }
    setSageLoading(true);
    setSageError(null);
    try {
      const dataContext = buildDataContext();
      const chatSummary = buildChatSummary();
      const rawMetrics = useMetricsStore.getState().metrics ?? {};
      const metricsPayload = Object.keys(rawMetrics).length > 0 ? rawMetrics : undefined;

      const body: Record<string, unknown> = {
        dataContext: dataContext || undefined,
        ingestedSummary: ingestedSummary || undefined,
        chatSummary: chatSummary || undefined,
        metrics: metricsPayload,
      };
      if (keySource === 'settings' && anthropicKey?.trim()) {
        body.clientApiKey = anthropicKey.trim();
      }

      const res = await fetch('/api/sage/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSageError(data.message ?? 'Failed to load insights');
        setSageInsights([]);
        return;
      }
      const data = (await res.json()) as { insights?: SageInsightItem[] };
      setSageInsights(Array.isArray(data.insights) ? data.insights : []);
    } catch (e) {
      setSageError(e instanceof Error ? e.message : 'Network error');
      setSageInsights([]);
    } finally {
      setSageLoading(false);
    }
  }, [keyConfigured, keySource, anthropicKey, ingestedSummary]);

  useEffect(() => {
    fetchSageInsights();
  }, [fetchSageInsights]);

  return (
    <ErrorBoundary level="page">
      <div className="min-h-screen bg-[var(--bg-base)]">
        <header className="border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href="/" className="text-base font-semibold text-[var(--text-primary)] sm:text-lg hover:text-[var(--green)] transition-colors">
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
              <Link href="/decisions" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)]">
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

        <main className="mx-auto max-w-4xl px-3 py-6 sm:px-4">
          <section className="info-banner mb-5">
            <p className="text-sm font-medium text-[var(--text-primary)]">Insight feed</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              KPI insights are deterministic from your metrics. SAGE insights combine KPI state, uploaded data context, and recent chat.
            </p>
          </section>
          <h1 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">Insights</h1>
          <p className="mb-6 text-sm text-[var(--text-muted)]">
            KPI-based insights and SAGE-generated insights from your current data and chat context.
          </p>

          {/* KPI-based insights (fault-driven; only show when something is off) */}
          <section className="mb-10">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <Lightbulb className="h-4 w-4" />
              From your KPIs
            </h2>
            {kpiInsights.length === 0 ? (
              <p className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-muted)]">
                No KPI issues right now — margin, revenue, and food cost are within target.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(kpiInsights as KpiInsight[]).map((insight) => (
                  <div key={insight.id} className="surface-card tap-feedback p-4">
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
          </section>

          {/* SAGE context-aware insights */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <MessageCircle className="h-4 w-4" />
              From SAGE & your chats
            </h2>
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              Generated from your current metrics, uploaded data, and recent SAGE conversations. Updates when you refresh.
            </p>

            {!keyConfigured ? (
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 text-sm text-[var(--text-secondary)]">
                Add your Anthropic API key in Settings to see SAGE-generated insights.
              </div>
            ) : sageLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-muted)]">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating insights…
              </div>
            ) : sageError ? (
              <div className="rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/10 p-4 text-sm text-[var(--red)]">
                {sageError}
                <button
                  type="button"
                  onClick={fetchSageInsights}
                  className="ml-2 font-medium underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            ) : sageInsights.length === 0 ? (
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-muted)]">
                No SAGE insights yet. Start a conversation in SAGE Chat, then refresh this page.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={fetchSageInsights}
                  disabled={sageLoading}
                  className="mb-3 flex items-center gap-1.5 text-xs font-medium text-[var(--green)] hover:underline disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh insights
                </button>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sageInsights.map((insight, idx) => (
                    <div key={idx} className="surface-card tap-feedback p-4">
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
              </>
            )}
          </section>
        </main>
      </div>
    </ErrorBoundary>
  );
}
