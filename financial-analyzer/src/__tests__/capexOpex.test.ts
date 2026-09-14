import { describe, it, expect } from "vitest";
import {
  classifyExpenditure,
  summarizeExpenditures,
  straightLineDepreciation,
  decliningBalanceDepreciation,
} from "../capexOpex";

describe("classifyExpenditure", () => {
  it("capitalizes a long-lived, material asset", () => {
    const c = classifyExpenditure({ label: "Oven", amount: 10000, usefulLifeYears: 5 });
    expect(c.classification).toBe("capex");
  });
  it("expenses a cheap item below the threshold", () => {
    const c = classifyExpenditure({ label: "Chairs", amount: 500, usefulLifeYears: 5 });
    expect(c.classification).toBe("opex");
  });
  it("expenses a short-lived item regardless of cost", () => {
    const c = classifyExpenditure({ label: "Supplies", amount: 10000, usefulLifeYears: 0.5 });
    expect(c.classification).toBe("opex");
  });
});

describe("summarizeExpenditures", () => {
  it("splits totals into CapEx and OpEx", () => {
    const s = summarizeExpenditures([
      { label: "Oven", amount: 10000, usefulLifeYears: 5 },
      { label: "Chairs", amount: 500, usefulLifeYears: 5 },
      { label: "Fit-out", amount: 3000, usefulLifeYears: 2 },
    ]);
    expect(s.totalCapex).toBe(13000);
    expect(s.totalOpex).toBe(500);
  });
});

describe("depreciation", () => {
  it("straight-line spreads (cost − salvage) evenly", () => {
    expect(straightLineDepreciation(10000, 5, 2000)).toEqual([1600, 1600, 1600, 1600, 1600]);
  });
  it("double-declining balance never dips below salvage", () => {
    expect(decliningBalanceDepreciation(10000, 5, 0)).toEqual([4000, 2400, 1440, 864, 518.4]);
  });
});
