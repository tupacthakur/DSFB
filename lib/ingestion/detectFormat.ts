import type { IngestFileFormat } from '@/lib/ingestion/types';

const EXT_MAP: Record<string, IngestFileFormat> = {
  csv: 'csv',
  tsv: 'tsv',
  tab: 'tsv',
  txt: 'txt',
  log: 'log',
  text: 'txt',
  dat: 'txt',
  json: 'json',
  ndjson: 'json',
  xlsx: 'xlsx',
  xls: 'xls',
  md: 'markdown',
  markdown: 'markdown',
};

export function detectFormatFromName(fileName: string): IngestFileFormat {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MAP[ext] ?? 'unstructured';
}

export function isSpreadsheetFormat(format: IngestFileFormat): boolean {
  return format === 'xlsx' || format === 'xls';
}

/** UI hint only — file input accepts all types. */
export const ACCEPTED_INGEST_EXTENSIONS = ['*'] as const;
