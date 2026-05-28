'use client';

import { useState, useCallback } from 'react';
import { useIngestedContextStore } from '@/lib/store/ingestedContextStore';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { useIngestionLogStore } from '@/lib/store/ingestionLogStore';
import { ingestFile } from '@/lib/ingestion/ingestFile';
import {
  buildIngestSummary,
  IngestionError,
  schemaLabel,
} from '@/lib/ingestion/types';
import { RistaSync } from '@/components/analytics/RistaSync';

type FileError = 'empty' | 'too_large' | 'unreadable' | 'no_tabular_data' | null;

export function DataIngestion() {
  const setSummary = useIngestedContextStore((s) => s.setSummary);
  const setDaily = useMetricsStore((s) => s.setDaily);
  const setMetrics = useMetricsStore((s) => s.setMetrics);
  const setPriorMetrics = useMetricsStore((s) => s.setPriorMetrics);
  const pushIngestion = useIngestionLogStore((s) => s.pushIngestion);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<FileError>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      setFileError(null);
      setErrorDetail(null);
      setPipelineSteps([]);
      setConfidence(null);
      setFileName(file?.name ?? null);

      if (!file) return;

      setLoading(true);
      try {
        const result = await ingestFile(file);
        setPipelineSteps(result.interpretation.steps);
        setConfidence(result.interpretation.confidence);
        setSummary(buildIngestSummary(file.name, result.metadata, result.interpretation));
        pushIngestion({
          fileName: file.name,
          schema: result.metadata.schema,
          rowCount: result.metadata.rowCount,
          columnCount: result.metadata.columnCount,
          dataRowCount: result.metadata.dataRowCount,
          skippedRowCount: result.metadata.skippedRowCount,
          dailyDays: result.daily.length,
          dateRange: result.metadata.dateRange,
          warnings: [
            ...result.metadata.warnings,
            `Format: ${result.interpretation.format}; schema: ${schemaLabel(result.metadata.schema)}`,
          ],
          branchesDetected: result.metadata.branchesDetected,
        });
        setDaily(result.daily);
        if (Object.keys(result.metrics).length > 0) setMetrics(result.metrics);
        if (Object.keys(result.priorMetrics).length > 0) setPriorMetrics(result.priorMetrics);
      } catch (err) {
        if (err instanceof IngestionError) {
          setFileError(err.code);
          setErrorDetail(err.message);
        } else {
          setFileError('unreadable');
          setErrorDetail(err instanceof Error ? err.message : 'Upload failed');
        }
      } finally {
        setLoading(false);
      }
    },
    [setSummary, setDaily, setMetrics, setPriorMetrics, pushIngestion]
  );

  return (
    <div className="space-y-4">
      <RistaSync />
      <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Upload Data</h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Any file type — CSV, Excel, JSON, PDF exports, logs, HTML, markdown, or raw text. The engine
          preprocesses and interprets whatever structure it finds (tables, dates + amounts, or numeric lines).
        </p>
        <div className="space-y-1">
          <input
            type="file"
            accept="*/*"
            onChange={handleFile}
            disabled={loading}
            className="block w-full text-sm text-[var(--text-secondary)] file:mr-2 file:rounded file:border-0 file:bg-[var(--green)]/20 file:px-3 file:py-1.5 file:text-[var(--green)] disabled:opacity-50"
          />
          {fileName && (
            <p className="text-sm text-[var(--text-secondary)]">
              Selected: <span className="font-medium text-[var(--text-primary)]">{fileName}</span>
              {loading && <span className="ml-2 text-[var(--text-muted)]">Processing…</span>}
            </p>
          )}
        </div>

        {confidence != null && confidence > 0 && (
          <p className="text-xs text-[var(--text-muted)]">
            Interpretation confidence: <span className="text-[var(--green)]">{Math.round(confidence * 100)}%</span>
          </p>
        )}

        {pipelineSteps.length > 0 && (
          <ol className="list-decimal list-inside space-y-0.5 text-xs text-[var(--text-secondary)]">
            {pipelineSteps.map((step, i) => (
              <li key={`${step}-${i}`}>{step}</li>
            ))}
          </ol>
        )}

        {fileError === 'empty' && (
          <p className="text-sm text-[var(--red)]">This file is empty. Please upload a file with data.</p>
        )}
        {fileError === 'too_large' && (
          <p className="text-sm text-[var(--red)]">File exceeds 50MB limit. Try splitting it into smaller files.</p>
        )}
        {(fileError === 'unreadable' || fileError === 'no_tabular_data') && (
          <p className="text-sm text-[var(--red)]">{errorDetail ?? 'Could not interpret this file.'}</p>
        )}
      </div>
    </div>
  );
}
