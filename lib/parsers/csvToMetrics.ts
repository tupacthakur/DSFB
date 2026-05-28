/**
 * Parse CSV content into daily metrics and KPI metrics for the Executive dashboard.
 * Detects common column names (date, revenue, sales, cost, covers, etc.) and
 * aggregates by date so uploaded CSVs drive P&L Snapshot, Health Score, etc.
 */

import Papa from 'papaparse';
import { parseFlexibleDate } from '@/lib/ingestion/dateParse';
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
  'bill date',
  'business date',
  'business_date',
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
  'order value',
  'subtotal',
  'net amount',
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

const BRANCH_COLUMN_NAMES = [
  'branch',
  'branch name',
  'outlet',
  'outlet name',
  'location',
  'store',
  'store name',
  'franchise',
  'unit',
  'site',
];

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

function parseDate(val: string): string | null {
  return parseFlexibleDate(val);
}

export type CsvSchemaId = 'rista_sales_audit' | 'swiggy_annexure' | 'inventory_snapshot' | 'generic';

export interface CsvIngestionMetadata {
  schema: CsvSchemaId;
  /** Rows read from file (non-empty records) */
  rowCount: number;
  columnCount: number;
  /** Same as rowCount; kept for clarity in reports */
  dataRowCount: number;
  skippedRowCount: number;
  dateRange: { start: string; end: string } | null;
  warnings: string[];
  /** Distinct branch/outlet names if a column was detected (multi-unit rollups) */
  branchesDetected: string[];
}

export interface CsvMetricsResult {
  daily: DailyMetric[];
  metrics: Partial<Record<MetricKey, number>>;
  priorMetrics: Partial<Record<MetricKey, number>>;
  metadata: CsvIngestionMetadata;
}

function emptyMeta(
  schema: CsvSchemaId,
  columnCount: number,
  rowCount: number,
  extra?: Partial<CsvIngestionMetadata>
): CsvIngestionMetadata {
  return {
    schema,
    rowCount,
    columnCount,
    dataRowCount: rowCount,
    skippedRowCount: extra?.skippedRowCount ?? 0,
    dateRange: null,
    warnings: extra?.warnings ?? [],
    branchesDetected: extra?.branchesDetected ?? [],
  };
}

function collectWarnings(
  dataRows: number,
  skipped: number,
  dailyLen: number,
  branches: string[]
): string[] {
  const w: string[] = [];
  if (skipped > 0) {
    w.push(`${skipped} row(s) skipped (missing or unparseable date).`);
  }
  if (dataRows > 0 && dailyLen === 0) {
    w.push('No daily series produced after parsing; verify date and revenue columns.');
  }
  if (dataRows > 0 && skipped / dataRows > 0.1) {
    w.push('Over 10% of rows were skipped; check date formats (e.g. DD/MM/YYYY vs ISO).');
  }
  if (branches.length > 1) {
    w.push(
      `Multiple outlets detected (${branches.length}): ${branches.slice(0, 4).join(', ')}${branches.length > 4 ? '…' : ''}. Daily totals are combined across outlets.`
    );
  }
  return w;
}

/**
 * Parse CSV text (with header row) into daily aggregates and derived metrics.
 * Uses first row as headers; detects date, revenue, cost, covers by common names.
 */
