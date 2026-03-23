import type { ForecastResult } from './exponentialSmoothing';

/**
 * OLS linear regression on time index X = [0,1,...,n-1], with prediction intervals.
 */
export function linearRegression(
  data: number[],
  horizon: number,
  confidenceZ: number = 1.645
): ForecastResult {
  const n = data.length;
  if (n < 2) {
    const v = data[0] ?? 0;
    return {
      smoothed: [...data, ...Array(horizon).fill(v)],
      forecast: [...Array(n).fill(NaN), ...Array(horizon).fill(v)],
      upper: [...Array(n).fill(NaN), ...Array(horizon).fill(v)],
      lower: [...Array(n).fill(NaN), ...Array(horizon).fill(v)],
      mape: null,
      rmse: 0,
      mae: 0,
    };
  }

  const x: number[] = [];
  for (let i = 0; i < n; i++) x.push(i);
  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = data.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, xi, i) => s + xi * data[i]!, 0);
  const sumX2 = x.reduce((s, v) => s + v * v, 0);
  const denom = n * sumX2 - sumX * sumX;
  const b = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const a = (sumY - b * sumX) / n;

  const fitted: number[] = x.map((t) => a + b * t);
  const residuals = data.map((y, i) => y - fitted[i]!);
  const sumE2 = residuals.reduce((s, e) => s + e * e, 0);
  const se = n > 2 ? Math.sqrt(sumE2 / (n - 2)) : 0;
  const meanX = sumX / n;
  const sumSqDevX = x.reduce((s, xi) => s + (xi - meanX) ** 2, 0);

  const forecast: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const xNew = n + h - 1;
    const f = a + b * xNew;
    forecast.push(f);
    const sePred = sumSqDevX > 0
      ? se * Math.sqrt(1 + 1 / n + (xNew - meanX) ** 2 / sumSqDevX)
      : se;
    upper.push(f + confidenceZ * sePred);
    lower.push(f - confidenceZ * sePred);
  }

  const absPctErrors: number[] = [];
  for (let t = 0; t < n; t++) {
    const act = data[t]!;
    if (Math.abs(act) >= 1e-10) {
      absPctErrors.push(Math.abs(act - fitted[t]!) / Math.abs(act));
    }
  }
  const mape: number | null =
    absPctErrors.length > 0
      ? (absPctErrors.reduce((s, e) => s + e, 0) / absPctErrors.length) * 100
      : null;
  const rmse = Math.sqrt(sumE2 / n);
  const mae = residuals.reduce((s, e) => s + Math.abs(e), 0) / n;

  for (let i = 0; i < forecast.length; i++) {
    const f = forecast[i]!;
    lower[i] = Math.min(lower[i]!, f);
    upper[i] = Math.max(upper[i]!, f);
  }

  const smoothedExtended = [...fitted, ...forecast];
  return {
    smoothed: smoothedExtended,
    forecast: [...Array(n).fill(NaN), ...forecast],
    upper: [...Array(n).fill(NaN), ...upper],
    lower: [...Array(n).fill(NaN), ...lower],
    mape,
    rmse,
    mae,
  };
}
