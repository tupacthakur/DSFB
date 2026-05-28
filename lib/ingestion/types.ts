import type { CsvIngestionMetadata, CsvMetricsResult, CsvSchemaId } from '@/lib/parsers/csvToMetrics';

export type IngestFileFormat =
  | 'csv'
  | 'tsv'
  | 'xlsx'
  | 'xls'
  | 'json'
  | 'txt'
  | 'log'
  | 'markdown'
  | 'unstructured';

export interface ColumnMapping {
  date?: string;
  revenue?: string;
  cost?: string;
  covers?: string;
  branch?: string;
}

export interface PreprocessedPayload {
  fileName: string;
  format: IngestFileFormat;
  headers: string[];
  rows: Record<string, string>[];
  encoding?: string;
  steps: string[];
  confidence: number;
}

export interface InterpretationReport {
  format: IngestFileFormat;
  steps: string[];
  confidence: number;
  columnMapping: ColumnMapping;
  detectedSchema: CsvSchemaId;
}

export interface IngestionResult extends CsvMetricsResult {
  interpretation: InterpretationReport;
}

export type IngestionErrorCode =
  | 'empty'
  | 'too_large'
  | 'unreadable'
  | 'no_tabular_data';

export class IngestionError extends Error {
  constructor(
    public code: IngestionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'IngestionError';
  }
}

export function schemaLabel(schema: CsvSchemaId): string {
  switch (schema) {
    case 'rista_sales_audit':
      return 'Rista Sales Audit';
    case 'swiggy_annexure':
      return 'Swiggy Annexure';
    case 'inventory_snapshot':
      return 'Inventory snapshot';
    default:
      return 'Generic / inferred';
  }
}

export function buildIngestSummary(
  fileName: string,
  meta: CsvIngestionMetadata,
  interpretation: InterpretationReport
): string {
  const range =
    meta.dateRange != null ? ` Date span: ${meta.dateRange.start} → ${meta.dateRange.end}.` : '';
  const branch =
    meta.branchesDetected.length > 1
      ? ` Outlets: ${meta.branchesDetected.length} (${meta.branchesDetected.slice(0, 3).join(', ')}…).`
      : meta.branchesDetected.length === 1
        ? ` Outlet: ${meta.branchesDetected[0]}.`
        : '';
  const warn =
    meta.warnings.length > 0 ? ` Warnings (${meta.warnings.length}): ${meta.warnings.join(' ')}` : '';
  const steps =
    interpretation.steps.length > 0
      ? ` Pipeline: ${interpretation.steps.join(' → ')}.`
      : '';
  return (
    `Ingested ${fileName} (${interpretation.format}, ${Math.round(interpretation.confidence * 100)}% confidence): ` +
    `${meta.dataRowCount} row(s), schema ${schemaLabel(meta.schema)}.${range}${branch}${steps}${warn} ` +
    `Dashboards updated.`
  );
}
