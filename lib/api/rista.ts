import { useSettingsStore } from '@/lib/store/settingsStore';
import type { MenuEngineeringSnapshot } from '@/lib/store/metricsStore';

export interface RistaValidateResult {
  valid: boolean;
  reason?: string;
  branchCount?: number;
  branches?: { branchCode: string; branchName: string; status?: string }[];
}

export interface RistaLiveStatus {
  connected: boolean;
  salesApiLicensed: boolean;
  branchCount: number;
  branches: { branchCode: string; branchName: string; status?: string; businessName?: string }[];
  businessName?: string;
  probedAt: string;
  salesProbeMessage?: string;
}

export interface RistaSyncMenuPayload extends MenuEngineeringSnapshot {
  itemCount: number;
}

export interface RistaSyncPayload {
  daily: { date: string; revenue: number; cost: number; covers: number; grossMarginPct: number }[];
  metrics: Record<string, number>;
  priorMetrics: Record<string, number>;
  menu?: RistaSyncMenuPayload;
  metadata: {
    schema: string;
    rowCount: number;
    dataRowCount: number;
    skippedRowCount: number;
    dateRange: { start: string; end: string } | null;
    warnings: string[];
    branchesDetected: string[];
  };
  branches: { branchCode: string; branchName: string }[];
  salesCount: number;
  daysSynced: number;
  source?: 'analytics' | 'sales_page' | 'metadata_fallback';
}

function ristaBodyFromSettings(): { apiKey?: string; secretKey?: string } {
  if (typeof window === 'undefined') return {};
  const { ristaKeySource, ristaApiKey, ristaSecretKey } = useSettingsStore.getState();
  if (ristaKeySource !== 'settings') return {};
  const apiKey = ristaApiKey?.trim();
  const secretKey = ristaSecretKey?.trim();
  if (!apiKey || !secretKey) return {};
  return { apiKey, secretKey };
}

export async function fetchRistaLiveStatus(): Promise<RistaLiveStatus> {
  const body = ristaBodyFromSettings();
  const usePost = !!(body.apiKey && body.secretKey);
  const res = await fetch('/api/rista/status', {
    method: usePost ? 'POST' : 'GET',
    headers: usePost ? { 'Content-Type': 'application/json' } : undefined,
    body: usePost ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as RistaLiveStatus & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? 'Live status check failed');
  }
  return data;
}

export async function validateRistaConnection(): Promise<RistaValidateResult> {
  const body = ristaBodyFromSettings();
  const res = await fetch('/api/rista/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as RistaValidateResult & { error?: string; message?: string };
  if (!res.ok) {
    return { valid: false, reason: data.message ?? data.error ?? 'Validation failed' };
  }
  return data;
}

export async function syncRistaFromApi(days = 30): Promise<RistaSyncPayload> {
  const body = { ...ristaBodyFromSettings(), days };
  const res = await fetch('/api/rista/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as RistaSyncPayload & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? `Sync failed (${res.status})`);
  }
  return data;
}
