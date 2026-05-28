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
Generate an executive briefing for the restaurant operator. Format it exactly as follows with these exact markdown headers (in this order):

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

## Liquidity Management
Address in one tight subsection (4–6 sentences, bullets allowed): payout timing (aggregators, vendors, payroll if inferrable), cash flow vs demand (inflows/outflows rhythm), and working capital risk. Use ₹. If the uploaded context lacks settlement or bank data, say exactly what is missing and what to start tracking.

## Inventory Analytics
Interpret inventory-linked performance: tie food cost, waste, and purchasing cadence to stock risk (overstock, spoilage, stockout). If no SKU-level inventory file is in context, infer cautiously from waste_pct, category P&L, and daily cost ratio—and state limitations.

## Sales Data Interpretation
Cover franchise or multi-unit rollup when the context suggests multiple sites or channels; otherwise state consolidated single-site view. Include cost per SKU vs selling price where menu/category data exists, margin by category, and transit or lead-time effects on margin (delivery commissions, supply delays) when inferrable from context.

## Bottom Line (Profit · Dispatch · Franchise · Timeframe)
Give an explicit expected-output block for the selected ${period}: profit or EBITDA-style margin proxy in ₹ and/or %, dispatch/third-party fee drag if data supports an estimate, franchise vs company-owned reporting caveat if relevant, and a clear timeframe label (this ${period}) with what "good" looks like numerically at period end.

## Checklist
5–7 markdown bullet items starting with "- [ ]" that the operator can execute this week. Each bullet must tie to a metric or ₹ impact already mentioned above.

## Timeline
Three subheadings as bold inline labels in one section: **This week** (2 bullets), **30 days** (2 bullets), **90 days** (2 bullets). Each bullet: action + expected measurable outcome.

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
  }, [fetchBrief]);

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
          {[
            'This period at a Glance',
            'Top Priority',
            'Quick Win Available',
            'Watch List',
            'One Benchmark to Know',
            'Liquidity Management',
            'Inventory Analytics',
            'Sales Data Interpretation',
            'Bottom Line (Profit · Dispatch · Franchise · Timeframe)',
            'Checklist',
            'Timeline',
          ].map((h) => (
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
