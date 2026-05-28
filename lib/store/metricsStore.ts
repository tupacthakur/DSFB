import { create } from 'zustand';
import type { MetricKey } from '@/lib/symbolic/benchmarks';
import { safeDivide } from '@/lib/utils/math';

export interface MetricSparkline {
  value: number;
}

export interface DailyMetric {
  date: string;
  revenue: number;
  cost: number;
  covers: number;
  grossMarginPct: number;
}

export interface RadarAxis {
  name: string;
  yourScore: number;
  benchmark: number;
}

export type QuadrantKey = 'stars' | 'puzzles' | 'plowhorses' | 'dogs';

export interface MenuScatterItem {
  id: string;
  name: string;
  covers: number;
  marginPct: number;
  revenue: number;
  quadrant: QuadrantKey;
}

export type MenuCategory = 'Mains' | 'Starters' | 'Desserts' | 'Beverages' | 'Specials';

export interface MenuItemForEngineering extends MenuScatterItem {
  category: MenuCategory;
  trendWoW: number;
  sparkline7: number[];
  foodCostPct: number;
}

export interface CategoryPLRow {
  category: string;
  revenue: number;
  cost: number;
  marginPct: number;
}

export interface MetricsState {
  metrics: Record<MetricKey, number>;
  priorMetrics: Record<MetricKey, number>;
  sparklines: Record<MetricKey, number[]>;
  daily: DailyMetric[];
  revenueRolling7: number[];
  radar: RadarAxis[];
  menuItems: MenuScatterItem[];
  avgVolumeThreshold: number;
  targetMargin: number;
  menuItemsForEngineering: MenuItemForEngineering[];
  categoryPL: CategoryPLRow[];
  flaggedItemIds: string[];
  flaggedForecastDates: string[];
  budgetTargets: Partial<Record<string, number>>;
}

export interface MetricsActions {
  setFlagForReview: (id: string, flag: boolean) => void;
  setFlaggedForecastDate: (date: string, flag: boolean) => void;
  setBudgetTarget: (metricKey: string, value: number | null) => void;
  setDaily: (daily: DailyMetric[]) => void;
  setMetrics: (metrics: Partial<Record<MetricKey, number>>) => void;
  setPriorMetrics: (prior: Partial<Record<MetricKey, number>>) => void;
}

const EMPTY_METRICS: Record<MetricKey, number> = {
  food_cost: 0,
  labor_cost: 0,
  bev_margin: 0,
  table_turns: 0,
  avg_check: 0,
  waste_pct: 0,
  prime_cost: 0,
  sat_score: 0,
  no_shows: 0,
  repeat_rate: 0,
};

function rolling7(daily: DailyMetric[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < daily.length; i++) {
    const start = Math.max(0, i - 6);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= i; j++) {
      sum += daily[j].revenue;
      count++;
    }
    out.push(count ? sum / count : 0);
  }
  return out;
}

function buildSparklineFromDaily(daily: DailyMetric[], key: MetricKey): number[] {
  if (daily.length === 0) return [];
  switch (key) {
    case 'food_cost':
      return daily.map((d) => safeDivide(d.cost, d.revenue, 0) * 100).slice(-30);
    case 'prime_cost':
      return daily.map((d) => safeDivide(d.cost, d.revenue, 0) * 100 + 24).slice(-30);
    case 'avg_check':
      return daily.map((d) => safeDivide(d.revenue, d.covers, 0)).slice(-30);
    case 'table_turns':
      return daily.map((d) => safeDivide(d.covers, 80, 0)).slice(-30);
    case 'waste_pct':
      return daily.map(() => 0).slice(-30);
    case 'labor_cost':
      return daily.map(() => 24).slice(-30);
    case 'bev_margin':
      return daily.map((d) => Math.max(0, Math.min(100, d.grossMarginPct - 8))).slice(-30);
    case 'sat_score':
      return daily.map(() => 4.2).slice(-30);
    case 'no_shows':
      return daily.map(() => 0).slice(-30);
    case 'repeat_rate':
      return daily.map(() => 0).slice(-30);
    default:
      return [];
  }
}

function buildDerivedState(daily: DailyMetric[], metrics: Record<MetricKey, number>) {
  const revenueRolling7 = rolling7(daily);
  const sparklines = {
    food_cost: buildSparklineFromDaily(daily, 'food_cost'),
    labor_cost: buildSparklineFromDaily(daily, 'labor_cost'),
    bev_margin: buildSparklineFromDaily(daily, 'bev_margin'),
    table_turns: buildSparklineFromDaily(daily, 'table_turns'),
    avg_check: buildSparklineFromDaily(daily, 'avg_check'),
    waste_pct: buildSparklineFromDaily(daily, 'waste_pct'),
    prime_cost: buildSparklineFromDaily(daily, 'prime_cost'),
    sat_score: buildSparklineFromDaily(daily, 'sat_score'),
    no_shows: buildSparklineFromDaily(daily, 'no_shows'),
    repeat_rate: buildSparklineFromDaily(daily, 'repeat_rate'),
  } satisfies Record<MetricKey, number[]>;
  const radar: RadarAxis[] = [
    { name: 'Margin', yourScore: Number(metrics.bev_margin) || 0, benchmark: 70 },
    { name: 'Prime Cost', yourScore: Math.max(0, 100 - (Number(metrics.prime_cost) || 0)), benchmark: 40 },
    { name: 'Avg Check', yourScore: Math.min(100, (Number(metrics.avg_check) || 0) / 5), benchmark: 40 },
    { name: 'Table Turns', yourScore: Math.min(100, (Number(metrics.table_turns) || 0) * 25), benchmark: 75 },
    { name: 'Repeat Rate', yourScore: Number(metrics.repeat_rate) || 0, benchmark: 40 },
    { name: 'Satisfaction', yourScore: Math.min(100, ((Number(metrics.sat_score) || 0) / 5) * 100), benchmark: 84 },
  ];
  return {
    sparklines,
    revenueRolling7,
    radar,
    menuItems: [] as MenuScatterItem[],
    avgVolumeThreshold: 100,
    targetMargin: 68,
    menuItemsForEngineering: [] as MenuItemForEngineering[],
    categoryPL: [] as CategoryPLRow[],
  };
}

