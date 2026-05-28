import { parseFlexibleDate } from '@/lib/ingestion/dateParse';

const DATE_RE =
  /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i;

function parseAmount(line: string): number {
  const re = /₹?\s*[\d,]+(?:\.\d{1,2})?/g;
  let match: RegExpExecArray | null;
  let last = '';
  while ((match = re.exec(line)) !== null) {
    last = match[0];
  }
  if (!last) return 0;
  const n = parseFloat(last.replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Extract date + amount pairs from free-form lines (reports, exports, logs). */
export function extractRecordsFromText(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 6) continue;
    const dateMatch = trimmed.match(DATE_RE);
    if (!dateMatch) continue;
    const date = parseFlexibleDate(dateMatch[1]!);
    if (!date) continue;
    const amount = parseAmount(trimmed);
    if (amount <= 0) continue;
    rows.push({ date, revenue: String(amount), cost: '', covers: '1', branch: '' });
  }

  return rows;
}

/** Parse GitHub-style markdown tables. */
export function extractMarkdownTable(text: string): { headers: string[]; rows: Record<string, string>[] } | null {
  const lines = text.split(/\r?\n/).filter((l) => l.includes('|'));
  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] =>
    line
      .split('|')
      .map((c) => c.trim())
      .filter((_, i, arr) => !(i === 0 && arr[0] === '') && !(i === arr.length - 1 && arr[arr.length - 1] === ''));

  const headerLine = lines.find((l) => !/^\|?[\s\-:|]+\|?$/.test(l));
  if (!headerLine) return null;
  const headers = parseRow(headerLine);
  if (headers.length < 2) return null;

  const dataLines = lines.filter((l) => !/^\|?[\s\-:|]+\|?$/.test(l) && l !== headerLine);
  const rows = dataLines.map((line) => {
    const cells = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });

  return rows.length > 0 ? { headers, rows } : null;
}
