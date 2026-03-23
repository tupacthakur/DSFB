import { useMetricsStore } from '@/lib/store/metricsStore';
import { getAvgDailyRevenue, getWoWChangePct, getAvgGrossMarginPct } from '@/lib/store/metricsStore';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';

/**
 * Build a text summary of current KPIs and data for SAGE context. Safe to call from client.
 */
export function buildDataContext(): string {
  try {
    const state = useMetricsStore.getState();
    const daily = state.daily ?? [];
    const menu = state.menuItemsForEngineering ?? [];
    const categoryPL = state.categoryPL ?? [];
    const metrics = state.metrics ?? {};
    const avgRevenue = getAvgDailyRevenue();
    const wowPct = getWoWChangePct();
    const avgMargin = getAvgGrossMarginPct();
    const categories = Array.from(new Set(menu.map((i) => i.category))).join(', ') || '—';
    const lines: string[] = [
      `Current KPIs: food cost ${formatPercent(Number(metrics.food_cost) || 0)}, labor cost ${formatPercent(Number(metrics.labor_cost) || 0)}, prime cost ${formatPercent(Number(metrics.prime_cost) || 0)}, avg check ₹${Number(metrics.avg_check) || 0}, waste ${formatPercent(Number(metrics.waste_pct) || 0)}, satisfaction ${Number(metrics.sat_score) || 0}/5.`,
      `Revenue: last ${daily.length} days; avg daily revenue ${formatCurrency(avgRevenue)}; week-over-week change ${wowPct >= 0 ? '+' : ''}${wowPct.toFixed(1)}%. Gross margin (blended) ${formatPercent(avgMargin)}.`,
      `Menu: ${menu.length} items across ${categories}.`,
    ];
    if (categoryPL.length > 0) {
      const top = categoryPL
        .slice(0, 5)
        .map((c) => `${c.category} (margin ${formatPercent(Number(c.marginPct) || 0)})`)
        .join('; ');
      lines.push(`Category P&L: ${top}.`);
    }
    return lines.join(' ');
  } catch {
    return 'Current data context unavailable.';
  }
}
