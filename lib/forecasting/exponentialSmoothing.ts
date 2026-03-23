export interface ForecastResult {
  smoothed: number[];
  forecast: number[];
  upper: number[];
  lower: number[];
  /** null when all actuals are 0 (MAPE undefined). */
  mape: number | null;
  rmse: number;
  mae: number;
}

/**
 * Single exponential smoothing with flat forecast and widening confidence bands.
 * alpha in [0.05, 0.95]. Bands widen with horizon: ±z*σ*sqrt(h).
 */
export function exponentialSmoothing(
  data: number[],
  alpha: number,
  horizon: number,
  confidenceZ: number = 1.645
): ForecastResult {
  if (alpha < 0.05 || alpha > 0.95) {
    throw new Error('alpha must be between 0.05 and 0.95');
  }
  const n = data.length;
  if (n === 0) {
    return {
      smoothed: [],
      forecast: [],
      upper: [],
      lower: [],
      mape: null,
      rmse: 0,
      mae: 0,
    };
  }

  const smoothed: number[] = [data[0]!];
  for (let t = 1; t < n; t++) {
    smoothed.push(alpha * data[t]! + (1 - alpha) * smoothed[t - 1]!);
  }
  const lastSmoothed = smoothed[n - 1]!;

  const residuals: number[] = [];
  for (let t = 1; t < n; t++) {
    residuals.push(data[t]! - smoothed[t - 1]!);
  }
  const meanSqResidual = residuals.length
    ? residuals.reduce((s, e) => s + e * e, 0) / residuals.length
    : 0;
  const sigma = Math.sqrt(meanSqResidual);

  const forecast: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    forecast.push(lastSmoothed);
    const halfWidth = confidenceZ * sigma * Math.sqrt(h);
    upper.push(lastSmoothed + halfWidth);
    lower.push(lastSmoothed - halfWidth);
  }

  const absPctErrors: number[] = [];
  for (let t = 0; t < n; t++) {
    const act = data[t]!;
    if (Math.abs(act) >= 1e-10) {
      absPctErrors.push(Math.abs(act - smoothed[t]!) / Math.abs(act));
    }
  }
  const mape: number | null =
    absPctErrors.length > 0
      ? (absPctErrors.reduce((s, e) => s + e, 0) / absPctErrors.length) * 100
      : null;

  const sqErrors = data.map((act, t) => (act - smoothed[t]!) ** 2);
  const rmse = Math.sqrt(sqErrors.reduce((s, e) => s + e, 0) / n);
  const mae = data.reduce((s, act, t) => s + Math.abs(act - smoothed[t]!), 0) / n;

  // Clamp bands so lower <= forecast <= upper (floating point safety)
  for (let i = 0; i < forecast.length; i++) {
    const f = forecast[i]!;
    lower[i] = Math.min(lower[i]!, f);
    upper[i] = Math.max(upper[i]!, f);
  }

  return {
    smoothed: [...smoothed, ...Array(horizon).fill(lastSmoothed)],
    forecast: [...Array(n).fill(NaN), ...forecast],
    upper: [...Array(n).fill(NaN), ...upper],
    lower: [...Array(n).fill(NaN), ...lower],
    mape,
    rmse,
    mae,
  };
}
