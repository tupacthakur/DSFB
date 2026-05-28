import { buildFromDaily } from '@/lib/metrics/buildFromDaily';
import type { CsvSchemaId } from '@/lib/parsers/csvToMetrics';
import type { RistaSale } from '@/lib/server/services/rista/client';
import type { DailyMetric } from '@/lib/store/metricsStore';
import { safeDivide } from '@/lib/utils/math';

export interface RistaSyncMetadata {
  schema: CsvSchemaId;
  rowCount: number;
  columnCount: number;
  dataRowCount: number;
  skippedRowCount: number;
  dateRange: { start: string; end: string } | null;
  warnings: string[];
  branchesDetected: string[];
}

export function ristaSalesToMetrics(sales: RistaSale[]) {
  const byDate: Record<
    string,
    { revenue: number; cost: number; covers: number; orders: number; cancelled: number }
  > = {};
  let skipped = 0;
  const branchSet = new Set<string>();

  for (const sale of sales) {
    const date = sale.invoiceDay?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skipped++;
      continue;
    }
    const status = String(sale.status ?? '').toLowerCase();
    if (status.includes('void') || status.includes('cancel')) {
      skipped++;
      continue;
    }

    const branch = sale.branchName ?? sale.branchCode ?? '';
    if (branch) branchSet.add(branch);

    const revenue = Number(sale.netAmount ?? sale.totalAmount ?? sale.grossAmount ?? 0);
    const cost = Number(sale.totalMaterialCost ?? sale.totalCost ?? 0);
    const covers = Math.round(Number(sale.itemCount ?? sale.personCount ?? 0)) || 1;

    const bucket = byDate[date] ?? { revenue: 0, cost: 0, covers: 0, orders: 0, cancelled: 0 };
    bucket.revenue += revenue;
    bucket.cost += cost;
    bucket.covers += covers;
    bucket.orders += 1;
    byDate[date] = bucket;
  }

  const daily: DailyMetric[] = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => {
      const revenue = row.revenue;
      const cost = row.cost > 0 ? row.cost : revenue * 0.34;
      const covers = row.covers || row.orders;
      const grossMarginPct = safeDivide(revenue - cost, revenue, 0) * 100;
      return { date, revenue, cost, covers, grossMarginPct };
    });

  const { metrics, priorMetrics } = buildFromDaily(daily, 'rista_sales_audit');
  const branchesDetected = Array.from(branchSet).sort((a, b) => a.localeCompare(b)).slice(0, 24);
  const dateRange =
    daily.length > 0 ? { start: daily[0].date, end: daily[daily.length - 1].date } : null;

  const metadata: RistaSyncMetadata = {
    schema: 'rista_sales_audit',
    rowCount: sales.length,
    columnCount: 0,
    dataRowCount: sales.length - skipped,
    skippedRowCount: skipped,
    dateRange,
    warnings: [],
    branchesDetected,
  };

  return { daily, metrics, priorMetrics, metadata };
}
