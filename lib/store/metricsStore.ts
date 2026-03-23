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
  /** Forecast tab: flagged dates (YYYY-MM-DD) for operations planning */
  flaggedForecastDates: string[];
  /** Executive: budget targets per metric/key for vs Budget column */
  budgetTargets: Partial<Record<string, number>>;
}

export interface MetricsActions {
  setFlagForReview: (id: string, flag: boolean) => void;
  setFlaggedForecastDate: (date: string, flag: boolean) => void;
  setBudgetTarget: (metricKey: string, value: number | null) => void;
  /** Update daily time series (e.g. from CSV upload); also updates revenueRolling7 */
  setDaily: (daily: DailyMetric[]) => void;
  /** Merge metrics from upload/calculation; used so Executive stats reflect CSV data */
  setMetrics: (metrics: Partial<Record<MetricKey, number>>) => void;
  /** Merge prior-period metrics for delta display */
  setPriorMetrics: (prior: Partial<Record<MetricKey, number>>) => void;
}

// ----- MOCK DATA LAYER: seed data only. No Math.random() in production data paths. -----
function getMockSparkline(base: number, trend: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 10; i++) {
    out.push(Math.max(0, base + trend * i + (i % 2 === 0 ? 0.5 : -0.5)));
  }
  return out;
}

function getMockDaily(): DailyMetric[] {
  const out: DailyMetric[] = [];
  const today = new Date();
  for (let i = 59; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const revenue = 4200 + i * 80 + (i % 5) * 100;
    const cost = revenue * (0.32 + (i % 7) * 0.01);
    const covers = Math.round(revenue / 28);
    const grossMarginPct = safeDivide(revenue - cost, revenue, 0) * 100;
    out.push({ date: dateStr, revenue, cost, covers, grossMarginPct });
  }
  return out;
}

function getMockRadar(): RadarAxis[] {
  return [
    { name: 'Food Quality', yourScore: 4.6, benchmark: 4.2 },
    { name: 'Service Speed', yourScore: 4.1, benchmark: 4.3 },
    { name: 'Ambiance', yourScore: 4.8, benchmark: 4.0 },
    { name: 'Value for Money', yourScore: 4.0, benchmark: 4.1 },
    { name: 'Cleanliness', yourScore: 4.7, benchmark: 4.5 },
    { name: 'Staff Friendliness', yourScore: 4.5, benchmark: 4.4 },
  ];
}

// Cheelizza - India Ka Pizza style menu (Pizza, Pasta, Italian) — single source of truth
const CHEELIZZA_MENU: { name: string; category: MenuCategory; covers: number; marginPct: number; price: number }[] = [
  { name: 'Margherita', category: 'Mains', covers: 182, marginPct: 68, price: 199 },
  { name: 'Paneer Tikka Pizza', category: 'Mains', covers: 156, marginPct: 64, price: 249 },
  { name: 'Tandoori Chicken Pizza', category: 'Mains', covers: 142, marginPct: 62, price: 279 },
  { name: 'Veggie Supreme', category: 'Mains', covers: 98, marginPct: 70, price: 269 },
  { name: 'Cheese Burst', category: 'Mains', covers: 165, marginPct: 58, price: 229 },
  { name: 'Pepperoni', category: 'Mains', covers: 88, marginPct: 72, price: 299 },
  { name: 'Pasta White Sauce', category: 'Mains', covers: 124, marginPct: 65, price: 219 },
  { name: 'Pasta Red Sauce', category: 'Mains', covers: 118, marginPct: 66, price: 199 },
  { name: 'Garlic Bread', category: 'Starters', covers: 145, marginPct: 74, price: 149 },
  { name: 'Cheese Sticks', category: 'Starters', covers: 92, marginPct: 69, price: 179 },
  { name: 'Potato Wedges', category: 'Starters', covers: 134, marginPct: 71, price: 159 },
  { name: 'Cold Coffee', category: 'Beverages', covers: 198, marginPct: 78, price: 129 },
  { name: 'Fresh Lime Soda', category: 'Beverages', covers: 176, marginPct: 82, price: 79 },
  { name: 'Coke', category: 'Beverages', covers: 210, marginPct: 75, price: 89 },
  { name: 'Virgin Mojito', category: 'Beverages', covers: 112, marginPct: 73, price: 149 },
  { name: 'Brownie', category: 'Desserts', covers: 86, marginPct: 68, price: 149 },
  { name: 'Gulab Jamun', category: 'Desserts', covers: 95, marginPct: 65, price: 99 },
];

const avgVol = 130;
const targetMarg = 68;

