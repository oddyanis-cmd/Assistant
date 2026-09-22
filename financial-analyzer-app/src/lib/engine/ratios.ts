/** All financial ratios. Grouped: profitability, liquidity, solvency,
 *  efficiency. Every value goes through safeDiv so a zero denominator yields
 *  null (shown as "n/a") rather than Infinity. */
import type {
  AnalysisInput,
  Metric,
  StatementTotals,
} from "./types";
import { avg, safeDiv, toPercent, round } from "./util";

const DAYS = 365;

export function computeRatios(
  input: AnalysisInput,
  t: StatementTotals
): Record<string, Metric[]> {
  const { income, balance, prior } = input;

  // ---- Profitability (margins as %) ----
  const profitability: Metric[] = [
    m("gross_margin", "Gross margin", toPercent(safeDiv(t.grossProfit, income.revenue)), "percent", "grossProfit / revenue"),
    m("operating_margin", "Operating margin (EBIT)", toPercent(safeDiv(t.ebit, income.revenue)), "percent", "EBIT / revenue"),
    m("ebitda_margin", "EBITDA margin", toPercent(safeDiv(t.ebitda, income.revenue)), "percent", "EBITDA / revenue"),
    m("net_margin", "Net profit margin", toPercent(safeDiv(t.netIncome, income.revenue)), "percent", "netIncome / revenue"),
    m("roa", "Return on assets (ROA)", toPercent(safeDiv(t.netIncome, avg(t.totalAssets, prior?.totalAssets))), "percent", "netIncome / avg totalAssets"),
    m("roe", "Return on equity (ROE)", toPercent(safeDiv(t.netIncome, avg(balance.equity, prior?.equity))), "percent", "netIncome / avg equity"),
    m("roic", "Return on invested capital (ROIC)", toPercent(computeRoic(input, t)), "percent", "NOPAT / (debt + equity − cash)"),
  ];

  // ---- Liquidity ----
  const liquidity: Metric[] = [
    m("current_ratio", "Current ratio", round(safeDiv(t.currentAssets, t.currentLiabilities)), "times", "currentAssets / currentLiabilities"),
    m("quick_ratio", "Quick ratio (acid test)", round(safeDiv(t.currentAssets - balance.inventory, t.currentLiabilities)), "times", "(currentAssets − inventory) / currentLiabilities"),
    m("cash_ratio", "Cash ratio", round(safeDiv(balance.cash, t.currentLiabilities)), "times", "cash / currentLiabilities"),
    m("working_capital", "Working capital", round(t.workingCapital), "currency", "currentAssets − currentLiabilities"),
  ];

  // ---- Solvency / leverage ----
  const solvency: Metric[] = [
    m("debt_to_equity", "Debt-to-equity", round(safeDiv(t.totalLiabilities, balance.equity)), "times", "totalLiabilities / equity"),
    m("debt_ratio", "Debt ratio", round(safeDiv(t.totalLiabilities, t.totalAssets)), "ratio", "totalLiabilities / totalAssets"),
    m("equity_ratio", "Equity ratio", round(safeDiv(balance.equity, t.totalAssets)), "ratio", "equity / totalAssets"),
    m("interest_coverage", "Interest coverage", round(safeDiv(t.ebit, income.interestExpense ?? 0)), "times", "EBIT / interestExpense"),
    m("net_debt", "Net debt", round(t.totalDebt - balance.cash), "currency", "totalDebt − cash"),
  ];

  // ---- Efficiency / activity ----
  const invTurnover = safeDiv(income.cogs, avg(balance.inventory, prior?.inventory));
  const arTurnover = safeDiv(income.revenue, avg(balance.accountsReceivable, prior?.accountsReceivable));
  const apTurnover = safeDiv(income.cogs, avg(balance.accountsPayable, prior?.accountsPayable));
  const dio = invTurnover === null ? null : safeDiv(DAYS, invTurnover);
  const dso = arTurnover === null ? null : safeDiv(DAYS, arTurnover);
  const dpo = apTurnover === null ? null : safeDiv(DAYS, apTurnover);
  const ccc = dio !== null && dso !== null && dpo !== null ? dio + dso - dpo : null;

  const efficiency: Metric[] = [
    m("inventory_turnover", "Inventory turnover", round(invTurnover), "times", "COGS / avg inventory"),
    m("receivables_turnover", "Receivables turnover", round(arTurnover), "times", "revenue / avg receivables"),
    m("asset_turnover", "Asset turnover", round(safeDiv(income.revenue, avg(t.totalAssets, prior?.totalAssets))), "times", "revenue / avg totalAssets"),
    m("dio", "Days inventory outstanding", round(dio), "days", "365 / inventory turnover"),
    m("dso", "Days sales outstanding", round(dso), "days", "365 / receivables turnover"),
    m("dpo", "Days payable outstanding", round(dpo), "days", "365 / payables turnover"),
    m("cash_conversion_cycle", "Cash conversion cycle", round(ccc), "days", "DIO + DSO − DPO"),
  ];

  return { profitability, liquidity, solvency, efficiency };
}

/** NOPAT / invested capital. Uses taxExpense when present, else taxRate. */
function computeRoic(input: AnalysisInput, t: StatementTotals): number | null {
  const { income, balance } = input;
  let taxRate: number;
  if (income.taxExpense !== undefined && t.pretaxIncome !== 0) {
    taxRate = income.taxExpense / t.pretaxIncome;
  } else {
    taxRate = input.taxRate ?? 0;
  }
  const nopat = t.ebit * (1 - taxRate);
  const investedCapital = t.totalDebt + balance.equity - balance.cash;
  return safeDiv(nopat, investedCapital);
}

function m(
  key: string,
  label: string,
  value: number | null,
  unit: Metric["unit"],
  formula: string
): Metric {
  return { key, label, value, unit, formula };
}
