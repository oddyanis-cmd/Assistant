import { describe, it, expect } from "vitest";
import { analyze } from "../analyze";
import { SAMPLE } from "./fixture";

describe("analyze", () => {
  it("returns totals, grouped ratios, and business focus metrics", () => {
    const r = analyze(SAMPLE);
    expect(r.businessType).toBe("retail");
    expect(r.totals.netIncome).toBe(97_500);
    expect(Object.keys(r.ratios)).toEqual([
      "profitability",
      "liquidity",
      "solvency",
      "efficiency",
    ]);
    // retail should foreground inventory turnover
    expect(r.focusMetrics).toContain("inventory_turnover");
  });

  it("warns when the balance sheet does not balance", () => {
    const r = analyze({ ...SAMPLE, balance: { ...SAMPLE.balance, equity: 350_000 } });
    expect(r.warnings.some((w) => w.includes("does not balance"))).toBe(true);
  });

  it("warns when no prior balances are supplied (turnover uses period-end)", () => {
    const r = analyze(SAMPLE);
    expect(r.warnings.some((w) => w.includes("prior-period"))).toBe(true);
  });
});
