import { describe, it, expect } from "vitest";
import { computeTotals } from "../statements";
import { SAMPLE } from "./fixture";

describe("computeTotals", () => {
  const t = computeTotals(SAMPLE.income, SAMPLE.balance);

  it("derives the income-statement subtotals", () => {
    expect(t.grossProfit).toBe(400_000);
    expect(t.ebitda).toBe(200_000);
    expect(t.ebit).toBe(150_000);
    expect(t.pretaxIncome).toBe(130_000);
    expect(t.netIncome).toBe(97_500);
  });

  it("derives the balance-sheet subtotals", () => {
    expect(t.currentAssets).toBe(300_000);
    expect(t.totalAssets).toBe(800_000);
    expect(t.currentLiabilities).toBe(150_000);
    expect(t.totalLiabilities).toBe(400_000);
    expect(t.totalDebt).toBe(310_000);
    expect(t.workingCapital).toBe(150_000);
  });

  it("confirms the balance sheet balances", () => {
    expect(t.balanceCheckPasses).toBe(true);
    expect(t.balanceCheckDifference).toBe(0);
  });

  it("flags a balance sheet that does not balance", () => {
    const broken = computeTotals(SAMPLE.income, { ...SAMPLE.balance, equity: 350_000 });
    expect(broken.balanceCheckPasses).toBe(false);
    expect(broken.balanceCheckDifference).toBe(50_000);
  });
});
