import { RULES } from './rules';
import { traverseOntology } from './ontology';
import { BENCHMARKS } from './benchmarks';
import type { MetricKey } from './benchmarks';

export interface FiredRule {
  id: string;
  metric: string;
  op: '>' | '<';
  threshold: number;
  tag: string;
  confidence: number;
  actualValue: number;
}

export interface SymbolicResult {
  fired: FiredRule[];
  domains: string[];
  symCtx: string;
  confidence: number;
}

function buildSymbolicContext(fired: FiredRule[], domains: string[]): string {
  const lines: string[] = [];
  if (fired.length > 0) {
    lines.push('Fired rules:');
    fired.forEach((r) => {
      lines.push(`  [${r.id}] ${r.metric} ${r.op} ${r.threshold} (actual: ${r.actualValue}) — ${r.tag}`);
    });
  }
  if (domains.length > 0) {
    lines.push('Affected domains: ' + domains.join(', '));
  }
  return lines.join('\n');
}

function computeAggregateConfidence(fired: FiredRule[]): number {
  if (fired.length === 0) return 0;
  const sum = fired.reduce((s, r) => s + r.confidence, 0);
  return sum / fired.length;
}

/**
 * Evaluate all rules against current metrics. Used server-side for SAGE system prompt.
 */
export function evaluateRules(metrics: Record<string, number>): SymbolicResult {
  const fired: FiredRule[] = [];
  for (const rule of RULES) {
    const val = metrics[rule.metric];
    if (val == null || typeof val !== 'number') continue;
    const triggered =
      rule.op === '>' ? val > rule.threshold : val < rule.threshold;
    if (triggered) {
      fired.push({ ...rule, actualValue: val });
    }
  }
  const domains = traverseOntology(fired.map((r) => r.metric));
  const symCtx = buildSymbolicContext(fired, domains);
  const confidence = computeAggregateConfidence(fired);
  return { fired, domains, symCtx, confidence };
}

/**
 * Build metrics vs benchmarks table string for system prompt (truncatable).
 */
export function metricsVsBenchmarksTable(metrics: Record<string, number>): string {
  const lines: string[] = ['Metrics vs benchmarks:'];
  for (const key of Object.keys(BENCHMARKS) as MetricKey[]) {
    const b = BENCHMARKS[key];
    const v = metrics[key];
    if (v != null && b) {
      lines.push(`  ${key}: ${v} (ideal ${b.ideal}, warn ${b.warning}, crit ${b.critical})`);
    }
  }
  return lines.join('\n');
}

/**
 * Estimated weekly impact in rupees. Used in system prompt for quantified advice.
 * Indian context: amounts in ₹.
 */
export function computeFinancialImpact(
  metric: string,
  actual: number,
  ideal: number,
  weeklyRevenue: number,
  options?: { avgCheck?: number; seats?: number }
): string {
  if (!weeklyRevenue || weeklyRevenue === 0) return 'N/A';

  const delta = actual - ideal;
  let weeklyImpact = 0;
  const avgCheck = options?.avgCheck ?? 28;
  const seats = options?.seats ?? 80;

  switch (metric) {
    case 'food_cost':
      weeklyImpact = -(delta / 100) * weeklyRevenue;
      break;
    case 'labor_cost':
      weeklyImpact = -(delta / 100) * weeklyRevenue;
      break;
    case 'prime_cost':
      weeklyImpact = -(delta / 100) * weeklyRevenue;
      break;
    case 'bev_margin': {
      const bevRevenue = weeklyRevenue * 0.28;
      weeklyImpact = -(delta / 100) * bevRevenue;
      break;
    }
    case 'table_turns': {
      weeklyImpact = -delta * avgCheck * seats;
      break;
    }
    case 'avg_check': {
      const weeklyCovers = weeklyRevenue / (avgCheck || 1);
      weeklyImpact = delta * weeklyCovers;
      break;
    }
    case 'waste_pct': {
      const purchases = weeklyRevenue * 0.32;
      weeklyImpact = -(delta / 100) * purchases;
      break;
    }
    default:
      return 'N/A';
  }

  const absImpact = Math.abs(Math.round(weeklyImpact));
  const sign = weeklyImpact < 0 ? '-' : '+';
  return `${sign}₹${absImpact.toLocaleString('en-IN')}/week`;
}

/**
 * Returns numeric weekly impact (negative = cost, positive = upside) for sorting/comparison.
 */
export function getFinancialImpactNumber(
  metric: string,
  actual: number,
  ideal: number,
  weeklyRevenue: number,
  options?: { avgCheck?: number; seats?: number }
): number {
  if (!weeklyRevenue || weeklyRevenue === 0) return 0;
  const delta = actual - ideal;
  const avgCheck = options?.avgCheck ?? 28;
  const seats = options?.seats ?? 80;
  switch (metric) {
    case 'food_cost':
    case 'labor_cost':
    case 'prime_cost':
      return -(delta / 100) * weeklyRevenue;
    case 'bev_margin': {
      const bevRevenue = weeklyRevenue * 0.28;
      return -(delta / 100) * bevRevenue;
    }
    case 'table_turns':
      return -delta * avgCheck * seats;
    case 'avg_check': {
      const weeklyCovers = weeklyRevenue / (avgCheck || 1);
      return delta * weeklyCovers;
    }
    case 'waste_pct': {
      const purchases = weeklyRevenue * 0.32;
      return -(delta / 100) * purchases;
    }
    default:
      return 0;
  }
}
