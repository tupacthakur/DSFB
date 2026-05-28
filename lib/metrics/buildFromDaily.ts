import type { DailyMetric } from '@/lib/store/metricsStore';
import type { MetricKey } from '@/lib/symbolic/benchmarks';
import { safeDivide } from '@/lib/utils/math';
import type { CsvSchemaId } from '@/lib/parsers/csvToMetrics';

export interface MetricsBundle {
  daily: DailyMetric[];
  metrics: Partial<Record<MetricKey, number>>;
  priorMetrics: Partial<Record<MetricKey, number>>;
}

export function buildFromDaily(
  daily: DailyMetric[],
  schema: CsvSchemaId = 'rista_sales_audit'
): MetricsBundle {
  if (daily.length === 0) {
    return { daily: [], metrics: {}, priorMetrics: {} };
  }

  const isSwiggyAnnexure = schema === 'swiggy_annexure';
  const isRistaSalesAudit = schema === 'rista_sales_audit';

  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const totalCost = daily.reduce((s, d) => s + d.cost, 0);
  const totalCovers = daily.reduce((s, d) => s + d.covers, 0);
  const foodCostPct = safeDivide(totalCost, totalRevenue, 0) * 100;
  const avgCheck = safeDivide(totalRevenue, totalCovers, 0);
  const tableTurns = daily.length > 0 ? totalCovers / (daily.length * 80) : 0;
  const laborCostProxy = isSwiggyAnnexure ? 18 : 24;

  const mid = Math.floor(daily.length / 2);
  const prior = daily.slice(0, mid);
  const priorRev = prior.reduce((s, d) => s + d.revenue, 0);
  const priorCost = prior.reduce((s, d) => s + d.cost, 0);
  const priorFoodCostPct = safeDivide(priorCost, priorRev, 0) * 100;
  const priorCovers = prior.reduce((s, d) => s + d.covers, 0);
  const priorAvgCheck = safeDivide(priorRev, priorCovers, 0);
  const priorTableTurns = prior.length > 0 ? priorCovers / (prior.length * 80) : 0;

  const metrics: Partial<Record<MetricKey, number>> = {
    food_cost: Math.round(foodCostPct * 10) / 10,
    avg_check: Math.round(avgCheck * 10) / 10,
    labor_cost: laborCostProxy,
    prime_cost: Math.round((foodCostPct + laborCostProxy) * 10) / 10,
    table_turns: Math.round(tableTurns * 100) / 100,
    no_shows: 0,
    repeat_rate: 0,
    waste_pct: isRistaSalesAudit ? 3.5 : 1.5,
    bev_margin: isSwiggyAnnexure ? 58 : 64,
    sat_score: 4.5,
  };

  const priorMetrics: Partial<Record<MetricKey, number>> = {
    food_cost: Math.round(priorFoodCostPct * 10) / 10,
    avg_check: Math.round(priorAvgCheck * 10) / 10,
    labor_cost: laborCostProxy,
    prime_cost: Math.round((priorFoodCostPct + laborCostProxy) * 10) / 10,
    table_turns: Math.round(priorTableTurns * 100) / 100,
    no_shows: 0,
    repeat_rate: 0,
    waste_pct: isRistaSalesAudit ? 3.8 : 1.8,
    bev_margin: isSwiggyAnnexure ? 57 : 63,
    sat_score: 4.5,
  };

  return { daily, metrics, priorMetrics };
}
