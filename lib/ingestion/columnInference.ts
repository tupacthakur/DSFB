import { looksLikeDate, parseFlexibleDate } from '@/lib/ingestion/dateParse';

const DATE_HINTS = ['date', 'day', 'time', 'created', 'invoice', 'business', 'order', 'sale'];
const REVENUE_HINTS = ['revenue', 'sales', 'amount', 'total', 'net', 'gross', 'value', 'payable', 'bill'];
const COST_HINTS = ['cost', 'cogs', 'material', 'fee', 'expense'];
const COVERS_HINTS = ['cover', 'guest', 'qty', 'quantity', 'ticket', 'order', 'pax', 'count'];
const BRANCH_HINTS = ['branch', 'outlet', 'store', 'location', 'warehouse'];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function headerScore(header: string, hints: string[]): number {
  const n = normalizeHeader(header);
  for (const hint of hints) {
    if (n === hint || n.includes(hint)) return 1;
  }
  return 0;
}

function parseNum(val: string): number {
  const s = String(val ?? '').replace(/[₹,\s]/g, '').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export interface ColumnRoles {
  date: number;
  revenue: number;
  cost: number;
  covers: number;
  branch: number;
}

function scoreColumn(
  header: string,
  values: string[],
  kind: 'date' | 'number' | 'text'
): number {
  let headerBoost = 0;
  if (kind === 'date') headerBoost = headerScore(header, DATE_HINTS) * 0.35;
  if (kind === 'number') headerBoost = Math.max(headerScore(header, REVENUE_HINTS), headerScore(header, COST_HINTS)) * 0.35;
  if (kind === 'text') headerBoost = headerScore(header, BRANCH_HINTS) * 0.35;

  const sample = values.filter((v) => String(v ?? '').trim() !== '').slice(0, 80);
  if (sample.length === 0) return headerBoost;

  let hits = 0;
  for (const v of sample) {
    if (kind === 'date' && looksLikeDate(v)) hits++;
    if (kind === 'number' && parseNum(v) !== 0 && !looksLikeDate(v)) hits++;
    if (kind === 'text' && String(v).trim().length > 1 && parseNum(v) === 0 && !looksLikeDate(v)) hits++;
  }
  return headerBoost + hits / sample.length;
}

export function inferColumnRoles(
  headers: string[],
  rows: Record<string, string>[]
): ColumnRoles | null {
  if (headers.length < 2 || rows.length === 0) return null;

  const colValues = headers.map((h) => rows.map((r) => String(r[h] ?? '')));

  const dateScores = headers.map((h, i) => scoreColumn(h, colValues[i]!, 'date'));
  const numScores = headers.map((h, i) => scoreColumn(h, colValues[i]!, 'number'));
  const textScores = headers.map((h, i) => scoreColumn(h, colValues[i]!, 'text'));

  const date = dateScores.indexOf(Math.max(...dateScores));
  let revenue = numScores.indexOf(Math.max(...numScores));
  if (revenue === date) {
    const sorted = [...numScores].map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
    revenue = sorted.find((x) => x.i !== date)?.i ?? revenue;
  }

  const costCandidates = numScores
    .map((s, i) => ({ s, i }))
    .filter((x) => x.i !== date && x.i !== revenue)
    .sort((a, b) => b.s - a.s);
  const cost = costCandidates[0]?.i ?? -1;

  const branchCandidates = textScores
    .map((s, i) => ({ s, i }))
    .filter((x) => x.i !== date && x.i !== revenue)
    .sort((a, b) => b.s - a.s);
  const branch = branchCandidates[0]?.s > 0.25 ? branchCandidates[0].i : -1;

  const coversCandidates = headers
    .map((h, i) => ({ i, s: headerScore(h, COVERS_HINTS) + (parseNum(colValues[i]![0] ?? '') > 0 && parseNum(colValues[i]![0] ?? '') < 5000 ? 0.2 : 0) }))
    .filter((x) => x.i !== date && x.i !== revenue)
    .sort((a, b) => b.s - a.s);
  const covers = coversCandidates[0]?.s > 0.2 ? coversCandidates[0].i : -1;

  if (dateScores[date]! < 0.2 || numScores[revenue]! < 0.15) return null;

  return {
    date,
    revenue,
    cost: cost >= 0 ? cost : -1,
    covers: covers >= 0 ? covers : -1,
    branch: branch >= 0 ? branch : -1,
  };
}

export function remapRowsWithRoles(
  headers: string[],
  rows: Record<string, string>[],
  roles: ColumnRoles
): { headers: string[]; rows: Record<string, string>[] } {
  const outHeaders = ['date', 'revenue', 'cost', 'covers', 'branch'];
  const outRows = rows.map((row) => {
    const mapped: Record<string, string> = {
      date: parseFlexibleDate(String(row[headers[roles.date]!] ?? '')) ?? String(row[headers[roles.date]!] ?? ''),
      revenue: String(row[headers[roles.revenue]!] ?? ''),
      cost: roles.cost >= 0 ? String(row[headers[roles.cost]!] ?? '') : '',
      covers: roles.covers >= 0 ? String(row[headers[roles.covers]!] ?? '') : '',
      branch: roles.branch >= 0 ? String(row[headers[roles.branch]!] ?? '') : '',
    };
    return mapped;
  });
  return { headers: outHeaders, rows: outRows };
}

export function headersLookGeneric(headers: string[]): boolean {
  const generic = /^col\d+$|^column\d+$|^field\d+$/i;
  const unnamed = headers.filter((h) => generic.test(h.trim()) || h.trim() === '').length;
  return unnamed >= headers.length * 0.5 || headers.every((h) => /^[\d.]+$/.test(h.trim()));
}
