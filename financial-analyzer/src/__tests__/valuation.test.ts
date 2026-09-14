import { describe, it, expect } from "vitest";
import { npv, irr, paybackPeriod, cagr } from "../valuation";

describe("npv", () => {
  it("discounts a conventional project correctly", () => {
    // -1000 + 500/1.1 + 500/1.21 + 500/1.331 = 243.4259954
    expect(npv(0.1, [-1000, 500, 500, 500])).toBeCloseTo(243.426, 3);
  });
  it("equals the plain sum at a 0% rate", () => {
    expect(npv(0, [-1000, 500, 500, 500])).toBe(500);
  });
});

describe("irr", () => {
  it("finds the rate that zeroes NPV", () => {
    const cf = [-1000, 500, 500, 500];
    const r = irr(cf);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(0.2337, 3);
    expect(Math.abs(npv(r!, cf))).toBeLessThan(1e-6);
  });
  it("returns null when there is no sign change", () => {
    expect(irr([100, 200, 300])).toBeNull();
  });
});

describe("paybackPeriod", () => {
  it("interpolates within the recovery period", () => {
    expect(paybackPeriod([-1000, 400, 400, 400, 400])).toBe(2.5);
  });
  it("returns null when never recovered", () => {
    expect(paybackPeriod([-1000, 100, 100])).toBeNull();
  });
});

describe("cagr", () => {
  it("computes compound annual growth", () => {
    expect(cagr(100, 200, 3)).toBeCloseTo(0.259921, 5);
  });
  it("guards invalid inputs", () => {
    expect(cagr(0, 200, 3)).toBeNull();
    expect(cagr(100, 200, 0)).toBeNull();
  });
});
