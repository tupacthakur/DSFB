/**
 * F&B benchmark values for all metrics. Used for severity and rule evaluation.
 * ideal = green, warning = amber, critical = red.
 */

export type MetricKey =
  | 'food_cost'
  | 'labor_cost'
  | 'bev_margin'
  | 'table_turns'
  | 'avg_check'
  | 'waste_pct'
  | 'prime_cost'
  | 'sat_score'
  | 'no_shows'
  | 'repeat_rate';

export interface BenchmarkLevels {
  ideal: number;
  warning: number;
  critical: number;
  /** true = higher is better (e.g. margin, sat_score) */
  higherIsBetter: boolean;
}

export const BENCHMARKS: Record<MetricKey, BenchmarkLevels> = {
  food_cost:    { ideal: 28, warning: 35, critical: 40, higherIsBetter: false },
  labor_cost:   { ideal: 28, warning: 32, critical: 38, higherIsBetter: false },
  bev_margin:   { ideal: 68, warning: 62, critical: 55, higherIsBetter: true },
  table_turns:  { ideal: 3,   warning: 2.5, critical: 2, higherIsBetter: true },
  avg_check:    { ideal: 28, warning: 24, critical: 20, higherIsBetter: true },
  waste_pct:    { ideal: 4,  warning: 7,  critical: 10, higherIsBetter: false },
  prime_cost:   { ideal: 55, warning: 65, critical: 70, higherIsBetter: false },
  sat_score:    { ideal: 4.5, warning: 4.1, critical: 3.5, higherIsBetter: true },
  no_shows:     { ideal: 6,  warning: 12, critical: 18, higherIsBetter: false },
  repeat_rate:  { ideal: 45, warning: 35, critical: 25, higherIsBetter: true },
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  food_cost:    'Food Cost %',
  labor_cost:   'Labor Cost %',
  bev_margin:   'Bev Margin %',
  table_turns:  'Table Turns',
  avg_check:    'Avg Check',
  waste_pct:    'Waste %',
  prime_cost:   'Prime Cost %',
  sat_score:    'Satisfaction',
  no_shows:     'No-Shows %',
  repeat_rate:  'Repeat Rate %',
};

export const METRIC_UNITS: Record<MetricKey, string> = {
  food_cost:    '%',
  labor_cost:   '%',
  bev_margin:   '%',
  table_turns:  '',
  avg_check:    '',
  waste_pct:    '%',
  prime_cost:   '%',
  sat_score:    '/5',
  no_shows:     '%',
  repeat_rate:  '%',
};

/** Severity from benchmark levels: ok, warn, or crit. */
export function getSev(metricKey: MetricKey, actual: number): 'ok' | 'warn' | 'crit' {
  const b = BENCHMARKS[metricKey];
  if (!b) return 'ok';
  const { ideal, warning, critical, higherIsBetter } = b;
  if (higherIsBetter) {
    if (actual >= ideal) return 'ok';
    if (actual >= critical) return 'warn';
    return 'crit';
  }
  if (actual <= ideal) return 'ok';
  if (actual <= warning) return 'warn';
  return 'crit';
}
