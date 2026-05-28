import { format, subDays } from 'date-fns';
import type { DailyMetric } from '@/lib/store/metricsStore';
import { inferColumnRoles } from '@/lib/ingestion/columnInference';
import { parseFlexibleDate } from '@/lib/ingestion/dateParse';
import { buildFromDaily } from '@/lib/metrics/buildFromDaily';
import type { CsvIngestionMetadata, CsvMetricsResult } from '@/lib/parsers/csvToMetrics';

function parseNum(val: string): number {
  const n = parseFloat(String(val).replace(/[₹$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Last-resort: build a daily series from any tabular rows. */
export function synthesizeMetricsFromRows(
  headers: string[],
  rows: Record<string, string>[],
  fileName: string
): CsvMetricsResult | null {
  if (rows.length === 0) return null;

  const roles = inferColumnRoles(headers, rows);
  const byDate: Record<string, { revenue: number; cost: number; covers: number }> = {};

  if (roles) {
    for (const row of rows) {
      const dateRaw = String(row[headers[roles.date]!] ?? '').trim();
      let date = parseFlexibleDate(dateRaw);
      if (!date && /^\d+$/.test(dateRaw)) {
        const n = parseInt(dateRaw, 10);
        if (n > 30000 && n < 60000) {
          const excelEpoch = new Date(Date.UTC(1899, 11, 30));
          date = new Date(excelEpoch.getTime() + n * 86400000).toISOString().slice(0, 10);
        }
      }
      if (!date) continue;
      const revenue = parseNum(String(row[headers[roles.revenue]!] ?? ''));
      if (revenue <= 0) continue;
      const cost = roles.cost >= 0 ? parseNum(String(row[headers[roles.cost]!] ?? '')) : 0;
      const covers =
        roles.covers >= 0
          ? Math.round(parseNum(String(row[headers[roles.covers]!] ?? ''))) || 1
          : 1;
      const bucket = byDate[date] ?? { revenue: 0, cost: 0, covers: 0 };
      bucket.revenue += revenue;
      bucket.cost += cost;
      bucket.covers += covers;
      byDate[date] = bucket;
    }
  }

  if (Object.keys(byDate).length === 0) {
    let i = 0;
    for (const row of rows) {
      const nums = Object.values(row)
        .map((v) => parseNum(v))
        .filter((n) => n > 0 && n < 1e11);
      if (nums.length === 0) continue;
      const revenue = Math.max(...nums);
      const date = format(subDays(new Date(), i % 60), 'yyyy-MM-dd');
      const bucket = byDate[date] ?? { revenue: 0, cost: 0, covers: 0 };
      bucket.revenue += revenue;
      bucket.covers += 1;
      byDate[date] = bucket;
      i++;
    }
  }

  const daily: DailyMetric[] = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => {
      const cost = row.cost > 0 ? row.cost : row.revenue * 0.34;
      const grossMarginPct = row.revenue > 0 ? ((row.revenue - cost) / row.revenue) * 100 : 0;
      return {
        date,
        revenue: row.revenue,
        cost,
        covers: row.covers || 1,
        grossMarginPct,
      };
    });

  if (daily.length === 0) return null;

  const { metrics, priorMetrics } = buildFromDaily(daily, 'generic');
  const metadata: CsvIngestionMetadata = {
    schema: 'generic',
    rowCount: rows.length,
    columnCount: headers.length,
    dataRowCount: rows.length,
    skippedRowCount: 0,
    dateRange: { start: daily[0].date, end: daily[daily.length - 1].date },
    warnings: [`Synthesized metrics from "${fileName}" using best-effort column/number inference.`],
    branchesDetected: [],
  };

  return { daily, metrics, priorMetrics, metadata };
}
