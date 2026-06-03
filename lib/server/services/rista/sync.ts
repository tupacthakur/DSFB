import { subDays, format } from 'date-fns';
import { ApiError } from '@/lib/server/api/errors';
import { ristaAnalyticsToMetrics } from '@/lib/parsers/ristaAnalyticsToMetrics';
import { ristaSalesToMetrics } from '@/lib/parsers/ristaSalesToMetrics';
import type { RistaCredentials } from '@/lib/server/services/rista/auth';
import type { DailyMetric } from '@/lib/store/metricsStore';
import { buildFromDaily } from '@/lib/metrics/buildFromDaily';
import {
  fetchAllSalesForDay,
  fetchAnalyticsSalesSummary,
  listRistaBranches,
  type RistaAnalyticsSummary,
  type RistaSale,
} from '@/lib/server/services/rista/client';

const DEFAULT_DAYS = 14;
const SYNC_CONCURRENCY = 8;
const MAX_SYNC_DAYS = 90;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function synthesizeFromBranchMetadata(
  branches: { branchCode: string; branchName: string }[],
  days: number
) {
  const branchCount = Math.max(1, branches.length);
  const baseRevenue = 18000 * branchCount;
  const daily: DailyMetric[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const seasonal = 1 + Math.sin((i / 7) * Math.PI) * 0.08;
    const revenue = Math.round(baseRevenue * seasonal);
    const cost = Math.round(revenue * 0.34);
    const covers = Math.max(1, Math.round(revenue / 220));
    const grossMarginPct = ((revenue - cost) / revenue) * 100;
    daily.push({ date, revenue, cost, covers, grossMarginPct });
  }
  const { metrics, priorMetrics } = buildFromDaily(daily, 'generic');
  return {
    daily,
    metrics,
    priorMetrics,
    metadata: {
      schema: 'generic' as const,
      rowCount: daily.length,
      columnCount: 0,
      dataRowCount: daily.length,
      skippedRowCount: 0,
      dateRange:
        daily.length > 0 ? { start: daily[0]!.date, end: daily[daily.length - 1]!.date } : null,
      warnings: [
        'No Rista sales API access. Using branch-metadata fallback until analytics or sales endpoints are available.',
      ],
      branchesDetected: branches.map((b) => b.branchName).slice(0, 24),
      channelRows: 0,
    },
  };
}

export interface RistaSyncResult {
  daily: ReturnType<typeof ristaAnalyticsToMetrics>['daily'];
  metrics: ReturnType<typeof ristaAnalyticsToMetrics>['metrics'];
  priorMetrics: ReturnType<typeof ristaAnalyticsToMetrics>['priorMetrics'];
  metadata: ReturnType<typeof ristaAnalyticsToMetrics>['metadata'];
  menu?: ReturnType<typeof ristaAnalyticsToMetrics>['menu'];
  branches: { branchCode: string; branchName: string }[];
  salesCount: number;
  daysSynced: number;
  source: 'analytics' | 'sales_page' | 'metadata_fallback';
}

async function fetchAnalyticsRange(
  creds: RistaCredentials,
  branches: { branchCode: string; branchName: string }[],
  dayList: string[]
): Promise<RistaAnalyticsSummary[]> {
  const tasks: { branchCode: string; branchName: string; day: string }[] = [];
  for (const branch of branches) {
    for (const day of dayList) {
      tasks.push({ branchCode: branch.branchCode, branchName: branch.branchName, day });
    }
  }

  const summaries: RistaAnalyticsSummary[] = [];
  for (const batch of chunk(tasks, SYNC_CONCURRENCY)) {
    const results = await Promise.all(
      batch.map(async ({ branchCode, branchName, day }) => {
        try {
          const row = await fetchAnalyticsSalesSummary(creds, branchCode, day);
          if (!row) return null;
          return { ...row, branchName: row.branchName ?? branchName, branchCode, period: day };
        } catch (err) {
          if (err instanceof ApiError && (err.code === 'RISTA_FORBIDDEN' || err.status === 403)) {
            throw err;
          }
          return null;
        }
      })
    );
    for (const row of results) {
      if (row) summaries.push(row);
    }
  }
  return summaries;
}

export async function syncRistaSales(
  creds: RistaCredentials,
  days = DEFAULT_DAYS
): Promise<RistaSyncResult> {
  const safeDays = Math.min(Math.max(1, days), MAX_SYNC_DAYS);
  const branches = (await listRistaBranches(creds)).filter(
    (b) => !b.status || b.status.toLowerCase() === 'active'
  );
  if (branches.length === 0) {
    throw new ApiError(404, 'RISTA_NO_BRANCHES', 'No active Rista branches found for this account.');
  }

  const dayList: string[] = [];
  for (let i = 0; i < safeDays; i++) {
    dayList.push(format(subDays(new Date(), i), 'yyyy-MM-dd'));
  }

  const branchRows = branches.map((b) => ({ branchCode: b.branchCode, branchName: b.branchName }));
  const probeBranch = branches[0]!.branchCode;
  const probeDay = dayList[0]!;

  let analyticsWorks = false;
  try {
    const probe = await fetchAnalyticsSalesSummary(creds, probeBranch, probeDay);
    analyticsWorks = probe !== null;
  } catch (err) {
    if (!(err instanceof ApiError && err.code === 'RISTA_FORBIDDEN')) throw err;
  }

  if (analyticsWorks) {
    const summaries = await fetchAnalyticsRange(creds, branchRows, dayList);
    const parsed = ristaAnalyticsToMetrics(summaries);
    if (parsed.daily.length > 0) {
      return {
        ...parsed,
        branches: branchRows,
        salesCount: summaries.length,
        daysSynced: safeDays,
        source: 'analytics',
      };
    }
  }

  let salesPageWorks = false;
  try {
    const probeSales = await fetchAllSalesForDay(creds, probeBranch, probeDay);
    salesPageWorks = probeSales.length >= 0;
  } catch (err) {
    if (!(err instanceof ApiError && err.code === 'RISTA_FORBIDDEN')) throw err;
  }

  if (salesPageWorks) {
    const allSales: RistaSale[] = [];
    const tasks: { branchCode: string; day: string }[] = [];
    for (const branch of branches) {
      for (const day of dayList) tasks.push({ branchCode: branch.branchCode, day });
    }
    for (const batch of chunk(tasks, SYNC_CONCURRENCY)) {
      const batches = await Promise.all(
        batch.map(async ({ branchCode, day }) => {
          try {
            return await fetchAllSalesForDay(creds, branchCode, day);
          } catch {
            return [];
          }
        })
      );
      for (const sales of batches) allSales.push(...sales);
    }
    const parsed = ristaSalesToMetrics(allSales);
    if (parsed.daily.length > 0) {
      return {
        ...parsed,
        metadata: { ...parsed.metadata, channelRows: 0 },
        branches: branchRows,
        salesCount: allSales.length,
        daysSynced: safeDays,
        source: 'sales_page',
      };
    }
  }

  const fallback = synthesizeFromBranchMetadata(branchRows, safeDays);
  return {
    ...fallback,
    branches: branchRows,
    salesCount: 0,
    daysSynced: safeDays,
    source: 'metadata_fallback',
  };
}
