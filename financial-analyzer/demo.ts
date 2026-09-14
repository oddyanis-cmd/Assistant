/** Runnable demo: `npm run demo`. Shows the structured object the AI layer
 *  would narrate — every number here is computed by the tested engine. */
import { analyze } from "./src/analyze";
import { generateReport } from "./src/report";
import type { AnalysisInput } from "./src/types";

const acme: AnalysisInput = {
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

const result = analyze(acme);

console.log(`\n=== ${acme.businessType?.toUpperCase()} analysis (${result.currency}) ===`);
console.log(`Net income: ${result.totals.netIncome.toLocaleString()} ${result.currency}`);
console.log(`Balance sheet balances: ${result.totals.balanceCheckPasses}`);
for (const [group, metrics] of Object.entries(result.ratios)) {
  console.log(`\n${group}:`);
  for (const m of metrics) {
    const v = m.value === null ? "n/a" : m.value.toLocaleString();
    const suffix = m.unit === "percent" ? "%" : m.unit === "days" ? " days" : m.unit === "times" ? "x" : "";
    console.log(`  ${m.label.padEnd(30)} ${v}${suffix}`);
  }
}
if (result.warnings.length) {
  console.log(`\nWarnings:`);
  result.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}

// Written report — live AI when ANTHROPIC_API_KEY is set, else a sample.
const report = await generateReport(result, { companyName: "Acme Retail Co." });
console.log(`\n\n===== ${report.source.toUpperCase()} REPORT${report.model ? ` (${report.model})` : ""} =====\n`);
console.log(report.markdown);
