/**
 * Parse CSV content into daily metrics and KPI metrics for the Executive dashboard.
 * Detects common column names (date, revenue, sales, cost, covers, etc.) and
 * aggregates by date so uploaded CSVs drive P&L Snapshot, Health Score, etc.
 */

import type { DailyMetric } from '@/lib/store/metricsStore';
import type { MetricKey } from '@/lib/symbolic/benchmarks';
import { safeDivide } from '@/lib/utils/math';

const DATE_COLUMN_NAMES = [
  'date',
  'day',
  'transaction date',
  'transaction_date',
  'order date',
  'order_date',
  'sale date',
  'sale_date',
  'created',
  'created_at',
  'created at',
];

const REVENUE_COLUMN_NAMES = [
  'revenue',
  'sales',
  'amount',
  'total',
  'gross sales',
  'gross_sales',
  'net sales',
  'net_sales',
  'value',
  'sum',
  'revenue (inr)',
  'sales (inr)',
];

const COST_COLUMN_NAMES = [
  'cost',
  'cost of goods',
  'cog',
  'food cost',
  'food_cost',
  'cogs',
  'total cost',
  'total_cost',
];

const COVERS_COLUMN_NAMES = ['covers', 'guests', 'orders', 'transactions', 'qty', 'quantity', 'count'];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const c of candidates) {
    const idx = normalized.findIndex((h) => h === c || h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseNumber(val: string): number {
  if (val == null || val === '') return 0;
  const s = String(val).replace(/[₹,\s]/g, '').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Try to parse a date string into YYYY-MM-DD */
function parseDate(val: string): string | null {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export interface CsvMetricsResult {
  daily: DailyMetric[];
  metrics: Partial<Record<MetricKey, number>>;
  priorMetrics: Partial<Record<MetricKey, number>>;
}

/**
 * Parse CSV text (with header row) into daily aggregates and derived metrics.
 * Uses first row as headers; detects date, revenue, cost, covers by common names.
 */
export function parseCsvToMetrics(csvText: string): CsvMetricsResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { daily: [], metrics: {}, priorMetrics: {} };
  }

  const headerLine = lines[0]!;
  const sep = headerLine.includes('\t') ? '\t' : ',';
  const headers = headerLine.split(sep).map((h) => h.trim());
  const dateIdx = findColumnIndex(headers, DATE_COLUMN_NAMES);
  const revenueIdx = findColumnIndex(headers, REVENUE_COLUMN_NAMES);
  const costIdx = findColumnIndex(headers, COST_COLUMN_NAMES);
  const coversIdx = findColumnIndex(headers, COVERS_COLUMN_NAMES);

  if (dateIdx < 0 || revenueIdx < 0) {
    return { daily: [], metrics: {}, priorMetrics: {} };
  }

  const byDate: Record<string, { revenue: number; cost: number; covers: number }> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(sep);
    const dateStr = parseDate(cols[dateIdx]);
    if (!dateStr) continue;
    const revenue = parseNumber(cols[revenueIdx] ?? '');
    const cost = costIdx >= 0 ? parseNumber(cols[costIdx] ?? '') : 0;
    const covers = coversIdx >= 0 ? Math.round(parseNumber(cols[coversIdx] ?? '')) : 0;

    const row = byDate[dateStr] ?? { revenue: 0, cost: 0, covers: 0 };
    row.revenue += revenue;
    row.cost += cost;
    row.covers += covers;
    byDate[dateStr] = row;
  }

  const daily: DailyMetric[] = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => {
      const revenue = row.revenue;
      const cost = row.cost;
      const covers = row.covers || (revenue > 0 ? Math.round(revenue / 28) : 0);
      const grossMarginPct = safeDivide(revenue - cost, revenue, 0) * 100;
      return { date, revenue, cost, covers, grossMarginPct };
    });

  if (daily.length === 0) {
    return { daily: [], metrics: {}, priorMetrics: {} };
  }

  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const totalCost = daily.reduce((s, d) => s + d.cost, 0);
  const totalCovers = daily.reduce((s, d) => s + d.covers, 0);
  const foodCostPct = safeDivide(totalCost, totalRevenue, 0) * 100;
  const grossMarginPct = safeDivide(totalRevenue - totalCost, totalRevenue, 0) * 100;
  const avgCheck = safeDivide(totalRevenue, totalCovers, 0);

  const mid = Math.floor(daily.length / 2);
  const recent = daily.slice(-Math.min(30, daily.length));
  const prior = daily.slice(0, mid);
  const recentRev = recent.reduce((s, d) => s + d.revenue, 0);
  const recentCost = recent.reduce((s, d) => s + d.cost, 0);
  const priorRev = prior.reduce((s, d) => s + d.revenue, 0);
  const priorCost = prior.reduce((s, d) => s + d.cost, 0);
  const priorFoodCostPct = safeDivide(priorCost, priorRev, 0) * 100;
  const priorCovers = prior.reduce((s, d) => s + d.covers, 0);
  const priorAvgCheck = safeDivide(priorRev, priorCovers, 0);

  const metrics: Partial<Record<MetricKey, number>> = {
    food_cost: Math.round(foodCostPct * 10) / 10,
    avg_check: Math.round(avgCheck * 10) / 10,
    prime_cost: Math.min(70, Math.round(foodCostPct + 28)), // assume ~28% labor if not in CSV
    labor_cost: 28,
  };
  const priorMetrics: Partial<Record<MetricKey, number>> = {
    food_cost: Math.round(priorFoodCostPct * 10) / 10,
    avg_check: Math.round(priorAvgCheck * 10) / 10,
    prime_cost: Math.min(70, Math.round(priorFoodCostPct + 28)),
    labor_cost: 28,
  };

  return { daily, metrics, priorMetrics };
}
