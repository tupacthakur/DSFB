'use client';

import { useMemo, useState } from 'react';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { getAvgDailyRevenue } from '@/lib/store/metricsStore';
import { evaluateRules } from '@/lib/symbolic/engine';
import { getFinancialImpactNumber } from '@/lib/symbolic/engine';
import { runForecast } from '@/lib/forecasting';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { OUTLOOK_METHODOLOGY } from '@/lib/executive/methodology';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

export type ExecutivePeriod = 'week' | 'month' | 'quarter' | 'ytd';

interface StrategicOutlookProps {
  period: ExecutivePeriod;
}

function confidenceFromMape(mape: number | null): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (mape == null) return 'MEDIUM';
  if (mape <= 10) return 'HIGH';
  if (mape <= 20) return 'MEDIUM';
  return 'LOW';
}

export function StrategicOutlook({ period }: StrategicOutlookProps) {
  const metrics = useMetricsStore((s) => s.metrics);
  const daily = useMetricsStore((s) => s.daily);
  const revenueSeries = useMemo(() => daily.map((d) => d.revenue), [daily]);
  const weeklyRevenue = getAvgDailyRevenue() * 7;
  const avgCheck = metrics.avg_check ?? 28;
  const seats = 80;

  const forecastWithWeekly = useMemo(() => {
    if (revenueSeries.length < 7) return null;
    const last28 = revenueSeries.slice(-28);
    const horizon = 28;
    const result = runForecast(last28, 'ensemble', 0.3, horizon, 1.645, { floorAtZero: true });
    const f = result.forecast;
    const u = result.upper;
    const l = result.lower;
    const start = f.findIndex((v) => Number.isFinite(v));
    if (start < 0) return null;
    const weekly: { lower: number; upper: number; rev: number }[] = [];
    for (let w = 0; w < 4; w++) {
      let rev = 0, lo = 0, hi = 0;
      for (let d = 0; d < 7; d++) {
        const i = start + w * 7 + d;
        if (i < f.length) {
          rev += f[i] ?? 0;
          lo += l[i] ?? 0;
          hi += u[i] ?? 0;
        }
      }
      weekly.push({ lower: lo, upper: hi, rev });
    }
    return { ...result, weekly };
  }, [revenueSeries]);
  const forecast = forecastWithWeekly;

  const symbolic = useMemo(() => evaluateRules(metrics as Record<string, number>), [metrics]);
  const topRiskImpact = useMemo(() => {
    if (symbolic.fired.length === 0) return 0;
    const withImpact = symbolic.fired.map((r) => {
      const ideal = 28;
      return Math.abs(getFinancialImpactNumber(r.metric, r.actualValue, ideal, weeklyRevenue, { avgCheck, seats }));
    });
    return Math.max(0, ...withImpact);
  }, [symbolic.fired, weeklyRevenue, avgCheck, seats]);
  const allActionsImpact = useMemo(() => {
    let sum = 0;
    for (const r of symbolic.fired) {
      const ideal = 28;
      sum += Math.abs(getFinancialImpactNumber(r.metric, r.actualValue, ideal, weeklyRevenue, { avgCheck, seats }));
    }
    return sum;
  }, [symbolic.fired, weeklyRevenue, avgCheck, seats]);

  const weeks = useMemo(() => {
    if (!forecast?.weekly) return [];
    const mape = forecast.mape;
    return forecast.weekly.map((w, i) => ({
      label: `Week ${i + 1}`,
      lower: w.lower,
      upper: w.upper,
      rev: w.rev,
      confidence: confidenceFromMape(mape),
    }));
  }, [forecast]);

  const primeCostPct = (metrics.food_cost ?? 0) + (metrics.labor_cost ?? 0);
  const ebitdaPct = 100 - primeCostPct - 14;
  const total30DayRevenue = useMemo(() => {
    if (!forecast?.weekly) return weeklyRevenue * 4;
    return forecast.weekly.reduce((s, w) => s + w.rev, 0);
  }, [forecast, weeklyRevenue]);
  const scenarioDoNothing = { revenue: total30DayRevenue, primeCost: primeCostPct, ebitda: ebitdaPct };
  const scenarioTopPriority = {
    revenue: scenarioDoNothing.revenue + topRiskImpact * 4,
    primeCost: Math.max(0, primeCostPct - 2),
    ebitda: Math.min(100, ebitdaPct + 3),
  };
  const scenarioAll = {
    revenue: scenarioDoNothing.revenue + allActionsImpact * 4,
    primeCost: Math.max(0, primeCostPct - 4),
    ebitda: Math.min(100, ebitdaPct + 5),
  };

  const [showLogic, setShowLogic] = useState(false);

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
          30-Day Strategic Outlook
        </h2>
        <button
          type="button"
          onClick={() => setShowLogic(!showLogic)}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          aria-expanded={showLogic}
        >
          <Info className="h-3.5 w-3.5" />
          {showLogic ? <>Hide logic <ChevronUp className="h-3.5 w-3.5" /></> : <>How we project <ChevronDown className="h-3.5 w-3.5" /></>}
        </button>
      </div>
      {showLogic && (
        <div className="mb-4 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-3">
          <p className="text-xs text-[var(--text-secondary)] leading-[1.6]"><strong className="text-[var(--text-primary)]">Confidence:</strong> {OUTLOOK_METHODOLOGY.confidence}</p>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Scenarios</h3>
            <ul className="text-xs text-[var(--text-secondary)] leading-[1.6] space-y-1">
              <li><strong className="text-[var(--text-primary)]">Do nothing:</strong> {OUTLOOK_METHODOLOGY.scenarios.doNothing}</li>
              <li><strong className="text-[var(--text-primary)]">Fix top priority:</strong> {OUTLOOK_METHODOLOGY.scenarios.fixTopPriority}</li>
              <li><strong className="text-[var(--text-primary)]">All actions:</strong> {OUTLOOK_METHODOLOGY.scenarios.allActions}</li>
            </ul>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {weeks.map((w) => (
          <div
            key={w.label}
            style={{
              padding: 16,
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{w.label}</div>
            <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
              {formatCurrency(w.lower)} – {formatCurrency(w.upper)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-ghost)', marginTop: 4 }}>Prime cost: —</div>
            <div style={{ fontSize: 10, color: 'var(--text-ghost)', marginTop: 2 }}>
              Confidence: {w.confidence}
            </div>
          </div>
        ))}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Scenario</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>30-Day Revenue</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Prime Cost</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>EBITDA</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>Do nothing</td>
            <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-primary)' }}>{formatCurrency(scenarioDoNothing.revenue)}</td>
            <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-primary)' }}>{formatPercent(scenarioDoNothing.primeCost)}</td>
            <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-primary)' }}>{formatPercent(scenarioDoNothing.ebitda)}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>Fix top priority</td>
            <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-primary)' }}>{formatCurrency(scenarioTopPriority.revenue)}</td>
            <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-primary)' }}>{formatPercent(scenarioTopPriority.primeCost)}</td>
            <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-primary)' }}>{formatPercent(scenarioTopPriority.ebitda)}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>All actions</td>
            <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-primary)' }}>{formatCurrency(scenarioAll.revenue)}</td>
            <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-primary)' }}>{formatPercent(scenarioAll.primeCost)}</td>
            <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-primary)' }}>{formatPercent(scenarioAll.ebitda)}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: 'var(--text-ghost)', marginTop: 12 }}>
        {OUTLOOK_METHODOLOGY.disclaimer}
      </p>
    </section>
  );
}
