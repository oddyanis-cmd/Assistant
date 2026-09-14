/** Investment / valuation math: NPV, IRR, payback, CAGR.
 *  Convention: `cashflows[0]` is the value at t=0 (usually the initial outlay,
 *  negative). Later entries are end-of-period flows. */

/** Net present value at a given periodic discount rate. */
export function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((acc, cf, t) => acc + cf / (1 + rate) ** t, 0);
}

/**
 * Internal rate of return — the rate where NPV = 0.
 * Bisection over a wide bracket; robust for conventional cashflows (one sign
 * change). Returns null when no rate in range makes NPV cross zero.
 */
export function irr(cashflows: number[], lower = -0.9999, upper = 10): number | null {
  if (cashflows.length < 2) return null;
  let lo = lower;
  let hi = upper;
  let fLo = npv(lo, cashflows);
  let fHi = npv(hi, cashflows);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return null;
  if (fLo === 0) return lo;
  if (fHi === 0) return hi;
  if (fLo * fHi > 0) return null; // no sign change → no bracketed root

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashflows);
    if (Math.abs(fMid) < 1e-9 || (hi - lo) / 2 < 1e-9) {
      return mid;
    }
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Payback period (in periods) with linear interpolation within the recovery
 * period. `cashflows[0]` is the initial outlay (negative). Returns null if the
 * investment is never recovered.
 */
export function paybackPeriod(cashflows: number[]): number | null {
  if (cashflows.length === 0) return null;
  let cumulative = cashflows[0]!;
  if (cumulative >= 0) return 0;
  for (let t = 1; t < cashflows.length; t++) {
    const flow = cashflows[t]!;
    if (cumulative + flow >= 0) {
      const fraction = -cumulative / flow; // portion of this period needed
      return t - 1 + fraction;
    }
    cumulative += flow;
  }
  return null;
}

/** Compound annual growth rate from begin→end over `periods`. */
export function cagr(begin: number, end: number, periods: number): number | null {
  if (begin <= 0 || periods <= 0) return null;
  if (end < 0) return null;
  return (end / begin) ** (1 / periods) - 1;
}
