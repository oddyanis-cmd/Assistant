/**
 * Financial input & output types for the analysis engine.
 *
 * DESIGN RULE: every number a user ever sees is computed here in tested code.
 * The AI layer only *interprets* these outputs — it never does arithmetic.
 */

/** Raw income-statement inputs. `operatingExpenses` EXCLUDES depreciation &
 *  amortization (they are provided separately) so EBIT/EBITDA are unambiguous. */
export interface IncomeStatementInput {
  revenue: number;
  cogs: number; // cost of goods sold
  operatingExpenses: number; // SG&A etc., excluding D&A
  depreciation?: number;
  amortization?: number;
  interestExpense?: number;
  otherIncome?: number; // non-operating income (+) / expense (−)
  taxExpense?: number;
}

export interface BalanceSheetInput {
  cash: number;
  accountsReceivable: number;
  inventory: number;
  otherCurrentAssets?: number;
  ppe: number; // property, plant & equipment (net)
  otherNonCurrentAssets?: number;
  accountsPayable: number;
  shortTermDebt?: number;
  otherCurrentLiabilities?: number;
  longTermDebt?: number;
  otherNonCurrentLiabilities?: number;
  equity: number;
}

/** Optional prior-period balances so turnover ratios can use averages. */
export interface PriorBalances {
  inventory?: number;
  accountsReceivable?: number;
  accountsPayable?: number;
  totalAssets?: number;
  equity?: number;
}

export type BusinessType =
  | "generic"
  | "retail"
  | "restaurant"
  | "saas"
  | "manufacturing"
  | "services"
  | "ecommerce";

export interface AnalysisInput {
  businessType?: BusinessType;
  currency?: string;
  taxRate?: number; // 0..1, used for NOPAT/ROIC when taxExpense not given
  income: IncomeStatementInput;
  balance: BalanceSheetInput;
  prior?: PriorBalances;
}

/** A single computed metric with enough context for the AI to narrate it. */
export interface Metric {
  key: string;
  label: string;
  value: number | null; // null = not computable (e.g. divide by zero)
  unit: "currency" | "ratio" | "percent" | "days" | "times";
  /** Optional formula note for transparency/auditing. */
  formula?: string;
}

export interface StatementTotals {
  grossProfit: number;
  ebitda: number;
  ebit: number;
  pretaxIncome: number;
  netIncome: number;
  currentAssets: number;
  nonCurrentAssets: number;
  totalAssets: number;
  currentLiabilities: number;
  nonCurrentLiabilities: number;
  totalLiabilities: number;
  totalDebt: number;
  workingCapital: number;
  /** true when Assets ≈ Liabilities + Equity (within tolerance). */
  balanceCheckPasses: boolean;
  balanceCheckDifference: number;
}
