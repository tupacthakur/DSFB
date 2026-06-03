import { useMetricsStore } from '@/lib/store/metricsStore';
import { getAvgDailyRevenue, getWoWChangePct, getAvgGrossMarginPct } from '@/lib/store/metricsStore';
import { useIngestionLogStore } from '@/lib/store/ingestionLogStore';
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
      `Granularity: current uploaded sources are order-level POS and marketplace settlement files. Menu engineering only uses real item-level data when available; otherwise menu datasets remain empty instead of mocked.`,
      `Commercial coverage: for liquidity, inventory files, franchise splits, per-SKU landed cost, delivery/dispatch fees, and supplier transit times—only state what is present in uploads; do not invent franchise or bank balances.`,
      `Blind-spot policy: if paper challan, outlet operations (POS accept/reconcile/close), retail+aggregator channel mix, Zoho↔Rista PO/GRN joins, Tally invoice trail, or franchise settlement flow are not present in ingested data, explicitly mark them as missing controls and elevated reconciliation risk.`,
      `Menu: ${menu.length} items across ${categories}.`,
    ];
    if (categoryPL.length > 0) {
      const top = categoryPL
        .slice(0, 5)
        .map((c) => `${c.category} (margin ${formatPercent(Number(c.marginPct) || 0)})`)
        .join('; ');
      lines.push(`Category P&L: ${top}.`);
    }
    const lastIngest = useIngestionLogStore.getState().events[0];
    if (lastIngest) {
      lines.push(
        `Last CSV ingest: schema ${lastIngest.schema}, ${lastIngest.dailyDays} day(s) in series, ${lastIngest.skippedRowCount} row(s) skipped, ${lastIngest.warnings.length} pipeline warning(s).`
      );
    }
    lines.push(
      `Constraint: never claim end-to-end financial truth unless retail + aggregator sales, inventory movement, and accounting records are all digitally linked by shared document keys.`
    );
    return lines.join(' ');
  } catch {
    return 'Current data context unavailable.';
  }
}
