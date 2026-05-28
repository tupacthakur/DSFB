import type { PreprocessedPayload } from '@/lib/ingestion/types';

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      Object.assign(out, flattenObject(v as Record<string, unknown>, key));
    } else if (Array.isArray(v)) {
      out[key] = JSON.stringify(v);
    } else {
      out[key] = String(v ?? '').trim();
    }
  }
  return out;
}

export function preprocessJson(buffer: ArrayBuffer, fileName: string): PreprocessedPayload {
  const text = new TextDecoder('utf-8').decode(buffer);
  const steps: string[] = ['Parsed JSON payload'];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    parsed = lines.map((line) => JSON.parse(line));
    steps.push('Interpreted as newline-delimited JSON (NDJSON)');
  }

  let rows: Record<string, string>[] = [];

  if (Array.isArray(parsed)) {
    rows = parsed
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => flattenObject(item as Record<string, unknown>));
    steps.push(`Flattened ${rows.length} object(s) from array`);
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const dataKey = ['data', 'rows', 'records', 'items', 'results', 'sales'].find(
      (k) => Array.isArray(obj[k])
    );
    if (dataKey && Array.isArray(obj[dataKey])) {
      rows = (obj[dataKey] as unknown[])
        .filter((item) => item && typeof item === 'object')
        .map((item) => flattenObject(item as Record<string, unknown>));
      steps.push(`Extracted "${dataKey}" array (${rows.length} row(s))`);
    } else {
      rows = [flattenObject(obj)];
      steps.push('Wrapped single JSON object as one row');
    }
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];

  return {
    fileName,
    format: 'json',
    headers,
    rows,
    steps,
    confidence: rows.length > 0 ? 0.8 : 0.15,
  };
}
