import type { MetricKey } from '@/lib/symbolic/benchmarks';

export interface HealthScoreBreakdown {
  score: number;
  max: number;
  pct: number;
}

export interface HealthScoreResult {
  total: number;
  grade: string;
  breakdown: Record<string, HealthScoreBreakdown>;
  weakest: string[];
  strongest: string[];
}

function scoreFoodCost(v: number): number {
  if (v <= 28) return 20;
  if (v <= 30) return 18;
  if (v <= 32) return 15;
  if (v <= 35) return 10;
  if (v <= 38) return 5;
  return 0;
}

function scoreLaborCost(v: number): number {
  if (v <= 28) return 20;
  if (v <= 30) return 18;
  if (v <= 32) return 15;
  if (v <= 35) return 10;
  if (v <= 38) return 5;
  return 0;
}

function scoreBevMargin(v: number): number {
  if (v >= 72) return 15;
  if (v >= 68) return 12;
  if (v >= 64) return 9;
  if (v >= 60) return 6;
  if (v >= 56) return 3;
  return 0;
}

function scoreSatScore(v: number): number {
  if (v >= 4.5) return 15;
  if (v >= 4.3) return 12;
  if (v >= 4.1) return 9;
  if (v >= 3.8) return 6;
  if (v >= 3.5) return 3;
  return 0;
}

function scoreWastePct(v: number): number {
  if (v <= 3) return 10;
  if (v <= 5) return 8;
  if (v <= 7) return 6;
  if (v <= 9) return 3;
  return 0;
}

function scoreTableTurns(v: number): number {
  if (v >= 3.5) return 10;
  if (v >= 3.0) return 8;
  if (v >= 2.5) return 6;
  if (v >= 2.0) return 3;
  return 0;
}

function scoreRepeatRate(v: number): number {
  if (v >= 50) return 10;
  if (v >= 40) return 8;
  if (v >= 35) return 6;
  if (v >= 28) return 3;
  return 0;
}

const SCORERS: Record<string, { max: number; fn: (v: number) => number }> = {
  food_cost: { max: 20, fn: scoreFoodCost },
  labor_cost: { max: 20, fn: scoreLaborCost },
  bev_margin: { max: 15, fn: scoreBevMargin },
  sat_score: { max: 15, fn: scoreSatScore },
  waste_pct: { max: 10, fn: scoreWastePct },
  table_turns: { max: 10, fn: scoreTableTurns },
  repeat_rate: { max: 10, fn: scoreRepeatRate },
};

export function computeHealthScore(metrics: Record<string, number>): HealthScoreResult {
  const breakdown: Record<string, HealthScoreBreakdown> = {};
  let total = 0;
  for (const [key, config] of Object.entries(SCORERS)) {
    const v = metrics[key] ?? 0;
    const score = config.fn(v);
    total += score;
    breakdown[key] = {
      score,
      max: config.max,
      pct: config.max > 0 ? (score / config.max) * 100 : 0,
    };
  }
  const entries = Object.entries(breakdown).sort((a, b) => a[1].score - b[1].score);
  const weakest = entries.slice(0, 3).map(([k]) => k);
  const strongest = entries.slice(-3).reverse().map(([k]) => k);
  let grade: string;
  if (total >= 90) grade = 'Exceptional';
  else if (total >= 75) grade = 'Strong';
  else if (total >= 60) grade = 'Developing';
  else if (total >= 45) grade = 'At Risk';
  else grade = 'Critical';
  return { total, grade, breakdown, weakest, strongest };
}

/** One-line reasoning for the current health score (for tooltips or explanation block). */
export function getHealthScoreRationale(result: HealthScoreResult): string {
  const { total, grade, weakest, strongest } = result;
  if (total >= 90) return 'All key drivers are at or above target; operations are exceptional.';
  if (total >= 75) return `Score is ${grade.toLowerCase()} (${total}/100). Strengths are solid; improving ${weakest.join(', ')} would push toward exceptional.`;
  if (total >= 60) return `Score is ${grade.toLowerCase()} (${total}/100). Focus on ${weakest.join(', ')} to reduce risk and move to strong.`;
  if (total >= 45) return `Score is ${grade.toLowerCase()} (${total}/100). Multiple areas need action; prioritize ${weakest.join(', ')} first.`;
  return `Score is ${grade.toLowerCase()} (${total}/100). Immediate focus on ${weakest.join(', ')}; consider operational review.`;
}
