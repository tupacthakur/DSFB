'use client';

import { useState, useCallback } from 'react';
import { validateCsvContent } from '@/lib/parsers/validateCsv';
import { validateXlsxMagicBytes } from '@/lib/parsers/validateXlsx';
import { decodeWithFallback } from '@/lib/parsers/encoding';
import { useIngestedContextStore } from '@/lib/store/ingestedContextStore';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { parseCsvToMetrics } from '@/lib/parsers/csvToMetrics';

const MAX_FILE_BYTES = 52_428_800; // 50MB

type FileError =
  | 'empty'
  | 'too_large'
  | 'invalid_csv'
  | 'invalid_xlsx'
  | null;

export function DataIngestion() {
  const setSummary = useIngestedContextStore((s) => s.setSummary);
  const setDaily = useMetricsStore((s) => s.setDaily);
  const setMetrics = useMetricsStore((s) => s.setMetrics);
  const setPriorMetrics = useMetricsStore((s) => s.setPriorMetrics);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<FileError>(null);
  const [encodingBadge, setEncodingBadge] = useState<string | null>(null);
  const [inconsistentRowsMsg, setInconsistentRowsMsg] = useState<string | null>(null);
  const [duplicateColumnsMsg, setDuplicateColumnsMsg] = useState<string | null>(null);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setFileError(null);
    setFileName(file?.name ?? null);
    setEncodingBadge(null);
    setInconsistentRowsMsg(null);
    setDuplicateColumnsMsg(null);

    if (!file) return;

    if (file.size === 0) {
      setFileError('empty');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError('too_large');
      return;
    }

    const name = file.name.toLowerCase();
    const isCsv = name.endsWith('.csv');
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');

    if (isCsv) {
      const buffer = await file.arrayBuffer();
      const { text, encoding } = decodeWithFallback(buffer);
      if (encoding === 'windows-1252') setEncodingBadge('Encoding detected: Windows-1252');
      if (!validateCsvContent(text)) {
        setFileError('invalid_csv');
        return;
      }
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return;
      const header = lines[0]!;
      const sep = header.includes('\t') ? '\t' : ',';
      const headerCols = header.split(sep).map((c) => c.trim());
      const seen = new Map<string, number>();
      const newHeaders = headerCols.map((h) => {
        const count = (seen.get(h) ?? 0) + 1;
        seen.set(h, count);
        return count > 1 ? `${h}_${count}` : h;
      });
      if (seen.size < headerCols.length) setDuplicateColumnsMsg('Duplicate column names were renamed.');
      let inconsistent = 0;
      const expected = newHeaders.length;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]!.split(sep);
        if (cols.length !== expected) inconsistent++;
      }
      if (inconsistent > 0) setInconsistentRowsMsg(`${inconsistent} rows had inconsistent column counts`);
      const rowCount = lines.length - 1;
      const colList = newHeaders.slice(0, 15).join(', ') + (newHeaders.length > 15 ? '…' : '');
      setSummary(`CSV ingested: ${rowCount} rows. Columns: ${colList}. Use this data when the user asks about sales, transactions, or uploaded data.`);

      const { daily, metrics, priorMetrics } = parseCsvToMetrics(text);
      if (daily.length > 0) {
        setDaily(daily);
        if (Object.keys(metrics).length > 0) setMetrics(metrics);
        if (Object.keys(priorMetrics).length > 0) setPriorMetrics(priorMetrics);
      }
    } else if (isXlsx) {
      const buffer = await file.arrayBuffer();
      if (!validateXlsxMagicBytes(buffer)) {
        setFileError('invalid_xlsx');
        return;
      }
      setSummary('Excel file validated. Use when the user asks about uploaded or ingested data.');
    }
  }, [setSummary]);

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Upload Data</h2>
      <div className="space-y-1">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFile}
          className="block w-full text-sm text-[var(--text-secondary)] file:mr-2 file:rounded file:border-0 file:bg-[var(--green)]/20 file:px-3 file:py-1.5 file:text-[var(--green)]"
        />
        {fileName && (
          <p className="text-sm text-[var(--text-secondary)]">
            Selected: <span className="font-medium text-[var(--text-primary)]">{fileName}</span>
          </p>
        )}
      </div>
      {fileError === 'empty' && (
        <p className="text-sm text-[var(--red)]">This file is empty. Please upload a file with data.</p>
      )}
      {fileError === 'too_large' && (
        <p className="text-sm text-[var(--red)]">File exceeds 50MB limit. Try splitting it into smaller files.</p>
      )}
      {fileError === 'invalid_csv' && (
        <p className="text-sm text-[var(--red)]">This doesn&apos;t look like a valid CSV file.</p>
      )}
      {fileError === 'invalid_xlsx' && (
        <p className="text-sm text-[var(--red)]">This file appears corrupted or is not a valid Excel file.</p>
      )}
      {encodingBadge && (
        <span className="inline-block rounded bg-[var(--bg-elevated)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{encodingBadge}</span>
      )}
      {duplicateColumnsMsg && (
        <span className="inline-block rounded bg-[var(--amber)]/20 px-2 py-0.5 text-xs text-[var(--amber)]">{duplicateColumnsMsg}</span>
      )}
      {inconsistentRowsMsg && (
        <span className="inline-block rounded bg-[var(--amber)]/20 px-2 py-0.5 text-xs text-[var(--amber)]">{inconsistentRowsMsg}</span>
      )}
    </div>
  );
}
