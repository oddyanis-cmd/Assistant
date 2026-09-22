import type { AnalysisInput } from "../types";

/** A balanced sample company used across tests. Totals worked out by hand:
 *  grossProfit 400k, EBITDA 200k, EBIT 150k, pretax 130k, netIncome 97.5k;
 *  totalAssets 800k, totalLiabilities 400k, equity 400k (balances). */
export const SAMPLE: AnalysisInput = {
  businessType: "retail",
  currency: "QAR",
  income: {
    revenue: 1_000_000,
    cogs: 600_000,
    operatingExpenses: 200_000,
    depreciation: 50_000,
    interestExpense: 20_000,
    taxExpense: 32_500,
  },
  balance: {
    cash: 100_000,
    accountsReceivable: 80_000,
    inventory: 120_000,
    ppe: 500_000,
    accountsPayable: 90_000,
    shortTermDebt: 60_000,
    longTermDebt: 250_000,
    equity: 400_000,
  },
};
