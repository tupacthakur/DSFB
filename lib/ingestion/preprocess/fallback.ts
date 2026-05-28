import { format, subDays } from 'date-fns';
import { parseFlexibleDate } from '@/lib/ingestion/dateParse';
import Papa from 'papaparse';

const NUM_RE = /-?\d[\d,]*(?:\.\d+)?/g;
const KV_RE =
  /(?:revenue|sales|total|amount|net|gross|turnover|collection)[\s:=-]+[₹$]?\s*([\d,]+(?:\.\d+)?)/gi;

function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(/[₹$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** key: value and label — amount lines without explicit dates. */
export function extractKeyValueAmounts(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = text.split(/\r?\n/);
  let dayOffset = 0;
  for (const line of lines) {
    KV_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = KV_RE.exec(line)) !== null) {
      const amount = parseNum(m[1]!);
      if (amount > 0) {
        rows.push({
          date: format(subDays(new Date(), dayOffset), 'yyyy-MM-dd'),
          revenue: String(amount),
          cost: '',
          covers: '1',
          branch: '',
        });
        dayOffset++;
      }
    }
  }
  return rows;
}

/** Lines with numbers but no date — assign rolling recent dates. */
export function extractNumericLines(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;
    if (parseFlexibleDate(trimmed)) continue;
    const nums = trimmed.match(NUM_RE);
    if (!nums || nums.length === 0) continue;
    const values = nums.map(parseNum).filter((n) => n > 0 && n < 1e12);
    if (values.length === 0) continue;
    const revenue = values.length > 1 ? values[values.length - 1]! : values[0]!;
    if (revenue <= 0) continue;
    rows.push({
      date: format(subDays(new Date(), i % 90), 'yyyy-MM-dd'),
      revenue: String(revenue),
      cost: values.length > 2 ? String(values[values.length - 2]) : '',
      covers: '1',
      branch: '',
    });
    i++;
  }
  return rows;
}

/** Simple HTML table extraction. */
export function extractHtmlTables(text: string): { headers: string[]; rows: Record<string, string>[] } | null {
  if (!/<table[\s>]/i.test(text)) return null;
  const rows: Record<string, string>[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const tableRows: string[][] = [];
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(text)) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    const rowHtml = trMatch[1]!;
    while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1]!.replace(/<[^>]+>/g, '').trim());
    }
    if (cells.length > 0) tableRows.push(cells);
  }
  if (tableRows.length < 2) return null;
  const headers = tableRows[0]!.map((h, i) => (h ? h : `col${i + 1}`));
  for (let r = 1; r < tableRows.length; r++) {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = tableRows[r]![i] ?? '';
    });
    if (Object.values(row).some((v) => v)) rows.push(row);
  }
  return rows.length > 0 ? { headers, rows } : null;
}

/** Parse text with no header row — synthesize col1,col2,... */
export function parseHeaderlessDelimited(text: string): { headers: string[]; rows: Record<string, string>[] } | null {
  for (const delimiter of [',', '\t', '|', ';']) {
    const parsed = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: true,
      delimiter,
    });
    const data = parsed.data.filter((row) => row.some((c) => String(c ?? '').trim() !== ''));
    if (data.length < 2 || (data[0]?.length ?? 0) < 2) continue;
    const colCount = Math.max(...data.map((r) => r.length));
    const headers = Array.from({ length: colCount }, (_, i) => `col${i + 1}`);
    const rows = data.map((cells) => {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = String(cells[i] ?? '').trim();
      });
      return row;
    });
    return { headers, rows };
  }
  return null;
}

/** Pull printable runs from binary-ish files (exports, PDF text layers, etc.). */
export function extractPrintableRuns(buffer: ArrayBuffer, minRun = 40): string {
  const bytes = new Uint8Array(buffer);
  const parts: string[] = [];
  let run = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]!;
    if (c >= 32 && c <= 126) {
      run += String.fromCharCode(c);
    } else if (run.length >= minRun) {
      parts.push(run);
      run = '';
    } else {
      run = '';
    }
  }
  if (run.length >= minRun) parts.push(run);
  return parts.join('\n');
}
