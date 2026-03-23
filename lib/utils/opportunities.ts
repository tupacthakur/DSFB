import { BENCHMARKS, METRIC_LABELS } from '@/lib/symbolic/benchmarks';
import { getFinancialImpactNumber } from '@/lib/symbolic/engine';
import type { MetricKey } from '@/lib/symbolic/benchmarks';

export type EffortLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Opportunity {
  metric: MetricKey;
  label: string;
  current: number;
  ideal: number;
  weeklyImpactFormatted: string;
  weeklyImpactNumber: number;
  roiScore: number;
  effort: EffortLevel;
}

const EFFORT_BY_METRIC: Partial<Record<MetricKey, EffortLevel>> = {
  avg_check: 'LOW',
  food_cost: 'MEDIUM',
  table_turns: 'MEDIUM',
  repeat_rate: 'HIGH',
  labor_cost: 'MEDIUM',
  bev_margin: 'LOW',
  waste_pct: 'MEDIUM',
  prime_cost: 'MEDIUM',
  sat_score: 'MEDIUM',
  no_shows: 'MEDIUM',
};

function formatUpside(num: number): string {
  const abs = Math.abs(Math.round(num));
  return `+₹${abs.toLocaleString('en-IN')}/week`;
}

export function identifyOpportunities(
  metrics: Record<string, number>,
  weeklyRevenue: number,
  options?: { avgCheck?: number; seats?: number }
): Opportunity[] {
  if (!weeklyRevenue || weeklyRevenue === 0) return [];
  const avgCheck = options?.avgCheck ?? 28;
  const seats = options?.seats ?? 80;
  const opts = { avgCheck, seats };
  const results: Opportunity[] = [];
  for (const key of Object.keys(BENCHMARKS) as MetricKey[]) {
    const b = BENCHMARKS[key];
    const actual = metrics[key] ?? 0;
    if (b.higherIsBetter && actual >= b.ideal) continue;
    if (!b.higherIsBetter && actual <= b.ideal) continue;
    const gap = Math.abs(actual - b.ideal);
    if (gap <= 0) continue;
    const impactNum = getFinancialImpactNumber(key, actual, b.ideal, weeklyRevenue, opts);
    const upside = Math.abs(impactNum);
    if (upside <= 0) continue;
    const roiScore = gap > 0 ? upside / gap : 0;
    results.push({
      metric: key,
      label: METRIC_LABELS[key],
      current: actual,
      ideal: b.ideal,
      weeklyImpactFormatted: formatUpside(impactNum),
      weeklyImpactNumber: upside,
      roiScore,
      effort: EFFORT_BY_METRIC[key] ?? 'MEDIUM',
    });
  }
  results.sort((a, b) => b.roiScore - a.roiScore);
  return results.slice(0, 3);
}
