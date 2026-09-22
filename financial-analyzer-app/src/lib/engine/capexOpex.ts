/** CapEx vs OpEx classification and depreciation schedules.
 *
 * Rule of thumb encoded here: an outlay is CAPITALIZED (CapEx) when it buys a
 * long-lived asset — useful life > 1 year AND cost >= the capitalization
 * threshold. Otherwise it is expensed now (OpEx). CapEx hits the balance sheet
 * and is depreciated over time; OpEx hits the P&L immediately. */

export interface Expenditure {
  label: string;
  amount: number;
  usefulLifeYears: number; // 0 or <1 => consumed within the year
  salvageValue?: number;
}

export type Classification = "capex" | "opex";

export interface ClassifiedExpenditure extends Expenditure {
  classification: Classification;
  reason: string;
}

export function classifyExpenditure(
  e: Expenditure,
  capitalizationThreshold = 2500
): ClassifiedExpenditure {
  const longLived = e.usefulLifeYears >= 1;
  const material = e.amount >= capitalizationThreshold;
  const isCapex = longLived && material;
  return {
    ...e,
    classification: isCapex ? "capex" : "opex",
    reason: isCapex
      ? `Capitalized: useful life ${e.usefulLifeYears}y ≥ 1y and cost ${e.amount} ≥ threshold ${capitalizationThreshold}.`
      : !longLived
        ? `Expensed: useful life ${e.usefulLifeYears}y < 1y (consumed in period).`
        : `Expensed: cost ${e.amount} < capitalization threshold ${capitalizationThreshold}.`,
  };
}

export interface CapexOpexSummary {
  totalCapex: number;
  totalOpex: number;
  items: ClassifiedExpenditure[];
}

export function summarizeExpenditures(
  items: Expenditure[],
  capitalizationThreshold = 2500
): CapexOpexSummary {
  const classified = items.map((e) => classifyExpenditure(e, capitalizationThreshold));
  const totalCapex = classified
    .filter((c) => c.classification === "capex")
    .reduce((s, c) => s + c.amount, 0);
  const totalOpex = classified
    .filter((c) => c.classification === "opex")
    .reduce((s, c) => s + c.amount, 0);
  return { totalCapex, totalOpex, items: classified };
}

/** Straight-line: equal expense each year = (cost − salvage) / life. */
export function straightLineDepreciation(
  cost: number,
  usefulLifeYears: number,
  salvageValue = 0
): number[] {
  if (usefulLifeYears < 1) return [];
  const annual = (cost - salvageValue) / usefulLifeYears;
  return Array.from({ length: Math.floor(usefulLifeYears) }, () => round2(annual));
}

/** Double-declining balance, never depreciating below salvage value. */
export function decliningBalanceDepreciation(
  cost: number,
  usefulLifeYears: number,
  salvageValue = 0
): number[] {
  if (usefulLifeYears < 1) return [];
  const rate = 2 / usefulLifeYears;
  const schedule: number[] = [];
  let book = cost;
  for (let y = 0; y < Math.floor(usefulLifeYears); y++) {
    let expense = book * rate;
    if (book - expense < salvageValue) expense = book - salvageValue;
    if (expense < 0) expense = 0;
    schedule.push(round2(expense));
    book -= expense;
  }
  return schedule;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