function getMockMenuItems(): MenuScatterItem[] {
  return CHEELIZZA_MENU.map((row, i) => {
    const covers = row.covers;
    const marginPct = row.marginPct;
    const revenue = Math.round(covers * row.price);
    let quadrant: QuadrantKey = 'dogs';
    if (covers >= avgVol && marginPct >= targetMarg) quadrant = 'stars';
    else if (covers < avgVol && marginPct >= targetMarg) quadrant = 'puzzles';
    else if (covers >= avgVol && marginPct < targetMarg) quadrant = 'plowhorses';
    return { id: `m${i + 1}`, name: row.name, covers, marginPct, revenue, quadrant };
  });
}

function getMockMenuItemsForEngineering(): MenuItemForEngineering[] {
  return CHEELIZZA_MENU.map((row, i) => {
    const covers = row.covers;
    const marginPct = row.marginPct;
    const revenue = Math.round(covers * row.price);
    let quadrant: QuadrantKey = 'dogs';
    if (covers >= avgVol && marginPct >= targetMarg) quadrant = 'stars';
    else if (covers < avgVol && marginPct >= targetMarg) quadrant = 'puzzles';
    else if (covers >= avgVol && marginPct < targetMarg) quadrant = 'plowhorses';
    return {
      id: `m${i + 1}`,
      name: row.name,
      covers,
      marginPct,
      revenue,
      quadrant,
      category: row.category,
      trendWoW: (i % 3) - 1,
      sparkline7: [12, 14, 11, 15, 13, 16, 14].map((_, j) => covers * (0.9 + (j % 5) * 0.02)),
      foodCostPct: Math.min(40, Math.round(100 - marginPct) + (i % 5)),
    };
  });
}

function getMockCategoryPL(): CategoryPLRow[] {
  const byCat = CHEELIZZA_MENU.reduce(
    (acc, row) => {
      const r = acc[row.category] ?? { revenue: 0, cost: 0 };
      const rev = row.covers * row.price;
      r.revenue += rev;
      r.cost += rev * (1 - row.marginPct / 100);
      acc[row.category] = r;
      return acc;
    },
    {} as Record<string, { revenue: number; cost: number }>
  );
  return (['Mains', 'Starters', 'Beverages', 'Desserts'] as const).map((cat) => {
    const r = byCat[cat] ?? { revenue: 0, cost: 0 };
    const marginPct = r.revenue ? ((r.revenue - r.cost) / r.revenue) * 100 : 0;
    return { category: cat, revenue: Math.round(r.revenue), cost: Math.round(r.cost), marginPct: Math.round(marginPct) };
  });
}

const MOCK_METRICS: Record<MetricKey, number> = {
  food_cost: 31,
  labor_cost: 30,
  bev_margin: 64,
  table_turns: 2.6,
  avg_check: 26,
  waste_pct: 5.2,
  prime_cost: 61,
  sat_score: 4.3,
  no_shows: 9,
  repeat_rate: 38,
};

const MOCK_PRIOR: Record<MetricKey, number> = {
  food_cost: 32,
  labor_cost: 31,
  bev_margin: 62,
  table_turns: 2.5,
  avg_check: 25,
  waste_pct: 6,
  prime_cost: 63,
  sat_score: 4.2,
  no_shows: 10,
  repeat_rate: 36,
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
// ----- END MOCK LAYER -----

const dailyMock = getMockDaily();

export const useMetricsStore = create<MetricsState & MetricsActions>((set) => ({
  metrics: { ...MOCK_METRICS },
  priorMetrics: { ...MOCK_PRIOR },
  sparklines: {
    food_cost: getMockSparkline(30, -0.3),
    labor_cost: getMockSparkline(29, 0.2),
    bev_margin: getMockSparkline(65, 0.5),
    table_turns: getMockSparkline(2.5, 0.05),
    avg_check: getMockSparkline(25, 0.4),
    waste_pct: getMockSparkline(5, 0.1),
    prime_cost: getMockSparkline(60, -0.2),
    sat_score: getMockSparkline(4.2, 0.02),
    no_shows: getMockSparkline(10, -0.15),
    repeat_rate: getMockSparkline(36, 0.3),
  },
  daily: dailyMock,
  revenueRolling7: rolling7(dailyMock),
  radar: getMockRadar(),
  menuItems: getMockMenuItems(),
  avgVolumeThreshold: 100,
  targetMargin: 68,
  menuItemsForEngineering: getMockMenuItemsForEngineering(),
  categoryPL: getMockCategoryPL(),
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
    set((s) => ({
      daily: daily.length ? daily : s.daily,
      revenueRolling7: daily.length ? rolling7(daily) : s.revenueRolling7,
    })),
  setMetrics: (metrics) =>
    set((s) => ({
      metrics: { ...s.metrics, ...metrics },
    })),
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
