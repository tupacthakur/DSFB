/**
 * Currency (INR ₹), percent, and date formatters for F&B metrics.
 * Compact form: ₹1.2k, ₹1.2L (lakh), ₹1.2Cr (crore).
 */
const LAKH = 1_00_000;
const CRORE = 1_00_00_000;

export function formatCurrency(value: number, compact = false): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (compact || abs >= 1000) {
    if (abs < 1000) return `${sign}₹${Math.round(value)}`;
    if (abs >= CRORE) return `${sign}₹${(value / CRORE).toFixed(1)}Cr`;
    if (abs >= LAKH) return `${sign}₹${(value / LAKH).toFixed(1)}L`;
    return `${sign}₹${(value / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—%';
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
