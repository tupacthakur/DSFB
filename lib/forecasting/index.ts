import { exponentialSmoothing } from './exponentialSmoothing';
import { linearRegression } from './linearRegression';
import type { ForecastResult } from './exponentialSmoothing';

export type { ForecastResult } from './exponentialSmoothing';
export { exponentialSmoothing } from './exponentialSmoothing';
export { linearRegression } from './linearRegression';

export interface RunForecastOptions {
  /** When true, clamp forecast and bands to >= 0 (e.g. for revenue). */
  floorAtZero?: boolean;
}

export function runForecast(
  data: number[],
  model: 'ets' | 'linear' | 'ensemble',
  alpha: number,
  horizon: number,
  confidenceZ: number = 1.645,
  options: RunForecastOptions = {}
): ForecastResult {
  const { floorAtZero = false } = options;
  const ets = exponentialSmoothing(data, alpha, horizon, confidenceZ);
  const linear = linearRegression(data, horizon, confidenceZ);
  if (model === 'ets') return applyFloor(ets, floorAtZero);
  if (model === 'linear') return applyFloor(linear, floorAtZero);
  const n = data.length;
  const len = n + horizon;
  const smoothed: number[] = [];
  const forecast: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < len; i++) {
    const e = ets.smoothed[i]!;
    const l = linear.smoothed[i]!;
    smoothed.push(Number.isNaN(l) ? e : (e + l) / 2);
    forecast.push(Number.isNaN(ets.forecast[i]!) ? linear.forecast[i]! : (ets.forecast[i]! + linear.forecast[i]!) / 2);
    upper.push(Number.isNaN(ets.upper[i]!) ? linear.upper[i]! : (ets.upper[i]! + linear.upper[i]!) / 2);
    lower.push(Number.isNaN(ets.lower[i]!) ? linear.lower[i]! : (ets.lower[i]! + linear.lower[i]!) / 2);
  }
  const mapeE = ets.mape ?? 0;
  const mapeL = linear.mape ?? 0;
  const mape = ets.mape !== null || linear.mape !== null ? (mapeE + mapeL) / 2 : null;
  const result: ForecastResult = {
    smoothed,
    forecast,
    upper,
    lower,
    mape,
    rmse: (ets.rmse + linear.rmse) / 2,
    mae: (ets.mae + linear.mae) / 2,
  };
  return applyFloor(result, floorAtZero);
}

function applyFloor(r: ForecastResult, floor: boolean): ForecastResult {
  if (!floor) return r;
  return {
    ...r,
    forecast: r.forecast.map((v) => Math.max(0, v)),
    upper: r.upper.map((v) => Math.max(0, v)),
    lower: r.lower.map((v) => Math.max(0, v)),
  };
}
