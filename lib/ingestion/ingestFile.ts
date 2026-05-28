import { preprocessBuffer } from '@/lib/ingestion/preprocess';
import { interpretPayload } from '@/lib/ingestion/interpret';
import { synthesizeMetricsFromRows } from '@/lib/ingestion/synthesize';
import type { IngestionResult } from '@/lib/ingestion/types';
import { IngestionError } from '@/lib/ingestion/types';

export const MAX_INGEST_BYTES = 52_428_800;

export async function ingestFile(file: File): Promise<IngestionResult> {
  if (file.size === 0) {
    throw new IngestionError('empty', 'This file is empty.');
  }
  if (file.size > MAX_INGEST_BYTES) {
    throw new IngestionError('too_large', 'File exceeds 50MB limit.');
  }

  const buffer = await file.arrayBuffer();
  const preprocessed = preprocessBuffer(buffer, file.name);

  if (preprocessed.rows.length === 0) {
    throw new IngestionError(
      'no_tabular_data',
      'No numbers or tables were found. Any text/Excel/JSON/CSV/log file with amounts or columns should work.'
    );
  }

  let result = interpretPayload(preprocessed);

  if (result.daily.length === 0) {
    const synthesized = synthesizeMetricsFromRows(
      preprocessed.headers,
      preprocessed.rows,
      preprocessed.fileName
    );
    if (synthesized) {
      result = {
        ...synthesized,
        interpretation: {
          format: preprocessed.format,
          steps: [...preprocessed.steps, ...result.interpretation.steps, 'Synthesized daily metrics from inferred numbers'],
          confidence: Math.max(0.35, result.interpretation.confidence),
          columnMapping: result.interpretation.columnMapping,
          detectedSchema: synthesized.metadata.schema,
        },
      };
    }
  }

  if (result.daily.length === 0) {
    throw new IngestionError(
      'unreadable',
      result.metadata.warnings[0] ??
        'Could not build a daily series. Include dates and amounts, or tabular numeric data.'
    );
  }

  return result;
}
