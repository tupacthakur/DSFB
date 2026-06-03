'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, AlertCircle, Radio } from 'lucide-react';
import { fetchRistaLiveStatus, syncRistaFromApi, type RistaLiveStatus } from '@/lib/api/rista';
import { useIngestedContextStore } from '@/lib/store/ingestedContextStore';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { useIngestionLogStore } from '@/lib/store/ingestionLogStore';
import { useSettingsStore } from '@/lib/store/settingsStore';

const DAY_OPTIONS = [7, 30, 90] as const;

export function RistaSync() {
  const ristaConfigured = useSettingsStore((s) => s.ristaConfigured);
  const ristaKeySource = useSettingsStore((s) => s.ristaKeySource);
  const setSummary = useIngestedContextStore((s) => s.setSummary);
  const setDaily = useMetricsStore((s) => s.setDaily);
  const setMetrics = useMetricsStore((s) => s.setMetrics);
  const setPriorMetrics = useMetricsStore((s) => s.setPriorMetrics);
  const setMenuEngineering = useMetricsStore((s) => s.setMenuEngineering);
  const pushIngestion = useIngestionLogStore((s) => s.pushIngestion);

  const [live, setLive] = useState<RistaLiveStatus | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [days, setDays] = useState<number>(14);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const refreshLive = useCallback(async () => {
    if (!ristaConfigured) return;
    setLiveLoading(true);
    try {
      const data = await fetchRistaLiveStatus();
      setLive(data);
    } catch (err) {
      setLive(null);
      setMessage(err instanceof Error ? err.message : 'Live status unavailable');
      setStatus('error');
    } finally {
      setLiveLoading(false);
    }
  }, [ristaConfigured]);

  useEffect(() => {
    if (ristaConfigured) refreshLive();
  }, [ristaConfigured, ristaKeySource, refreshLive]);

  const applySyncResult = useCallback(
    (result: Awaited<ReturnType<typeof syncRistaFromApi>>) => {
      setDaily(result.daily);
      setMetrics(result.metrics);
      setPriorMetrics(result.priorMetrics);
      if (result.menu && result.menu.itemCount > 0) {
        setMenuEngineering({
          menuItems: result.menu.menuItems,
          menuItemsForEngineering: result.menu.menuItemsForEngineering,
          categoryPL: result.menu.categoryPL,
          avgVolumeThreshold: result.menu.avgVolumeThreshold,
          targetMargin: result.menu.targetMargin,
        });
      }
      const range = result.metadata.dateRange;
      const rangeLabel = range ? ` ${range.start} → ${range.end}.` : '';
      setSummary(
        `Rista live sync: ${result.salesCount} sale(s), ${result.branches.length} outlet(s), ${result.daily.length} day(s).${rangeLabel}`
      );
      pushIngestion({
        fileName: 'Rista API (live)',
        schema: 'rista_sales_audit',
        rowCount: result.metadata.rowCount,
        columnCount: 0,
        dataRowCount: result.metadata.dataRowCount,
        skippedRowCount: result.metadata.skippedRowCount,
        dailyDays: result.daily.length,
        dateRange: result.metadata.dateRange,
        warnings: result.metadata.warnings,
        branchesDetected: result.metadata.branchesDetected,
      });
    },
    [setSummary, setDaily, setMetrics, setPriorMetrics, setMenuEngineering, pushIngestion]
  );

  const handleSync = useCallback(async () => {
    if (!ristaConfigured) {
      setMessage('Add Rista credentials in .env.local or Settings.');
      setStatus('error');
      return;
    }
    setStatus('syncing');
    setMessage(null);
    try {
      const result = await syncRistaFromApi(days);
      applySyncResult(result);
      setStatus('ok');
      const sourceLabel =
        (result as { source?: string }).source === 'analytics'
          ? 'Rista analytics (channel-level)'
          : (result as { source?: string }).source === 'sales_page'
            ? 'Rista sales page'
            : 'metadata fallback';
      setMessage(
        `Sync complete via ${sourceLabel}: ${result.salesCount} record(s) · ${result.branches.length} branches · ${days} days · ${result.daily.length} day(s) in dashboard.`
      );
      await refreshLive();
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Rista sync failed');
    }
  }, [ristaConfigured, live, days, applySyncResult, refreshLive]);

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Rista POS (live)</h2>
        {ristaConfigured ? (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--green)]">
            <Radio className="h-3.5 w-3.5" />
            {liveLoading ? 'Checking…' : live?.connected ? 'Live' : 'Connected'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <AlertCircle className="h-3.5 w-3.5" />
            Not configured
          </span>
        )}
      </div>

      {live && (
        <div className="space-y-2 text-xs text-[var(--text-secondary)]">
          {live.businessName && (
            <p>
              Business: <span className="font-medium text-[var(--text-primary)]">{live.businessName}</span>
            </p>
          )}
          <p>
            Outlets: <span className="text-[var(--text-primary)]">{live.branchCount}</span>
            {' · '}
            Sales API:{' '}
            {live.salesApiLicensed ? (
              <span className="text-[var(--green)]">licensed</span>
            ) : (
              <span className="text-[var(--amber)]">not licensed</span>
            )}
          </p>
          {live.salesProbeMessage && (
            <p className="leading-relaxed text-[var(--text-muted)]">{live.salesProbeMessage}</p>
          )}
          {live.branches.length > 0 && (
            <ul className="max-h-28 overflow-y-auto rounded border border-[var(--border-default)] bg-[var(--bg-base)] p-2 space-y-0.5">
              {live.branches.map((b) => (
                <li key={b.branchCode}>
                  {b.branchName} <span className="text-[var(--text-muted)]">({b.branchCode})</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[var(--text-muted)]">Last probe: {new Date(live.probedAt).toLocaleString()}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-[var(--text-secondary)]">Days</label>
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded px-2 py-1 text-xs ${
              days === d
                ? 'bg-[var(--green)]/20 text-[var(--green)]'
                : 'border border-[var(--border-default)] text-[var(--text-muted)]'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSync}
          disabled={!ristaConfigured || status === 'syncing' || liveLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--green)]/20 px-3 py-2 text-sm font-medium text-[var(--green)] hover:bg-[var(--green)]/30 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          {status === 'syncing' ? 'Syncing live data…' : 'Sync live sales'}
        </button>
        <button
          type="button"
          onClick={refreshLive}
          disabled={!ristaConfigured || liveLoading}
          className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
        >
          Refresh status
        </button>
      </div>

      {message && (
        <p
          className={`text-xs leading-relaxed ${
            status === 'error' ? 'text-[var(--red)]' : 'text-[var(--green)]'
          }`}
        >
          {message}
        </p>
      )}

      {ristaConfigured && live?.salesApiLicensed && status === 'idle' && !message && (
        <p className="text-xs text-[var(--text-muted)]">
          Credentials are live. Click sync to pull sales into Executive and Analytics.
        </p>
      )}
    </div>
  );
}
