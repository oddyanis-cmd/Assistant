/** Derives statement subtotals from raw inputs, and checks that the balance
 *  sheet actually balances (Assets = Liabilities + Equity). */
import type {
  BalanceSheetInput,
  IncomeStatementInput,
  StatementTotals,
} from "./types";

const TOLERANCE = 0.01; // currency units; balance-sheet rounding slack

export function computeTotals(
  income: IncomeStatementInput,
  balance: BalanceSheetInput
): StatementTotals {
  const da = (income.depreciation ?? 0) + (income.amortization ?? 0);

  const grossProfit = income.revenue - income.cogs;
  const ebitda = grossProfit - income.operatingExpenses;
  const ebit = ebitda - da;
  const pretaxIncome = ebit - (income.interestExpense ?? 0) + (income.otherIncome ?? 0);
  const netIncome = pretaxIncome - (income.taxExpense ?? 0);

  const currentAssets =
    balance.cash +
    balance.accountsReceivable +
    balance.inventory +
    (balance.otherCurrentAssets ?? 0);
  const nonCurrentAssets = balance.ppe + (balance.otherNonCurrentAssets ?? 0);
  const totalAssets = currentAssets + nonCurrentAssets;

  const currentLiabilities =
    balance.accountsPayable +
    (balance.shortTermDebt ?? 0) +
    (balance.otherCurrentLiabilities ?? 0);
  const nonCurrentLiabilities =
    (balance.longTermDebt ?? 0) + (balance.otherNonCurrentLiabilities ?? 0);
  const totalLiabilities = currentLiabilities + nonCurrentLiabilities;
  const totalDebt = (balance.shortTermDebt ?? 0) + (balance.longTermDebt ?? 0);

  const workingCapital = currentAssets - currentLiabilities;

  const balanceCheckDifference = totalAssets - (totalLiabilities + balance.equity);
  const balanceCheckPasses = Math.abs(balanceCheckDifference) <= TOLERANCE;

  return {
    grossProfit,
    ebitda,
    ebit,
    pretaxIncome,
    netIncome,
    currentAssets,
    nonCurrentAssets,
    totalAssets,
    currentLiabilities,
    nonCurrentLiabilities,
    totalLiabilities,
    totalDebt,
    workingCapital,
    balanceCheckPasses,
    balanceCheckDifference: Math.round(balanceCheckDifference * 100) / 100,
  };
}
