/**
 * Safe division to avoid division by zero in user data and ratios.
 */
export const safeDivide = (
  numerator: number,
  denominator: number,
  fallback: number = 0
): number => (denominator === 0 ? fallback : numerator / denominator);

/** When min === max, return [value*0.9, value*1.1] so YAxis does not collapse. */
export function domainWithBreathingRoom(min: number, max: number): [number, number] {
  if (min === max || !Number.isFinite(min) || !Number.isFinite(max)) {
    const v = Number.isFinite(min) ? min : Number.isFinite(max) ? max : 0;
    return [v * 0.9, v * 1.1];
  }
  return [min, max];
}
