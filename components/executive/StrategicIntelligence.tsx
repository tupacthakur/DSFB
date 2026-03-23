'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { evaluateRules } from '@/lib/symbolic/engine';
import { computeFinancialImpact, getFinancialImpactNumber } from '@/lib/symbolic/engine';
import { BENCHMARKS, METRIC_UNITS } from '@/lib/symbolic/benchmarks';
import { identifyOpportunities } from '@/lib/utils/opportunities';
import { getAvgDailyRevenue } from '@/lib/store/metricsStore';
import { METRIC_LABELS } from '@/lib/symbolic/benchmarks';
import { STRATEGIC_INTEL_METHODOLOGY } from '@/lib/executive/methodology';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

function humanizeTag(tag: string): string {
  return tag
    .replace(/^ALERT:/i, '')
    .replace(/^CRITICAL:/i, '')
    .replace(/^PRIORITY:/i, '')
    .replace(/^SUGGEST:/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeSensitivity(confidence: number, tag: string): 'IMMEDIATE' | 'THIS WEEK' | 'THIS MONTH' {
  if (tag.startsWith('CRITICAL:') || confidence >= 0.98) return 'IMMEDIATE';
  if (tag.startsWith('ALERT:') || tag.startsWith('PRIORITY:') || confidence >= 0.85) return 'THIS WEEK';
  return 'THIS MONTH';
}

export function StrategicIntelligence() {
  const metrics = useMetricsStore((s) => s.metrics);
  const profile = useSettingsStore((s) => s.restaurantProfile);
  const weeklyRevenue = useMemo(() => {
    const daily = getAvgDailyRevenue();
    return daily * 7;
  }, []);
  const avgCheck = metrics.avg_check ?? 28;
  const seats = profile?.seatingCapacity ?? 80;
  const opts = { avgCheck, seats };
  const symbolic = useMemo(() => evaluateRules(metrics as Record<string, number>), [metrics]);
  const risksWithImpact = useMemo(() => {
    return symbolic.fired
      .map((r) => {
        const ideal = BENCHMARKS[r.metric as keyof typeof BENCHMARKS]?.ideal ?? 0;
        const impactStr = computeFinancialImpact(r.metric, r.actualValue, ideal, weeklyRevenue, opts);
        const impactNum = Math.abs(getFinancialImpactNumber(r.metric, r.actualValue, ideal, weeklyRevenue, opts));
        return {
          ...r,
          impactStr,
          impactNum,
          timeBadge: timeSensitivity(r.confidence, r.tag),
        };
      })
      .sort((a, b) => b.impactNum - a.impactNum);
  }, [symbolic.fired, weeklyRevenue, opts.avgCheck, opts.seats]);
  const opportunities = useMemo(
    () => identifyOpportunities(metrics as Record<string, number>, weeklyRevenue, opts),
    [metrics, weeklyRevenue, opts.avgCheck, opts.seats]
  );

  const [showMethodology, setShowMethodology] = useState(false);

  return (
    <section className="executive-section card" style={{ padding: 24 }}>
      <div className="flex items-center justify-between gap-2 mb-4">
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
          Strategic Alerts & Opportunities
        </h2>
        <button
          type="button"
          onClick={() => setShowMethodology(!showMethodology)}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          aria-expanded={showMethodology}
        >
          <Info className="h-3.5 w-3.5" />
          {showMethodology ? <>Hide logic <ChevronUp className="h-3.5 w-3.5" /></> : <>How we calculate <ChevronDown className="h-3.5 w-3.5" /></>}
        </button>
      </div>
      {showMethodology && (
        <div className="mb-4 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-3">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">{STRATEGIC_INTEL_METHODOLOGY.risks.title}</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-[1.6]">{STRATEGIC_INTEL_METHODOLOGY.risks.body}</p>
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">{STRATEGIC_INTEL_METHODOLOGY.opportunities.title}</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-[1.6]">{STRATEGIC_INTEL_METHODOLOGY.opportunities.body}</p>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: 'rgba(248, 113, 113, 0.06)',
            border: '1px solid rgba(248, 113, 113, 0.2)',
          }}
        >
          <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', marginBottom: 12 }}>Risks</h3>
          {risksWithImpact.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No critical alerts.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {risksWithImpact.map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {humanizeTag(r.tag)}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {r.metric} at {r.actualValue} (threshold: {r.op} {r.threshold})
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                    {r.impactStr} if unaddressed
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'var(--red)',
                        color: 'var(--bg-base)',
                      }}
                    >
                      {r.timeBadge}
                    </span>
                    <Link
                      href={`/chat?q=${encodeURIComponent(`Diagnose the ${humanizeTag(r.tag)} issue and give me a specific action plan`)}`}
                      className="text-xs font-medium"
                      style={{ color: 'var(--green)' }}
                    >
                      Ask SAGE
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: 'rgba(99, 215, 146, 0.06)',
            border: '1px solid rgba(99, 215, 146, 0.2)',
          }}
        >
          <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 12 }}>Opportunities</h3>
          {opportunities.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No opportunities identified.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {opportunities.map((o) => (
                <li
                  key={o.metric}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Improve {o.label}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Current: {o.current.toFixed(1)}{METRIC_UNITS[o.metric] ?? '%'} → Target: {o.ideal}{METRIC_UNITS[o.metric] ?? '%'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>
                    {o.weeklyImpactFormatted} if achieved
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{o.effort} effort</span>
                    <Link
                      href={`/chat?q=${encodeURIComponent(`Create a specific 30-day action plan to improve ${o.label} from ${o.current.toFixed(1)} to ${o.ideal}. Show me week by week steps.`)}`}
                      className="text-xs font-medium"
                      style={{ color: 'var(--green)' }}
                    >
                      Build Plan
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
