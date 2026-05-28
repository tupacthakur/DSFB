import Papa from 'papaparse';

const DELIMITERS = [',', '\t', '|', ';'] as const;

export function tryParseDelimitedText(
  text: string,
  preferred?: string
): { headers: string[]; rows: Record<string, string>[]; delimiter: string } | null {
  const order = preferred
    ? [preferred, ...DELIMITERS.filter((d) => d !== preferred)]
    : [...DELIMITERS];

  let best: { headers: string[]; rows: Record<string, string>[]; delimiter: string; score: number } | null =
    null;

  for (const delimiter of order) {
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      transformHeader: (h) => h.trim(),
    });
    const rows = parsed.data.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').trim() !== '')
    );
    const headers = parsed.meta.fields ?? [];
    if (headers.length < 2 || rows.length < 1) continue;

    const score = headers.length * 2 + Math.min(rows.length, 50);
    if (!best || score > best.score) {
      best = { headers, rows, delimiter, score };
    }
  }

  return best ? { headers: best.headers, rows: best.rows, delimiter: best.delimiter } : null;
}
