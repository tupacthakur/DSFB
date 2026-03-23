'use client';

import { useMemo, useEffect, useState } from 'react';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { computeHealthScore, getHealthScoreRationale } from '@/lib/utils/healthScore';
import { METRIC_LABELS } from '@/lib/symbolic/benchmarks';
import type { MetricKey } from '@/lib/symbolic/benchmarks';
import {
  HEALTH_SCORE_GRADE_BANDS,
  HEALTH_SCORE_METRIC_RULES,
  HEALTH_SCORE_SUMMARY,
} from '@/lib/executive/methodology';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

export function HealthScore() {
  const metrics = useMetricsStore((s) => s.metrics);
  const [mounted, setMounted] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  useEffect(() => setMounted(true), []);
  const result = useMemo(() => computeHealthScore(metrics as Record<string, number>), [metrics]);
  const { total, grade, breakdown, weakest, strongest } = result;
  const rationale = useMemo(() => getHealthScoreRationale(result), [result]);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (total / 100) * circumference;
  const ringColor = total >= 75 ? 'var(--green)' : total >= 50 ? 'var(--amber)' : 'var(--red)';

  return (
    <section className="executive-section card" style={{ padding: 24 }}>
      <div className="flex items-start justify-between gap-2 mb-4">
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
          Business Health Score
        </h2>
        <button
          type="button"
          onClick={() => setShowMethodology(!showMethodology)}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          aria-expanded={showMethodology}
        >
          <Info className="h-3.5 w-3.5" />
          {showMethodology ? (
            <>Hide logic <ChevronUp className="h-3.5 w-3.5" /></>
          ) : (
            <>How we score <ChevronDown className="h-3.5 w-3.5" /></>
          )}
        </button>
      </div>
      <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)] mb-4" style={{ maxWidth: '56ch' }}>
        {rationale}
      </p>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width={140} height={140} viewBox="0 0 140 140" style={{ overflow: 'visible' }}>
            <circle
              cx={70}
              cy={70}
              r={54}
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth={10}
            />
            <circle
              cx={70}
              cy={70}
              r={54}
              fill="none"
              stroke={ringColor}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={mounted ? offset : circumference}
              style={{
                transition: 'stroke-dashoffset 1.2s ease-out',
                transform: 'rotate(-90deg)',
                transformOrigin: '50% 50%',
              }}
            />
            <text
              x={70}
              y={68}
              textAnchor="middle"
              style={{
                fontFamily: 'var(--font-outfit), Outfit, sans-serif',
                fontSize: 48,
                fontWeight: 700,
                fill: 'var(--text-primary)',
              }}
            >
              {total}
            </text>
            <text
              x={70}
              y={92}
              textAnchor="middle"
              style={{ fontSize: 14, fill: 'var(--text-secondary)' }}
            >
              {grade}
            </text>
          </svg>
        </div>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          {Object.entries(breakdown).map(([key, b]) => {
            const label = METRIC_LABELS[key as MetricKey] ?? key;
            const pct = b.max > 0 ? (b.score / b.max) * 100 : 0;
            const barColor = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
            return (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {b.score} / {b.max} pts
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'var(--border-subtle)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: barColor,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Strengths: {strongest.map((k) => METRIC_LABELS[k as MetricKey] ?? k).join(', ')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>·</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Focus areas: {weakest.map((k) => METRIC_LABELS[k as MetricKey] ?? k).join(', ')}
        </span>
      </div>

      {showMethodology && (
        <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
          <p className="text-xs text-[var(--text-secondary)] leading-[1.6] mb-3">{HEALTH_SCORE_SUMMARY}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Grade bands</h3>
              <ul className="space-y-1.5">
                {HEALTH_SCORE_GRADE_BANDS.map((b) => (
                  <li key={b.range} className="text-xs text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">{b.range}</strong> {b.label}: {b.description}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Scoring rules (per metric)</h3>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {Object.entries(HEALTH_SCORE_METRIC_RULES).map(([key, rule]) => (
                  <li key={key} className="text-xs text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">{METRIC_LABELS[key as MetricKey] ?? key}</span> (max {rule.max} pts): {rule.logic}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
