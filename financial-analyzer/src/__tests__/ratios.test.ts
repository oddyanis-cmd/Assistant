import { describe, it, expect } from "vitest";
import { computeTotals } from "../statements";
import { computeRatios } from "../ratios";
import type { Metric } from "../types";
import { SAMPLE } from "./fixture";

const totals = computeTotals(SAMPLE.income, SAMPLE.balance);
const groups = computeRatios(SAMPLE, totals);

function value(key: string): number | null {
  for (const list of Object.values(groups) as Metric[][]) {
    const found = list.find((m) => m.key === key);
    if (found) return found.value;
  }
  throw new Error(`metric ${key} not found`);
}

describe("profitability ratios", () => {
  it("margins", () => {
    expect(value("gross_margin")).toBe(40);
    expect(value("operating_margin")).toBe(15);
    expect(value("ebitda_margin")).toBe(20);
    expect(value("net_margin")).toBe(9.75);
  });
  it("returns", () => {
    expect(value("roa")).toBe(12.19);
    expect(value("roe")).toBe(24.38);
    expect(value("roic")).toBe(18.44);
  });
});

describe("liquidity ratios", () => {
  it("computes them", () => {
    expect(value("current_ratio")).toBe(2);
    expect(value("quick_ratio")).toBe(1.2);
    expect(value("cash_ratio")).toBe(0.67);
    expect(value("working_capital")).toBe(150_000);
  });
});

describe("solvency ratios", () => {
  it("computes them", () => {
    expect(value("debt_to_equity")).toBe(1);
    expect(value("debt_ratio")).toBe(0.5);
    expect(value("interest_coverage")).toBe(7.5);
    expect(value("net_debt")).toBe(210_000);
  });
});

describe("efficiency ratios", () => {
  it("turnover and working-capital days", () => {
    expect(value("inventory_turnover")).toBe(5);
    expect(value("receivables_turnover")).toBe(12.5);
    expect(value("asset_turnover")).toBe(1.25);
    expect(value("dio")).toBe(73);
    expect(value("dso")).toBe(29.2);
    expect(value("dpo")).toBe(54.75);
    expect(value("cash_conversion_cycle")).toBe(47.45);
  });
});

describe("null-safety", () => {
  it("returns null instead of Infinity when a denominator is zero", () => {
    const noRev = { ...SAMPLE, income: { ...SAMPLE.income, revenue: 0 } };
    const t = computeTotals(noRev.income, noRev.balance);
    const g = computeRatios(noRev, t);
    const gm = g.profitability?.find((m) => m.key === "gross_margin");
    expect(gm?.value).toBeNull();
  });
});
