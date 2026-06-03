import { buildFromDaily } from '@/lib/metrics/buildFromDaily';
import type { CsvSchemaId } from '@/lib/parsers/csvToMetrics';
import type { RistaAnalyticsSummary } from '@/lib/server/services/rista/client';
import type { DailyMetric } from '@/lib/store/metricsStore';
import { safeDivide } from '@/lib/utils/math';

export interface RistaAnalyticsSyncMetadata {
  schema: CsvSchemaId;
  rowCount: number;
  columnCount: number;
  dataRowCount: number;
  skippedRowCount: number;
  dateRange: { start: string; end: string } | null;
  warnings: string[];
  branchesDetected: string[];
  channelRows: number;
}

/** Aggregate branch-day analytics summaries into daily executive metrics. */
export function ristaAnalyticsToMetrics(summaries: RistaAnalyticsSummary[]) {
  const byDate: Record<
    string,
    { revenue: number; cost: number; covers: number; orders: number; channels: Set<string> }
  > = {};
  const branchSet = new Set<string>();
  let channelRows = 0;

  for (const entry of summaries) {
    const date = entry.period;
    if (!date) continue;
    if (entry.branchName) branchSet.add(entry.branchName);

    const channels = entry.channelSummary ?? [];
    let dayRevenue = 0;
    let dayCovers = 0;

    if (Array.isArray(channels) && channels.length > 0) {
      for (const ch of channels) {
        channelRows++;
        dayRevenue += Number(ch.netSaleAmount ?? 0);
        dayCovers += Math.round(Number(ch.noOfSales ?? 0));
      }
    } else {
      dayRevenue += Number(entry.netAmount ?? entry.revenue ?? 0);
      dayCovers += Math.round(Number(entry.noOfSales ?? 0));
    }

    const materialCost = Array.isArray(entry.costs)
      ? entry.costs.reduce((s, c) => s + Number(c.amount ?? 0), 0)
      : 0;

    const bucket = byDate[date] ?? {
      revenue: 0,
      cost: 0,
      covers: 0,
      orders: 0,
      channels: new Set<string>(),
    };
    bucket.revenue += dayRevenue;
    bucket.cost += materialCost > 0 ? materialCost : dayRevenue * 0.34;
    bucket.covers += dayCovers || 1;
    bucket.orders += 1;
    for (const ch of channels) {
      if (ch.name) bucket.channels.add(ch.name);
    }
    byDate[date] = bucket;
  }

  const daily: DailyMetric[] = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({
      date,
      revenue: row.revenue,
      cost: row.cost,
      covers: row.covers,
      grossMarginPct: safeDivide(row.revenue - row.cost, row.revenue, 0) * 100,
    }));

  const { metrics, priorMetrics } = buildFromDaily(daily, 'rista_sales_audit');
  const branchesDetected = Array.from(branchSet).sort((a, b) => a.localeCompare(b)).slice(0, 24);
  const dateRange =
    daily.length > 0 ? { start: daily[0].date, end: daily[daily.length - 1].date } : null;

  const warnings: string[] = [];
  if (summaries.length > 0 && daily.length === 0) {
    warnings.push('Analytics summaries returned but no daily series could be built.');
  }
  const channelNames = new Set<string>();
  for (const s of summaries) {
    for (const ch of s.channelSummary ?? []) {
      if (ch.name) channelNames.add(ch.name);
    }
  }
  if (channelNames.size > 0) {
    warnings.push(
      `Channels detected in analytics: ${Array.from(channelNames).slice(0, 8).join(', ')}${channelNames.size > 8 ? '…' : ''}.`
    );
  }

  return {
    daily,
    metrics,
    priorMetrics,
    metadata: {
      schema: 'rista_sales_audit' as CsvSchemaId,
      rowCount: summaries.length,
      columnCount: 0,
      dataRowCount: summaries.length,
      skippedRowCount: 0,
      dateRange,
      warnings,
      branchesDetected,
      channelRows,
    },
  };
}
