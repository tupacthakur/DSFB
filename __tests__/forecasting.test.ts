import { exponentialSmoothing } from '@/lib/forecasting/exponentialSmoothing';
import { linearRegression } from '@/lib/forecasting/linearRegression';
import { runForecast } from '@/lib/forecasting';

describe('exponentialSmoothing', () => {
  it('throws when alpha out of range', () => {
    expect(() => exponentialSmoothing([1, 2, 3], 0.01, 2)).toThrow('alpha must be between 0.05 and 0.95');
    expect(() => exponentialSmoothing([1, 2, 3], 0.99, 2)).toThrow('alpha must be between 0.05 and 0.95');
  });

  it('returns empty result for empty data', () => {
    const r = exponentialSmoothing([], 0.3, 5);
    expect(r.smoothed).toEqual([]);
    expect(r.forecast).toEqual([]);
    expect(r.mape).toBeNull();
    expect(r.rmse).toBe(0);
    expect(r.mae).toBe(0);
  });

  it('initializes S[0] = data[0] and smooths correctly', () => {
    const data = [10, 12, 11, 13];
    const r = exponentialSmoothing(data, 0.5, 2);
    expect(r.smoothed[0]).toBe(10);
    expect(r.smoothed[1]).toBe(0.5 * 12 + 0.5 * 10); // 11
    expect(r.smoothed[2]).toBe(0.5 * 11 + 0.5 * 11); // 11
    expect(r.smoothed[3]).toBe(0.5 * 13 + 0.5 * 11); // 12
    expect(r.smoothed.length).toBe(6); // 4 + 2 horizon
    expect(r.forecast.length).toBe(6);
    expect(r.forecast[4]).toBe(12); // last smoothed
    expect(r.forecast[5]).toBe(12);
  });

  it('confidence bands widen with horizon', () => {
    const data = [1, 2, 3, 4, 5];
    const r = exponentialSmoothing(data, 0.3, 3, 1.645);
    const n = 5;
    expect(r.upper[n]!).toBeLessThanOrEqual(r.upper[n + 1]!);
    expect(r.upper[n + 1]!).toBeLessThanOrEqual(r.upper[n + 2]!);
    expect(r.lower[n]!).toBeGreaterThanOrEqual(r.lower[n + 1]!);
    expect(r.lower[n + 1]!).toBeGreaterThanOrEqual(r.lower[n + 2]!);
  });

  it('computes MAPE RMSE MAE', () => {
    const data = [100, 100, 100];
    const r = exponentialSmoothing(data, 0.5, 1);
    expect(r.smoothed[0]).toBe(100);
    expect(r.smoothed[1]).toBe(100);
    expect(r.smoothed[2]).toBe(100);
    expect(r.mape).toBe(0);
    expect(r.rmse).toBe(0);
    expect(r.mae).toBe(0);
  });
});

describe('linearRegression', () => {
  it('fits perfect line y = x', () => {
    const data = [0, 1, 2, 3, 4];
    const r = linearRegression(data, 2);
    expect(r.smoothed[0]).toBe(0);
    expect(r.smoothed[1]).toBe(1);
    expect(r.smoothed[2]).toBe(2);
    expect(r.smoothed[3]).toBe(3);
    expect(r.smoothed[4]).toBe(4);
    expect(r.forecast[5]).toBe(5);
    expect(r.forecast[6]).toBe(6);
    expect(r.mape).toBe(0);
    expect(r.rmse).toBe(0);
    expect(r.mae).toBe(0);
  });

  it('returns same ForecastResult shape', () => {
    const data = [10, 12, 14, 16];
    const r = linearRegression(data, 2);
    expect(r).toHaveProperty('smoothed');
    expect(r).toHaveProperty('forecast');
    expect(r).toHaveProperty('upper');
    expect(r).toHaveProperty('lower');
    expect(r).toHaveProperty('mape');
    expect(r).toHaveProperty('rmse');
    expect(r).toHaveProperty('mae');
    expect(r.smoothed.length).toBe(6);
    expect(r.forecast.length).toBe(6);
  });

  it('handles single point', () => {
    const r = linearRegression([42], 3);
    expect(r.forecast[1]).toBe(42);
    expect(r.upper[1]).toBe(42);
    expect(r.lower[1]).toBe(42);
  });
});

describe('runForecast', () => {
  it('returns ETS for model ets', () => {
    const data = [1, 2, 3, 4, 5];
    const r = runForecast(data, 'ets', 0.3, 2);
    expect(r.smoothed.length).toBe(7);
    expect(r.forecast[5]).toBe(r.smoothed[4]);
  });

  it('returns linear for model linear', () => {
    const data = [0, 1, 2, 3, 4];
    const r = runForecast(data, 'linear', 0.3, 2);
    expect(r.forecast[5]).toBe(5);
    expect(r.forecast[6]).toBe(6);
  });

  it('returns ensemble average for model ensemble', () => {
    const data = [10, 11, 12, 13, 14];
    const r = runForecast(data, 'ensemble', 0.5, 2);
    const ets = runForecast(data, 'ets', 0.5, 2);
    const lin = runForecast(data, 'linear', 0.5, 2);
    expect(r.forecast[5]).toBeCloseTo((ets.forecast[5]! + lin.forecast[5]!) / 2);
    expect(r.mape).toBeCloseTo(((ets.mape ?? 0) + (lin.mape ?? 0)) / 2);
  });
});
