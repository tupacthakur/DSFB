import type { QuadrantKey } from '@/lib/store/metricsStore';

export type QuadrantType = QuadrantKey;

export interface MenuItem {
  id: string;
  name: string;
  covers: number;
  marginPct: number;
  revenue: number;
  quadrant?: QuadrantKey;
}

/**
 * Classify item into quadrant using median volume and median margin of the entire menu set.
 * Recalculates thresholds on every call (call with current filtered set).
 */
export function classifyItem(item: MenuItem, allItems: MenuItem[]): QuadrantKey {
  if (!allItems.length) return 'dogs';
  const volumes = allItems.map((i) => i.covers).filter((v) => Number.isFinite(v));
  const margins = allItems.map((i) => i.marginPct).filter((v) => Number.isFinite(v));
  const medianVolume = median(volumes);
  const medianMargin = median(margins);
  const aboveVolume = item.covers >= medianVolume;
  const aboveMargin = item.marginPct >= medianMargin;
  if (aboveVolume && aboveMargin) return 'stars';
  if (!aboveVolume && aboveMargin) return 'puzzles';
  if (aboveVolume && !aboveMargin) return 'plowhorses';
  return 'dogs';
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export const QUADRANT_STRATEGY: Record<QuadrantKey, string> = {
  stars: 'Protect & promote',
  plowhorses: 'Reduce portion cost',
  puzzles: 'Reposition or reprice',
  dogs: 'Review or remove',
};

export const QUAD_COLOR: Record<QuadrantKey, string> = {
  stars: 'var(--green)',
  puzzles: 'var(--blue)',
  plowhorses: 'var(--amber)',
  dogs: 'var(--red)',
};
