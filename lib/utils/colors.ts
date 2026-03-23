import type { MetricKey } from '@/lib/symbolic/benchmarks';
import { BENCHMARKS } from '@/lib/symbolic/benchmarks';

export type Severity = 'good' | 'warn' | 'crit';

export const SEV_COLOR: Record<Severity, string> = {
  good: 'var(--green)',
  warn: 'var(--amber)',
  crit: 'var(--red)',
};

/**
 * Compute severity from metric value vs benchmarks. Do not inline this logic.
 */
export function getSeverity(metric: MetricKey, value: number): Severity {
  const b = BENCHMARKS[metric];
  if (!b) return 'good';

  if (b.higherIsBetter) {
    if (value >= b.ideal) return 'good';
    if (value >= b.warning) return 'warn';
    return 'crit';
  }
  if (value <= b.ideal) return 'good';
  if (value <= b.warning) return 'warn';
  return 'crit';
}
