/**
 * AI report agent. Turns the engine's VERIFIED numbers into a written analysis.
 *
 * BULLETPROOF GUARANTEE: the model is told, forcefully, that it is given
 * already-calculated figures and must NOT compute, invent, or alter any number
 * — it only interprets them. All arithmetic lives in the engine (statements /
 * ratios / valuation), never here.
 *
 * If no API key is configured, `generateReport` returns a deterministic SAMPLE
 * report built from the same numbers, so the UI/format works before billing is
 * wired up.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Metric } from "./types";
import type { AnalysisResult as Result } from "./analyze";

export interface ReportOptions {
  companyName?: string;
  model?: string;
  apiKey?: string;
  /** Language for the written narrative (live AI path only). Numbers/units are
   *  never translated. Defaults to English. The offline sample stays English. */
  language?: "en" | "fr" | "ar";
  /** override to force the sample generator even when a key exists (tests) */
  forceSample?: boolean;
}

/** Extra system directive telling the model which language to write in. The
 *  engine still computes every number; only the prose language changes. */
function langDirective(language?: ReportOptions["language"]): string {
  if (language === "fr")
    return `\n\nWRITE THE ENTIRE REPORT IN FRENCH (français) — every heading and every sentence. Keep all numbers, percentages, currency codes and units exactly as given; never translate or alter a figure.`;
  if (language === "ar")
    return `\n\nWRITE THE ENTIRE REPORT IN ARABIC (العربية) — every heading and every sentence, in fluent right-to-left Arabic. Keep all numbers, percentages, currency codes and units exactly as given (using Western Arabic numerals); never translate or alter a figure.`;
  return "";
}

export interface AnalysisReport {
  source: "ai" | "sample";
  markdown: string;
  model?: string;
}

const SYSTEM_PROMPT = `You are a senior financial analyst writing a report for a business owner who is not a finance expert.

You are given a set of ALREADY-CALCULATED, VERIFIED financial figures for one company. Your job is to INTERPRET them.

STRICT RULES — follow exactly:
- Do NOT perform any calculations. Do NOT invent, estimate, round, or change any number.
- Use ONLY the figures provided, and refer to them exactly as given (with the stated currency/unit).
- If a figure is null, "n/a", or missing, say it is not available — never guess or back-fill it.
- If a data-quality warning is provided (e.g. the balance sheet does not balance), call it out honestly near the top.
- Focus your emphasis on the metrics flagged as most important for this business type.

Write these sections, in order, using Markdown headings:
1. **Executive summary** — 3–5 sentences: overall financial health and the single most important takeaway.
2. **Profitability** 3. **Liquidity & working capital** 4. **Solvency & leverage** 5. **Efficiency**
6. **CapEx / OpEx & investment** — comment on cost structure and (if present) any investment metrics.
7. **Key risks** — bullet points.
8. **Recommendations** — prioritized, concrete, actionable bullet points.

Be clear, specific, and practical. Explain what each number means for the business, not just what it is.`;

function flatten(result: Result): Metric[] {
  return Object.values(result.ratios).flat();
}

function fmt(m: Metric): string {
  if (m.value === null) return `${m.label}: n/a`;
  const suffix =
    m.unit === "percent" ? "%" : m.unit === "days" ? " days" : m.unit === "times" ? "x" : "";
  return `${m.label}: ${m.value.toLocaleString()}${suffix}`;
}

/** Compact, model-friendly serialization of the verified numbers. */
function buildUserPrompt(result: Result, opts: ReportOptions): string {
  const name = opts.companyName ?? "The company";
  const t = result.totals;
  const lines: string[] = [];
  lines.push(`Company: ${name}`);
  lines.push(`Business type: ${result.businessType}`);
  lines.push(`Currency: ${result.currency}`);
  lines.push("");
  lines.push("VERIFIED TOTALS:");
  lines.push(`- Revenue-derived: gross profit ${t.grossProfit}, EBITDA ${t.ebitda}, EBIT ${t.ebit}, pre-tax ${t.pretaxIncome}, net income ${t.netIncome}`);
  lines.push(`- Balance sheet: total assets ${t.totalAssets}, total liabilities ${t.totalLiabilities}, working capital ${t.workingCapital}, total debt ${t.totalDebt}`);
  lines.push(`- Balance check passes: ${t.balanceCheckPasses} (difference ${t.balanceCheckDifference})`);
  lines.push("");
  lines.push("VERIFIED RATIOS (grouped):");
  for (const [group, metrics] of Object.entries(result.ratios)) {
    lines.push(`  ${group}: ${(metrics as Metric[]).map(fmt).join("; ")}`);
  }
  lines.push("");
  lines.push(`MOST IMPORTANT METRICS for a ${result.businessType} business: ${result.focusMetrics.join(", ")}`);
  if (result.warnings.length) {
    lines.push("");
    lines.push("DATA-QUALITY WARNINGS (mention honestly):");
    result.warnings.forEach((w) => lines.push(`- ${w}`));
  }
  lines.push("");
  lines.push("Write the report now, following the section structure and rules exactly.");
  return lines.join("\n");
}

