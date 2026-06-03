import { format, subDays } from 'date-fns';
import type { RistaCredentials } from '@/lib/server/services/rista/auth';
import {
  fetchAnalyticsSalesSummary,
  fetchSalesPage,
  listRistaBranches,
  type RistaBranch,
} from '@/lib/server/services/rista/client';
import { ApiError } from '@/lib/server/api/errors';

export interface RistaLiveStatus {
  connected: boolean;
  salesApiLicensed: boolean;
  branchCount: number;
  branches: RistaBranch[];
  businessName?: string;
  probedAt: string;
  salesProbeMessage?: string;
}

/** Live connectivity: branch list + one sales/page probe on first active branch. */
export async function getRistaLiveStatus(creds: RistaCredentials): Promise<RistaLiveStatus> {
  const probedAt = new Date().toISOString();
  const branches = (await listRistaBranches(creds)).filter(
    (b) => !b.status || b.status.toLowerCase() === 'active'
  );
  const businessName = branches[0]?.businessName;

  if (branches.length === 0) {
    return {
      connected: true,
      salesApiLicensed: false,
      branchCount: 0,
      branches: [],
      businessName,
      probedAt,
      salesProbeMessage: 'No active branches returned.',
    };
  }

  const probeBranch = branches[0]!.branchCode;
  const probeDay = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  let salesApiLicensed = false;
  let salesProbeMessage: string | undefined;

  try {
    const analytics = await fetchAnalyticsSalesSummary(creds, probeBranch, probeDay);
    if (analytics) {
      salesApiLicensed = true;
      const channels = (analytics.channelSummary ?? []).map((c) => c.name).filter(Boolean);
      salesProbeMessage =
        channels.length > 0
          ? `Analytics sales summary accessible (channels: ${channels.join(', ')}).`
          : 'Analytics sales summary accessible.';
    } else {
      await fetchSalesPage(creds, probeBranch, probeDay);
      salesApiLicensed = true;
      salesProbeMessage = 'Sales page API accessible.';
    }
  } catch (err) {
    if (err instanceof ApiError && err.code === 'RISTA_FORBIDDEN') {
      salesApiLicensed = false;
      salesProbeMessage =
        'Sales/analytics endpoints denied for this API key. Enable Sales Enterprise + API licence in Rista Admin → Access Menu.';
    } else if (err instanceof ApiError) {
      salesApiLicensed = true;
      salesProbeMessage = `Sales API reachable (${err.code}).`;
    } else {
      salesProbeMessage = 'Sales probe failed unexpectedly.';
    }
  }

  return {
    connected: true,
    salesApiLicensed,
    branchCount: branches.length,
    branches,
    businessName,
    probedAt,
    salesProbeMessage,
  };
}
