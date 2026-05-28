import { decodeWithFallback } from '@/lib/parsers/encoding';
import { validateXlsxMagicBytes } from '@/lib/parsers/validateXlsx';
import { detectFormatFromName, isSpreadsheetFormat } from '@/lib/ingestion/detectFormat';
import type { IngestFileFormat, PreprocessedPayload } from '@/lib/ingestion/types';
import { tryParseDelimitedText } from '@/lib/ingestion/preprocess/delimiter';
import { preprocessJson } from '@/lib/ingestion/preprocess/json';
import { preprocessSpreadsheet } from '@/lib/ingestion/preprocess/xlsx';
import {
  extractMarkdownTable,
  extractRecordsFromText,
} from '@/lib/ingestion/preprocess/unstructured';
import {
  extractHtmlTables,
  extractKeyValueAmounts,
  extractNumericLines,
  extractPrintableRuns,
  parseHeaderlessDelimited,
} from '@/lib/ingestion/preprocess/fallback';

function payload(
  fileName: string,
  format: IngestFileFormat,
  headers: string[],
  rows: Record<string, string>[],
  steps: string[],
  confidence: number,
  encoding?: string
): PreprocessedPayload {
  return { fileName, format, headers, rows, steps, confidence, encoding };
}

export function preprocessBuffer(buffer: ArrayBuffer, fileName: string): PreprocessedPayload {
  const format = detectFormatFromName(fileName);
  const steps: string[] = [];

  if (isSpreadsheetFormat(format) || validateXlsxMagicBytes(buffer)) {
    const xl = preprocessSpreadsheet(buffer, fileName, format === 'xls' ? 'xls' : 'xlsx');
    if (xl.rows.length > 0) return xl;
    steps.push(...xl.steps, 'Spreadsheet empty — falling back to text extraction');
  }

  if (format === 'json') {
    try {
      const j = preprocessJson(buffer, fileName);
      if (j.rows.length > 0) return j;
      steps.push(...j.steps, 'JSON had no rows — trying as text');
    } catch {
      steps.push('Invalid JSON — trying as plain text');
    }
  }

  let text = '';
  let encoding: string | undefined;
  try {
    const decoded = decodeWithFallback(buffer);
    text = decoded.text;
    encoding = decoded.encoding;
    if (encoding === 'windows-1252') steps.push('Decoded as Windows-1252');
  } catch {
    steps.push('UTF-8 decode failed — extracting printable strings from binary');
    text = extractPrintableRuns(buffer);
  }

  if (!text.trim()) {
    text = extractPrintableRuns(buffer);
    if (text.trim()) steps.push('Recovered text from binary via printable-string scan');
  }

  const preferredDelimiter = format === 'tsv' ? '\t' : undefined;
  const delimited = tryParseDelimitedText(text, preferredDelimiter);
  if (delimited && delimited.rows.length > 0) {
    steps.push(`Detected delimited text (separator: ${delimited.delimiter === '\t' ? 'tab' : delimited.delimiter})`);
    return payload(
      fileName,
      format === 'tsv' ? 'tsv' : 'csv',
      delimited.headers,
      delimited.rows,
      steps,
      0.9,
      encoding
    );
  }

  const headerless = parseHeaderlessDelimited(text);
  if (headerless && headerless.rows.length > 0) {
    steps.push('Parsed headerless delimited grid (synthetic column names)');
    return payload(fileName, 'unstructured', headerless.headers, headerless.rows, steps, 0.65, encoding);
  }

  const html = extractHtmlTables(text);
  if (html && html.rows.length > 0) {
    steps.push('Extracted HTML table');
    return payload(fileName, 'unstructured', html.headers, html.rows, steps, 0.7, encoding);
  }

  if (format === 'markdown' || text.includes('|')) {
    const md = extractMarkdownTable(text);
    if (md && md.rows.length > 0) {
      steps.push('Extracted markdown / pipe table');
      return payload(fileName, 'markdown', md.headers, md.rows, steps, 0.75, encoding);
    }
  }

  const structured = extractRecordsFromText(text);
  if (structured.length > 0) {
    steps.push(`Matched ${structured.length} line(s) with date + amount`);
    return payload(
      fileName,
      'unstructured',
      ['date', 'revenue', 'cost', 'covers', 'branch'],
      structured,
      steps,
      0.55,
      encoding
    );
  }

  const kv = extractKeyValueAmounts(text);
  if (kv.length > 0) {
    steps.push(`Extracted ${kv.length} key–value amount field(s)`);
    return payload(
      fileName,
      'unstructured',
      ['date', 'revenue', 'cost', 'covers', 'branch'],
      kv,
      steps,
      0.45,
      encoding
    );
  }

  const numeric = extractNumericLines(text);
  if (numeric.length > 0) {
    steps.push(`Inferred ${numeric.length} numeric line(s) with rolling dates`);
    return payload(
      fileName,
      'unstructured',
      ['date', 'revenue', 'cost', 'covers', 'branch'],
      numeric,
      steps,
      0.4,
      encoding
    );
  }

  steps.push('No structure detected — file stored for context only');
  return payload(fileName, format, [], [], steps, 0, encoding);
}
