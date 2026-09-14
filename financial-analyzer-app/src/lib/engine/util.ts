/** Small numeric helpers. Division is null-safe so a zero denominator never
 *  silently produces Infinity/NaN in a report. */

/** Divide, returning null when the denominator is 0 (or inputs are non-finite). */
export function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

/** Round to `dp` decimal places (default 2), preserving null. */
export function round(value: number | null, dp = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const f = 10 ** dp;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Convert a ratio (0.25) to a rounded percentage (25). */
export function toPercent(ratio: number | null, dp = 2): number | null {
  if (ratio === null) return null;
  return round(ratio * 100, dp);
}

/** Average of two numbers when both are present, else the one that is. */
export function avg(a: number, b: number | undefined): number {
  return b === undefined ? a : (a + b) / 2;
}