export async function generateReport(
  result: Result,
  opts: ReportOptions = {}
): Promise<AnalysisReport> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;

  if (opts.forceSample || !apiKey) {
    return { source: "sample", markdown: buildSampleReport(result, opts) };
  }

  // Cost-tuned default: Sonnet gives strong analysis at ~1/3 the price of Opus,
  // which keeps the subscription tiers profitable. Override with ANALYSIS_MODEL
  // (e.g. "claude-opus-5") for premium reports.
  const model = opts.model ?? process.env.ANALYSIS_MODEL ?? "claude-sonnet-5";
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    system: SYSTEM_PROMPT + langDirective(opts.language),
    messages: [{ role: "user", content: buildUserPrompt(result, opts) }],
  });

  const markdown = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return { source: "ai", markdown, model };
}

/**
 * Deterministic sample report — no AI. Uses the same verified numbers with
 * simple threshold-based commentary so the report format is visible without a
 * key. (The live AI report is richer and business-aware.)
 */
export function buildSampleReport(result: Result, opts: ReportOptions = {}): string {
  const name = opts.companyName ?? "The company";
  const cur = result.currency;
  const metrics = flatten(result);
  const by = (key: string) => metrics.find((m) => m.key === key);

  const netMargin = by("net_margin")?.value;
  const current = by("current_ratio")?.value;
  const de = by("debt_to_equity")?.value;

  const health =
    netMargin === null || netMargin === undefined
      ? "cannot be assessed (missing data)"
      : netMargin >= 10
        ? "healthy"
        : netMargin >= 3
          ? "modest but positive"
          : netMargin >= 0
            ? "thin"
            : "loss-making";

  const out: string[] = [];
  out.push(`# Financial Analysis — ${name}`);
  out.push(`_Business type: ${result.businessType} · Currency: ${cur} · (sample report — connect an API key for the full AI-written version)_`);
  out.push("");
  if (result.warnings.length) {
    out.push(`> ⚠ **Data notes:** ${result.warnings.join(" ")}`);
    out.push("");
  }
  out.push(`## Executive summary`);
  out.push(
    `${name} is currently **${health}** on a net-margin basis (net margin ${fmtVal(by("net_margin"))}). ` +
      `Liquidity is indicated by a current ratio of ${fmtVal(by("current_ratio"))}, and leverage by a debt-to-equity of ${fmtVal(by("debt_to_equity"))}. ` +
      `Net income for the period is ${result.totals.netIncome.toLocaleString()} ${cur}.`
  );
  out.push("");

  const section = (title: string, keys: string[]) => {
    out.push(`## ${title}`);
    for (const k of keys) {
      const m = by(k);
      if (m) out.push(`- **${m.label}:** ${fmtVal(m)}`);
    }
    out.push("");
  };
  section("Profitability", ["gross_margin", "operating_margin", "ebitda_margin", "net_margin", "roa", "roe", "roic"]);
  section("Liquidity & working capital", ["current_ratio", "quick_ratio", "cash_ratio", "working_capital"]);
  section("Solvency & leverage", ["debt_to_equity", "debt_ratio", "interest_coverage", "net_debt"]);
  section("Efficiency", ["inventory_turnover", "receivables_turnover", "asset_turnover", "dio", "dso", "dpo", "cash_conversion_cycle"]);

  out.push(`## Key risks`);
  if (current !== null && current !== undefined && current < 1) out.push(`- Current ratio below 1.0 — potential short-term liquidity pressure.`);
  if (de !== null && de !== undefined && de > 2) out.push(`- High debt-to-equity (${de}) — elevated financial risk.`);
  if (netMargin !== null && netMargin !== undefined && netMargin < 0) out.push(`- Negative net margin — the business is currently unprofitable.`);
  out.push(`- Review the focus metrics for a ${result.businessType} business: ${result.focusMetrics.join(", ")}.`);
  out.push("");
  out.push(`## Recommendations`);
  out.push(`- Prioritize the weakest of the focus metrics above.`);
  out.push(`- Compare these ratios against ${result.businessType}-industry benchmarks.`);
  out.push(`- Re-run with prior-period balances to get average-based turnover ratios.`);
  return out.join("\n");
}

function fmtVal(m: Metric | undefined): string {
  if (!m) return "n/a";
  if (m.value === null) return "n/a";
  const suffix =
    m.unit === "percent" ? "%" : m.unit === "days" ? " days" : m.unit === "times" ? "x" : "";
  return `${m.value.toLocaleString()}${suffix}`;
}

// Re-export the engine result type name for convenience.
export type { AnalysisResult } from "./analyze";
