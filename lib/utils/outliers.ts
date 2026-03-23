/**
 * Outlier detection for chart scaling. IQR and Z-score methods.
 */

export function detectOutliers(
  data: number[],
  method: 'iqr' | 'zscore' = 'iqr'
): { clean: number[]; outliers: number[]; indices: number[] } {
  const indices: number[] = [];
  const outliers: number[] = [];
  const clean: number[] = [];

  const finite = data
    .map((v, i) => ({ v: Number(v), i }))
    .filter(({ v }) => Number.isFinite(v));

  if (finite.length === 0) {
    return { clean: [], outliers: [], indices: [] };
  }

  let isOutlier: (val: number, idx: number) => boolean;

  if (method === 'iqr') {
    const sorted = [...finite].sort((a, b) => a.v - b.v);
    const n = sorted.length;
    const q1Idx = Math.floor(n * 0.25);
    const q3Idx = Math.floor(n * 0.75);
    const q1 = sorted[q1Idx]?.v ?? sorted[0]!.v;
    const q3 = sorted[q3Idx]?.v ?? sorted[n - 1]!.v;
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    isOutlier = (val) => val < lower || val > upper;
  } else {
    const mean = finite.reduce((s, { v }) => s + v, 0) / finite.length;
    const variance =
      finite.reduce((s, { v }) => s + (v - mean) ** 2, 0) / finite.length;
    const sd = Math.sqrt(variance) || 1e-10;
    isOutlier = (val) => Math.abs((val - mean) / sd) > 3;
  }

  finite.forEach(({ v, i }) => {
    if (isOutlier(v, i)) {
      indices.push(i);
      outliers.push(v);
    } else {
      clean.push(v);
    }
  });

  return { clean, outliers, indices };
}
