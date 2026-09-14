/** Orchestrator: turns raw financials into a complete, structured analysis
 *  object. THIS is what gets handed to the AI layer to narrate — the AI reads
 *  these already-computed numbers and writes the report; it does no math. */
import type { AnalysisInput, BusinessType, Metric, StatementTotals } from "./types";
import { computeTotals } from "./statements";
import { computeRatios } from "./ratios";

export interface AnalysisResult {
  businessType: BusinessType;
  currency: string;
  totals: StatementTotals;
  ratios: Record<string, Metric[]>;
  /** Metric keys this business type should foreground. */
  focusMetrics: string[];
  /** Data-quality warnings for the AI to flag honestly. */
  warnings: string[];
}

/** Which metrics matter most, per business model. */
const FOCUS: Record<BusinessType, string[]> = {
  generic: ["gross_margin", "net_margin", "current_ratio", "debt_to_equity", "roe"],
  retail: ["gross_margin", "inventory_turnover", "dio", "asset_turnover", "current_ratio"],
  restaurant: ["gross_margin", "operating_margin", "inventory_turnover", "net_margin"],
  saas: ["gross_margin", "ebitda_margin", "net_margin", "roe", "cash_ratio"],
  manufacturing: ["gross_margin", "asset_turnover", "inventory_turnover", "interest_coverage", "debt_to_equity"],
  services: ["operating_margin", "net_margin", "receivables_turnover", "dso", "roe"],
  ecommerce: ["gross_margin", "inventory_turnover", "dio", "receivables_turnover", "net_margin"],
};

export function analyze(input: AnalysisInput): AnalysisResult {
  const businessType = input.businessType ?? "generic";
  const currency = input.currency ?? "QAR";

  const totals = computeTotals(input.income, input.balance);
  const ratios = computeRatios(input, totals);

  const warnings: string[] = [];
  if (!totals.balanceCheckPasses) {
    warnings.push(
      `Balance sheet does not balance: Assets − (Liabilities + Equity) = ${totals.balanceCheckDifference}. Figures may be incomplete or mis-entered.`
    );
  }
  if (input.income.revenue <= 0) {
    warnings.push("Revenue is zero or negative — margin ratios are not meaningful.");
  }
  if (!input.prior) {
    warnings.push(
      "No prior-period balances supplied — turnover ratios use period-end balances instead of averages."
    );
  }

  return {
    businessType,
    currency,
    totals,
    ratios,
    focusMetrics: FOCUS[businessType],
    warnings,
  };
}
