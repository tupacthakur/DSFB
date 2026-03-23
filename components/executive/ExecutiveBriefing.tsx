'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { callSAGE, SAGEError } from '@/lib/api/sage';
import { buildDataContext } from '@/lib/context/dataContext';
import { useIngestedContextStore } from '@/lib/store/ingestedContextStore';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { RefreshCw, Copy, FileDown } from 'lucide-react';

export type ExecutivePeriod = 'week' | 'month' | 'quarter' | 'ytd';

const EXECUTIVE_BRIEFING_SYSTEM_ADDITION = (period: string) => `
Generate an executive briefing for the restaurant operator. Format it exactly as follows with these exact markdown headers:

## This ${period} at a Glance
3 sentences. Revenue, prime cost, and the single biggest risk. Include actual numbers.

## Top Priority
The single most important thing to address this week.
Show the formula, the current number, the target, and the weekly dollar impact of fixing it.

## Quick Win Available
The easiest improvement with positive ROI available right now. Be specific — what action, what metric, what expected result in what timeframe.

## Watch List
2 metrics that are approaching warning thresholds but have not breached yet. Frame as early warnings.

## One Benchmark to Know
A single industry comparison that contextualizes performance. Show the formula and the comparison.

Use actual metric values throughout. No vague language. Numbers and actions only. Use Indian Rupees (₹) for all amounts.`;

function sanitized(html: string): string {
  try {
    return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'code', 'pre'] });
  } catch {
    return html;
  }
}

interface ExecutiveBriefingProps {
  period: ExecutivePeriod;
}

const periodLabel: Record<ExecutivePeriod, string> = {
  week: 'week',
  month: 'month',
  quarter: 'quarter',
  ytd: 'YTD',
};

export function ExecutiveBriefing({ period }: ExecutiveBriefingProps) {
  const metrics = useMetricsStore((s) => s.metrics);
  const ingestedSummary = useIngestedContextStore((s) => s.summary);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBrief = useCallback(() => {
    setLoading(true);
    setError(null);
    setContent('');
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const rawMetrics = useMetricsStore.getState().metrics ?? {};
    const metricsPayload = Object.keys(rawMetrics).length > 0 ? rawMetrics : { food_cost: 30, labor_cost: 30 };
    const context = { dataContext: buildDataContext(), ingestedSummary: ingestedSummary ?? undefined };
    const systemAddition = EXECUTIVE_BRIEFING_SYSTEM_ADDITION(periodLabel[period]);
    callSAGE(
      {
        messages: [{ role: 'user', content: 'Generate the executive briefing now.' }],
        metrics: metricsPayload,
        sessionId: 'exec-brief-' + Date.now(),
        context,
        systemAddition,
      },
      {
        onToken: (token) => setContent((prev) => prev + token),
        onDone: () => {
          setLoading(false);
          setGeneratedAt(new Date());
        },
        onError: (err: SAGEError) => {
          setError(err.message);
          setLoading(false);
        },
      },
      abortRef.current.signal
    ).catch(() => {});
  }, [period, ingestedSummary]);

  useEffect(() => {
    fetchBrief();
    return () => abortRef.current?.abort();
  }, [period]);

  const handleCopy = useCallback(() => {
    if (content) navigator.clipboard.writeText(content);
  }, [content]);

  const handlePrint = useCallback(() => {
    document.documentElement.classList.add('print-mode');
    window.print();
    setTimeout(() => document.documentElement.classList.remove('print-mode'), 500);
  }, []);

  const parsedHtml = content ? sanitized(typeof marked.parse(content) === 'string' ? (marked.parse(content) as string) : String(marked.parse(content))) : '';

  return (
    <section className="executive-section card no-print" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h2
          className="executive-section-title"
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          SAGE Executive Briefing
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={fetchBrief}
            disabled={loading}
            className="flex items-center gap-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} style={{ width: 14, height: 14 }} />
            Regenerate Brief
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!content}
            className="flex items-center gap-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
          >
            <Copy style={{ width: 14, height: 14 }} />
            Copy to Clipboard
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!content}
            className="flex items-center gap-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
          >
            <FileDown style={{ width: 14, height: 14 }} />
            Export as PDF
          </button>
        </div>
      </div>
      {generatedAt && !loading && (
        <p style={{ fontSize: 12, color: 'var(--text-ghost)', marginBottom: 12 }}>
          Generated {generatedAt.toLocaleString()}
        </p>
      )}
      {error && (
        <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>{error}</p>
      )}
      {loading && !content && (
        <div className="executive-brief-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {['This period at a Glance', 'Top Priority', 'Quick Win Available', 'Watch List', 'One Benchmark to Know'].map((h) => (
            <div key={h}>
              <div style={{ height: 14, width: 180, background: 'var(--border-subtle)', borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 12, background: 'var(--border-subtle)', borderRadius: 4, width: '90%' }} />
              <div style={{ height: 12, background: 'var(--border-subtle)', borderRadius: 4, width: '70%', marginTop: 4 }} />
            </div>
          ))}
        </div>
      )}
      {content && (
        <div
          className="chat-markdown executive-brief-content"
          style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}
          dangerouslySetInnerHTML={{ __html: parsedHtml }}
        />
      )}
    </section>
  );
}