export const useMetricsStore = create<MetricsState & MetricsActions>((set) => ({
  metrics: { ...EMPTY_METRICS },
  priorMetrics: { ...EMPTY_METRICS },
  sparklines: buildDerivedState([], EMPTY_METRICS).sparklines,
  daily: [],
  revenueRolling7: [],
  radar: buildDerivedState([], EMPTY_METRICS).radar,
  menuItems: [],
  avgVolumeThreshold: 100,
  targetMargin: 68,
  menuItemsForEngineering: [],
  categoryPL: [],
  flaggedItemIds: [],
  flaggedForecastDates: [],
  budgetTargets: {},
  setFlagForReview: (id, flag) =>
    set((s) => ({
      flaggedItemIds: flag ? [...s.flaggedItemIds, id] : s.flaggedItemIds.filter((x) => x !== id),
    })),
  setFlaggedForecastDate: (date, flag) =>
    set((s) => ({
      flaggedForecastDates: flag ? [...s.flaggedForecastDates, date] : s.flaggedForecastDates.filter((x) => x !== date),
    })),
  setBudgetTarget: (metricKey, value) =>
    set((s) => {
      const next = { ...s.budgetTargets };
      if (value == null) delete next[metricKey];
      else next[metricKey] = value;
      return { budgetTargets: next };
    }),
  setDaily: (daily) =>
    set((s) => {
      const nextDaily = daily.length ? daily : s.daily;
      const derived = buildDerivedState(nextDaily, s.metrics);
      return {
        daily: nextDaily,
        revenueRolling7: derived.revenueRolling7,
        sparklines: derived.sparklines,
        radar: derived.radar,
        menuItems: derived.menuItems,
        menuItemsForEngineering: derived.menuItemsForEngineering,
        categoryPL: derived.categoryPL,
      };
    }),
  setMetrics: (metrics) =>
    set((s) => {
      const nextMetrics = { ...s.metrics, ...metrics };
      const derived = buildDerivedState(s.daily, nextMetrics);
      return {
        metrics: nextMetrics,
        sparklines: derived.sparklines,
        radar: derived.radar,
        menuItems: derived.menuItems,
        menuItemsForEngineering: derived.menuItemsForEngineering,
        categoryPL: derived.categoryPL,
      };
    }),
  setPriorMetrics: (prior) =>
    set((s) => ({
      priorMetrics: { ...s.priorMetrics, ...prior },
    })),
}));

export function getDeltaPct(metric: MetricKey): number | null {
  const state = useMetricsStore.getState();
  const curr = state.metrics[metric];
  const prior = state.priorMetrics[metric];
  if (prior === 0) return null;
  return safeDivide(curr - prior, prior, 0) * 100;
}

export function getWoWChangePct(): number {
  const daily = useMetricsStore.getState().daily;
  if (daily.length < 14) return 0;
  const thisWeek = daily.slice(-7).reduce((s, d) => s + d.revenue, 0);
  const lastWeek = daily.slice(-14, -7).reduce((s, d) => s + d.revenue, 0);
  if (lastWeek === 0) return 0;
  return safeDivide(thisWeek - lastWeek, lastWeek, 0) * 100;
}

export function getMoMChangePct(): number {
  const daily = useMetricsStore.getState().daily;
  if (daily.length < 60) return 0;
  const thisMonth = daily.slice(-30).reduce((s, d) => s + d.revenue, 0);
  const lastMonth = daily.slice(-60, -30).reduce((s, d) => s + d.revenue, 0);
  if (lastMonth === 0) return 0;
  return safeDivide(thisMonth - lastMonth, lastMonth, 0) * 100;
}

export function getAvgDailyRevenue(): number {
  const daily = useMetricsStore.getState().daily;
  if (!daily.length) return 0;
  return daily.reduce((s, d) => s + d.revenue, 0) / daily.length;
}

export function getAvgGrossMarginPct(): number {
  const daily = useMetricsStore.getState().daily;
  if (!daily.length) return 0;
  const totalRev = daily.reduce((s, d) => s + d.revenue, 0);
  const totalCost = daily.reduce((s, d) => s + d.cost, 0);
  if (totalRev === 0) return 0;
  return safeDivide(totalRev - totalCost, totalRev, 0) * 100;
}
