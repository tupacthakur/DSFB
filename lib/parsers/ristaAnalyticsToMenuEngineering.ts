import { classifyItem } from '@/lib/utils/menuEngineering';
import type { MenuItem } from '@/lib/utils/menuEngineering';
import type {
  RistaAnalyticsCategoryRow,
  RistaAnalyticsItemRow,
  RistaAnalyticsSummary,
} from '@/lib/server/services/rista/client';
import type {
  CategoryPLRow,
  MenuCategory,
  MenuItemForEngineering,
  MenuScatterItem,
} from '@/lib/store/metricsStore';
import { safeDivide } from '@/lib/utils/math';

export interface MenuEngineeringFromRista {
  menuItemsForEngineering: MenuItemForEngineering[];
  menuItems: MenuScatterItem[];
  categoryPL: CategoryPLRow[];
  avgVolumeThreshold: number;
  targetMargin: number;
  itemCount: number;
}

const GELATO_DESSERT_PATTERN =
  /gelato|kulfi|indulgence|classics|signatures|seasonal|amore|dairy|dessert|treat|combo/i;

/** Map Rista POS category labels to menu-engineering tabs (gelato catalog → Desserts). */
export function mapRistaCategoryToMenuCategory(categoryName: string): MenuCategory {
  const n = categoryName.trim().toLowerCase();
  if (/beverage|drink|coffee|tea|shake|smoothie|juice/.test(n)) return 'Beverages';
  if (/starter|appetizer|salad|soup/.test(n)) return 'Starters';
  if (/main|entree|burger|pizza|pasta|rice|bowl/.test(n)) return 'Mains';
  if (/special|limited|combo/.test(n)) return 'Specials';
  if (GELATO_DESSERT_PATTERN.test(n) || n.length > 0) return 'Desserts';
  return 'Desserts';
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function itemMarginPct(
  net: number,
  gross: number,
  discount: number,
  storeMarginPct: number
): number {
  const discountPct = gross > 0 ? (Math.abs(discount) / gross) * 100 : 0;
  const adjusted = storeMarginPct - discountPct * 0.35;
  return Math.max(12, Math.min(88, Math.round(adjusted * 10) / 10));
}

function wowFromDailySeries(dailyQty: number[]): number {
  if (dailyQty.length < 2) return 0;
  const recent = dailyQty.slice(-7).reduce((s, v) => s + v, 0);
  const prior = dailyQty.slice(-14, -7).reduce((s, v) => s + v, 0);
  if (prior === 0) return recent > 0 ? 100 : 0;
  return Math.round(safeDivide(recent - prior, prior, 0) * 1000) / 10;
}

/** Build menu engineering + category P&L from aggregated Rista analytics summaries. */
export function ristaAnalyticsToMenuEngineering(
  summaries: RistaAnalyticsSummary[],
  options?: { storeMarginPct?: number; foodCostPct?: number }
): MenuEngineeringFromRista {
  const foodCostPct = options?.foodCostPct ?? 34;
  const storeMarginPct = options?.storeMarginPct ?? Math.max(0, 100 - foodCostPct);

  type Agg = {
    sku: string;
    name: string;
    ristaCategory: string;
    revenue: number;
    covers: number;
    discount: number;
    gross: number;
    qtyByDate: Record<string, number>;
    revByDate: Record<string, number>;
  };

  const bySku = new Map<string, Agg>();
  const categoryTotals = new Map<string, { revenue: number; cost: number }>();

  const sortedSummaries = [...summaries].sort((a, b) =>
    String(a.period ?? '').localeCompare(String(b.period ?? ''))
  );

  for (const summary of sortedSummaries) {
    const period = summary.period ?? '';
    const items = summary.items;
    if (Array.isArray(items)) {
      for (const row of items) {
        const sku = String(row.skuCode ?? row.itemName ?? '').trim();
        const name = String(row.itemName ?? sku).trim();
        if (!sku || !name) continue;

        const net = Number(row.itemTotalNetAmount ?? 0);
        const qty = Math.max(0, Number(row.itemTotalQty ?? 0));
        const discount = Number(row.itemTotalDiscountAmount ?? 0);
        const gross = Number(row.itemTotalgrossAmount ?? net);
        const cat = String(row.categoryName ?? 'Uncategorized').trim();

        const prev = bySku.get(sku) ?? {
          sku,
          name,
          ristaCategory: cat,
          revenue: 0,
          covers: 0,
          discount: 0,
          gross: 0,
          qtyByDate: {},
          revByDate: {},
        };
        prev.revenue += net;
        prev.covers += qty || (net > 0 ? 1 : 0);
        prev.discount += discount;
        prev.gross += gross;
        if (period) {
          prev.qtyByDate[period] = (prev.qtyByDate[period] ?? 0) + (qty || 1);
          prev.revByDate[period] = (prev.revByDate[period] ?? 0) + net;
        }
        bySku.set(sku, prev);

        const menuCat = mapRistaCategoryToMenuCategory(cat);
        const catBucket = categoryTotals.get(menuCat) ?? { revenue: 0, cost: 0 };
        catBucket.revenue += net;
        catBucket.cost += net * (foodCostPct / 100);
        categoryTotals.set(menuCat, catBucket);
      }
    }

    const categories = summary.categories;
    if (Array.isArray(categories)) {
      for (const row of categories) {
        const name = String(row.name ?? '').trim();
        const amount = Number(row.amount ?? 0);
        if (!name || amount <= 0) continue;
        const menuCat = mapRistaCategoryToMenuCategory(name);
        const catBucket = categoryTotals.get(menuCat) ?? { revenue: 0, cost: 0 };
        catBucket.revenue += amount;
        catBucket.cost += amount * (foodCostPct / 100);
        categoryTotals.set(menuCat, catBucket);
      }
    }
  }

  const rawItems: Omit<MenuItemForEngineering, 'quadrant'>[] = [];
  for (const agg of Array.from(bySku.values())) {
    const marginPct = itemMarginPct(agg.revenue, agg.gross, agg.discount, storeMarginPct);
    const dates = Object.keys(agg.qtyByDate).sort();
    const sparkline7 = dates.slice(-7).map((d) => agg.revByDate[d] ?? 0);
    while (sparkline7.length < 7) sparkline7.unshift(0);
    const dailyQty = dates.map((d) => agg.qtyByDate[d] ?? 0);
    rawItems.push({
      id: agg.sku,
      name: agg.name,
      category: mapRistaCategoryToMenuCategory(agg.ristaCategory),
      covers: Math.round(agg.covers),
      revenue: Math.round(agg.revenue * 100) / 100,
      marginPct,
      foodCostPct: Math.round((100 - marginPct) * 10) / 10,
      trendWoW: wowFromDailySeries(dailyQty),
      sparkline7: sparkline7.slice(-7),
    });
  }

  rawItems.sort((a, b) => b.revenue - a.revenue);

  const asMenuItems: MenuItem[] = rawItems.map((i) => ({
    id: i.id,
    name: i.name,
    covers: i.covers,
    marginPct: i.marginPct,
    revenue: i.revenue,
  }));

  const menuItemsForEngineering: MenuItemForEngineering[] = rawItems.map((item) => ({
    ...item,
    quadrant: classifyItem(item, asMenuItems),
  }));

  const menuItems: MenuScatterItem[] = menuItemsForEngineering.map(
    ({ id, name, covers, marginPct, revenue, quadrant }) => ({
      id,
      name,
      covers,
      marginPct,
      revenue,
      quadrant,
    })
  );

  const categoryPL: CategoryPLRow[] = Array.from(categoryTotals.entries())
    .map(([category, row]) => ({
      category,
      revenue: Math.round(row.revenue * 100) / 100,
      cost: Math.round(row.cost * 100) / 100,
      marginPct:
        row.revenue > 0
          ? Math.round(safeDivide(row.revenue - row.cost, row.revenue, 0) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const volumes = menuItemsForEngineering.map((i) => i.covers);
  const margins = menuItemsForEngineering.map((i) => i.marginPct);

  return {
    menuItemsForEngineering,
    menuItems,
    categoryPL,
    avgVolumeThreshold: Math.round(median(volumes)),
    targetMargin: Math.round(median(margins) * 10) / 10 || storeMarginPct,
    itemCount: menuItemsForEngineering.length,
  };
}