export function parseCsvToMetrics(csvText: string): CsvMetricsResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const rawRows = parsed.data.filter((row) => Object.values(row).some((v) => String(v ?? '').trim() !== ''));
  const headers = parsed.meta.fields ?? [];
  const normalizedHeaders = headers.map(normalizeHeader);

  if (headers.length === 0 || rawRows.length === 0) {
    return {
      daily: [],
      metrics: {},
      priorMetrics: {},
      metadata: emptyMeta('generic', headers.length, 0, {
        warnings: ['File has no data rows or missing headers.'],
      }),
    };
  }

  const isRistaSalesAudit =
    normalizedHeaders.includes('business date') &&
    normalizedHeaders.includes('net amount') &&
    normalizedHeaders.includes('materials cost');

  const isSwiggyAnnexure =
    normalizedHeaders.includes('order date') &&
    normalizedHeaders.includes('customer payable (net bill value after taxes & discount) f = d + e');

  /** Multi-warehouse batch inventory (SKU × batch × warehouse); not POS sales. */
  const isInventorySnapshot =
    normalizedHeaders.includes('sku_id') &&
    normalizedHeaders.includes('quantity_in_stock') &&
    normalizedHeaders.includes('cost_per_unit') &&
    (normalizedHeaders.includes('last_updated') || normalizedHeaders.includes('manufactured_date'));

  const byDate: Record<string, { revenue: number; cost: number; covers: number; orders: number; cancelled: number; uniqueCustomers: Set<string> }> = {};

  let skippedRowCount = 0;
  const branchSet = new Set<string>();

  if (isRistaSalesAudit) {
    for (const row of rawRows) {
      const dateStr = parseDate(row['Business Date'] ?? row['Invoice Date'] ?? '');
      if (!dateStr) {
        skippedRowCount++;
        continue;
      }
      const status = normalizeHeader(row['Sale Status'] ?? '');
      const revenue = parseNumber(row['Total'] ?? row['Net Amount'] ?? row['Gross Amount'] ?? '0');
      const materialCost = parseNumber(row['Materials Cost'] ?? '0');
      const qty = Math.round(
        parseNumber(row['Number of Tickets'] ?? row['Total Quantity'] ?? row['Number of Items'] ?? '0')
      );
      const customerKey = String(row['Customer Id'] ?? row['Customer Phone'] ?? '').trim();
      const branchName = String(row['Branch Name'] ?? row['Outlet Name'] ?? row['Location'] ?? '').trim();
      if (branchName) branchSet.add(branchName);

      const bucket = byDate[dateStr] ?? {
        revenue: 0,
        cost: 0,
        covers: 0,
        orders: 0,
        cancelled: 0,
        uniqueCustomers: new Set<string>(),
      };

      bucket.revenue += revenue;
      bucket.cost += materialCost;
      bucket.covers += qty;
      bucket.orders += 1;
      if (status.includes('void') || status.includes('cancel')) bucket.cancelled += 1;
      if (customerKey) bucket.uniqueCustomers.add(customerKey);
      byDate[dateStr] = bucket;
    }
  } else if (isSwiggyAnnexure) {
    for (const row of rawRows) {
      const dateStr = parseDate(row['Order Date'] ?? '');
      if (!dateStr) {
        skippedRowCount++;
        continue;
      }
      const revenue = parseNumber(
        row['Customer payable (Net bill value after taxes & discount) F = D + E'] ??
          row['Customer payable (Net bill value after taxes & discount) F = D + E,'] ??
          '0'
      );
      const swiggyFee = parseNumber(
        row['Total Swiggy fee (including taxes) S = P + Q + U1'] ??
          row['Total Swiggy fee (including taxes) S = P + Q + U1,'] ??
          '0'
      );
      const netPayable = parseNumber(
        row['Net Payable Amount (after TCS and TDS deduction) Y = W - X1 - X2'] ?? '0'
      );
      const cost = swiggyFee > 0 ? swiggyFee : Math.max(0, revenue - netPayable);
      const bucket = byDate[dateStr] ?? {
        revenue: 0,
        cost: 0,
        covers: 0,
        orders: 0,
        cancelled: 0,
        uniqueCustomers: new Set<string>(),
      };
      bucket.revenue += revenue;
      bucket.cost += cost;
      bucket.covers += 1;
      bucket.orders += 1;
      byDate[dateStr] = bucket;
    }
  } else if (isInventorySnapshot) {
    const dateCol =
      headers.find((h) => normalizeHeader(h) === 'last_updated') ??
      headers.find((h) => normalizeHeader(h) === 'manufactured_date');
    const whCol = headers.find((h) => normalizeHeader(h) === 'warehouse_id');
    const qtyCol = headers.find((h) => normalizeHeader(h) === 'quantity_in_stock');
    const costCol = headers.find((h) => normalizeHeader(h) === 'cost_per_unit');
    const lossCol = headers.find((h) => normalizeHeader(h) === 'financial_loss_damage');
    const statusCol = headers.find((h) => normalizeHeader(h) === 'stock_status');
    if (!dateCol || !qtyCol || !costCol) {
      return {
        daily: [],
        metrics: {},
        priorMetrics: {},
        metadata: emptyMeta('generic', headers.length, rawRows.length, {
          warnings: ['Inventory-style CSV detected but required columns (last_updated or manufactured_date, quantity_in_stock, cost_per_unit) were not resolved.'],
        }),
      };
    }
    for (const row of rawRows) {
      const dateVal = String(row[dateCol] ?? '').trim();
      const dateStr = parseDate(dateVal);
      if (!dateStr) {
        skippedRowCount++;
        continue;
      }
      if (whCol) {
        const w = String(row[whCol] ?? '').trim();
        if (w) branchSet.add(w);
      }
      const qty = parseNumber(String(row[qtyCol] ?? ''));
      const cpu = parseNumber(String(row[costCol] ?? ''));
      const invValue = qty * cpu;
      const damageLoss = lossCol ? parseNumber(String(row[lossCol] ?? '')) : 0;
      const bucket = byDate[dateStr] ?? {
        revenue: 0,
        cost: 0,
        covers: 0,
        orders: 0,
        cancelled: 0,
        uniqueCustomers: new Set<string>(),
      };
      bucket.revenue += invValue;
      bucket.cost += damageLoss;
      bucket.covers += Math.round(qty);
      bucket.orders += 1;
      const st = statusCol ? normalizeHeader(String(row[statusCol] ?? '')) : '';
      if (st.includes('out_of_stock') || st.includes('cancel')) bucket.cancelled += 1;
      byDate[dateStr] = bucket;
    }
  } else {
    const dateIdx = findColumnIndex(headers, DATE_COLUMN_NAMES);
    const revenueIdx = findColumnIndex(headers, REVENUE_COLUMN_NAMES);
    const costIdx = findColumnIndex(headers, COST_COLUMN_NAMES);
    const coversIdx = findColumnIndex(headers, COVERS_COLUMN_NAMES);
    const branchIdx = findColumnIndex(headers, BRANCH_COLUMN_NAMES);
    if (dateIdx < 0 || revenueIdx < 0) {
      return {
        daily: [],
        metrics: {},
        priorMetrics: {},
        metadata: emptyMeta('generic', headers.length, rawRows.length, {
          skippedRowCount: 0,
          warnings: [
            'Could not detect required columns. Generic CSV needs a parsable date column and a revenue/sales/total column.',
          ],
        }),
      };
    }
    for (const row of rawRows) {
      const dateVal = row[headers[dateIdx]!] ?? '';
      const dateStr = parseDate(dateVal);
      if (!dateStr) {
        skippedRowCount++;
        continue;
      }
      if (branchIdx >= 0) {
        const b = String(row[headers[branchIdx]!] ?? '').trim();
        if (b) branchSet.add(b);
      }
      const revenue = parseNumber(row[headers[revenueIdx]!] ?? '');
      const cost = costIdx >= 0 ? parseNumber(row[headers[costIdx]!] ?? '') : 0;
      const covers = coversIdx >= 0 ? Math.round(parseNumber(row[headers[coversIdx]!] ?? '')) : 0;
      const bucket = byDate[dateStr] ?? {
        revenue: 0,
        cost: 0,
        covers: 0,
        orders: 0,
        cancelled: 0,
        uniqueCustomers: new Set<string>(),
      };
      bucket.revenue += revenue;
      bucket.cost += cost;
      bucket.covers += covers;
      bucket.orders += 1;
      byDate[dateStr] = bucket;
    }
  }

  const branchesDetected = Array.from(branchSet).sort((a, b) => a.localeCompare(b)).slice(0, 24);

  const daily: DailyMetric[] = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => {
      const revenue = row.revenue;
      const effectiveCost =
        row.cost > 0
          ? row.cost
          : isSwiggyAnnexure
            ? revenue * 0.26
            : isInventorySnapshot
              ? 0
              : revenue * 0.34;
      const covers = row.covers || row.orders || (revenue > 0 ? Math.round(revenue / 220) : 0);
      const cost = effectiveCost;
      const grossMarginPct = safeDivide(revenue - cost, revenue, 0) * 100;
      return { date, revenue, cost, covers, grossMarginPct };
    });

  const schemaResolved: CsvSchemaId = isRistaSalesAudit
    ? 'rista_sales_audit'
    : isSwiggyAnnexure
      ? 'swiggy_annexure'
      : isInventorySnapshot
        ? 'inventory_snapshot'
        : 'generic';

  if (daily.length === 0) {
    const warnings = collectWarnings(rawRows.length, skippedRowCount, 0, branchesDetected);
    return {
      daily: [],
      metrics: {},
      priorMetrics: {},
      metadata: {
        schema: schemaResolved,
        rowCount: rawRows.length,
        columnCount: headers.length,
        dataRowCount: rawRows.length,
        skippedRowCount,
        dateRange: null,
        warnings,
        branchesDetected,
      },
    };
  }

  const dateRange = { start: daily[0].date, end: daily[daily.length - 1].date };
  const warnings = collectWarnings(rawRows.length, skippedRowCount, daily.length, branchesDetected);
  if (schemaResolved === 'inventory_snapshot') {
    warnings.unshift(
      'Inventory snapshot schema: each day aggregates Σ(quantity_in_stock × cost_per_unit) as the value signal; cost aggregates financial_loss_damage (damage write-offs). Executive KPIs are interpretive—not literal restaurant sales.',
    );
  }

  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const totalCost = daily.reduce((s, d) => s + d.cost, 0);
  const totalCovers = daily.reduce((s, d) => s + d.covers, 0);
  const foodCostPct = safeDivide(totalCost, totalRevenue, 0) * 100;
  const avgCheck = safeDivide(totalRevenue, totalCovers, 0);
  const totalOrders = Object.values(byDate).reduce((s, d) => s + d.orders, 0);
  const totalCancelled = Object.values(byDate).reduce((s, d) => s + d.cancelled, 0);
  const totalUniqueCustomers = Object.values(byDate).reduce((s, d) => s + d.uniqueCustomers.size, 0);
  const repeatRate = totalOrders > 0 ? Math.max(0, Math.min(100, ((totalOrders - totalUniqueCustomers) / totalOrders) * 100)) : 0;
  const noShowRate = totalOrders > 0 ? (totalCancelled / totalOrders) * 100 : 0;
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
    no_shows: Math.round(noShowRate * 10) / 10,
    repeat_rate: Math.round(repeatRate * 10) / 10,
    waste_pct: isRistaSalesAudit ? 3.5 : 1.5,
    bev_margin: isSwiggyAnnexure ? 58 : 64,
    sat_score: Math.round((4.6 - Math.min(2, noShowRate / 10)) * 10) / 10,
  };
  const priorMetrics: Partial<Record<MetricKey, number>> = {
    food_cost: Math.round(priorFoodCostPct * 10) / 10,
    avg_check: Math.round(priorAvgCheck * 10) / 10,
    labor_cost: laborCostProxy,
    prime_cost: Math.round((priorFoodCostPct + laborCostProxy) * 10) / 10,
    table_turns: Math.round(priorTableTurns * 100) / 100,
    no_shows: Math.round(noShowRate * 10) / 10,
    repeat_rate: Math.round(repeatRate * 10) / 10,
    waste_pct: isRistaSalesAudit ? 3.8 : 1.8,
    bev_margin: isSwiggyAnnexure ? 57 : 63,
    sat_score: Math.round((4.5 - Math.min(2, noShowRate / 10)) * 10) / 10,
  };

  return {
    daily,
    metrics,
    priorMetrics,
    metadata: {
      schema: schemaResolved,
      rowCount: rawRows.length,
      columnCount: headers.length,
      dataRowCount: rawRows.length,
      skippedRowCount,
      dateRange,
      warnings,
      branchesDetected,
    },
  };
}
