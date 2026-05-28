import * as XLSX from 'xlsx';
import type { PreprocessedPayload } from '@/lib/ingestion/types';

function cellString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

export function preprocessSpreadsheet(
  buffer: ArrayBuffer,
  fileName: string,
  format: 'xlsx' | 'xls'
): PreprocessedPayload {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const steps: string[] = [`Opened ${format.toUpperCase()} workbook (${wb.SheetNames.length} sheet(s))`];

  let bestSheet = wb.SheetNames[0];
  let bestRows: Record<string, string>[] = [];
  let bestHeaders: string[] = [];

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });
    const rows = json
      .map((row) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(row)) {
          out[String(k).trim()] = cellString(v);
        }
        return out;
      })
      .filter((row) => Object.values(row).some((v) => v !== ''));

    if (rows.length > bestRows.length) {
      bestRows = rows;
      bestSheet = name;
      bestHeaders = rows.length > 0 ? Object.keys(rows[0]!) : [];
    }
  }

  steps.push(`Selected sheet "${bestSheet}" (${bestRows.length} row(s), ${bestHeaders.length} column(s))`);

  return {
    fileName,
    format,
    headers: bestHeaders,
    rows: bestRows,
    steps,
    confidence: bestRows.length > 0 ? 0.85 : 0.2,
  };
}
