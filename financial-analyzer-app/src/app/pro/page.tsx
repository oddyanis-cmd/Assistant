"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import type {
  AnalysisInput,
  BusinessType,
  BalanceSheetInput,
  IncomeStatementInput,
  Metric,
} from "@/lib/engine/types";
import type { AnalysisResult } from "@/lib/engine/analyze";
import type { AnalysisReport } from "@/lib/engine/report";

// ---- Field configuration (typed against the engine's own input types, so a
// typo here would be a compile error rather than a silent bug). ----

const INCOME_FIELDS = [
  { key: "revenue", label: "Revenue" },
  { key: "cogs", label: "Cost of goods sold (COGS)" },
  { key: "operatingExpenses", label: "Operating expenses (excl. D&A)" },
  { key: "depreciation", label: "Depreciation" },
  { key: "interestExpense", label: "Interest expense" },
  { key: "taxExpense", label: "Tax expense" },
] as const satisfies { key: keyof IncomeStatementInput; label: string }[];

const BALANCE_FIELDS = [
  { key: "cash", label: "Cash" },
  { key: "accountsReceivable", label: "Accounts receivable" },
  { key: "inventory", label: "Inventory" },
  { key: "ppe", label: "Property, plant & equipment (net)" },
  { key: "accountsPayable", label: "Accounts payable" },
  { key: "shortTermDebt", label: "Short-term debt" },
  { key: "longTermDebt", label: "Long-term debt" },
  { key: "equity", label: "Equity" },
] as const satisfies { key: keyof BalanceSheetInput; label: string }[];

type IncomeFieldKey = (typeof INCOME_FIELDS)[number]["key"];
type BalanceFieldKey = (typeof BALANCE_FIELDS)[number]["key"];

const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: "generic", label: "Generic" },
  { value: "retail", label: "Retail" },
  { value: "restaurant", label: "Restaurant" },
  { value: "saas", label: "SaaS" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "services", label: "Services" },
  { value: "ecommerce", label: "E-commerce" },
];

interface FormState {
  companyName: string;
  currency: string;
  businessType: BusinessType;
  income: Record<IncomeFieldKey, string>;
  balance: Record<BalanceFieldKey, string>;
}

// Pre-filled with the sample company from financial-analyzer/demo.ts so a
// visitor can click "Analyze" immediately.
const DEFAULT_FORM: FormState = {
  companyName: "Acme Retail Co.",
  currency: "QAR",
  businessType: "retail",
  income: {
    revenue: "1000000",
    cogs: "600000",
    operatingExpenses: "200000",
    depreciation: "50000",
    interestExpense: "20000",
    taxExpense: "32500",
  },
  balance: {
    cash: "100000",
    accountsReceivable: "80000",
    inventory: "120000",
    ppe: "500000",
    accountsPayable: "90000",
    shortTermDebt: "60000",
    longTermDebt: "250000",
    equity: "400000",
  },
};

interface AnalyzeApiResult {
  result: AnalysisResult;
  report: AnalysisReport;
}
interface AnalyzeApiError {
  error: string;
}

const inputClass =
  "w-full rounded-md border border-white/15 bg-navy px-3 py-2 text-sm text-offwhite outline-none transition focus:border-gold focus:ring-1 focus:ring-gold";

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildAnalysisInput(state: FormState): AnalysisInput {
  return {
    businessType: state.businessType,
    currency: state.currency.trim() || "QAR",
    income: {
      revenue: num(state.income.revenue),
      cogs: num(state.income.cogs),
      operatingExpenses: num(state.income.operatingExpenses),
      depreciation: num(state.income.depreciation),
      interestExpense: num(state.income.interestExpense),
      taxExpense: num(state.income.taxExpense),
    },
    balance: {
      cash: num(state.balance.cash),
      accountsReceivable: num(state.balance.accountsReceivable),
      inventory: num(state.balance.inventory),
      ppe: num(state.balance.ppe),
      accountsPayable: num(state.balance.accountsPayable),
      shortTermDebt: num(state.balance.shortTermDebt),
      longTermDebt: num(state.balance.longTermDebt),
      equity: num(state.balance.equity),
    },
  };
}

function formatCurrency(value: number, currency: string): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function formatMetric(metric: Metric, currency: string): string {
  if (metric.value === null) return "n/a";
  const formatted = metric.value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  switch (metric.unit) {
    case "percent":
      return `${formatted}%`;
    case "times":
      return `${formatted}x`;
    case "days":
      return `${formatted}d`;
    case "currency":
      return `${formatted} ${currency}`;
    case "ratio":
    default:
      return formatted;
  }
}

function groupLabel(group: string): string {
  return group.charAt(0).toUpperCase() + group.slice(1);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-offwhite/70">{label}</span>
      {children}
    </label>
  );
}

function TotalStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <dt className="text-xs uppercase tracking-wide text-offwhite/50">
        {label}
      </dt>
      <dd
        className={`mt-1 text-lg font-semibold ${
          tone === "good"
            ? "text-emerald-300"
            : tone === "bad"
              ? "text-rose-300"
              : "text-offwhite"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

// TODO: gate this page behind auth + an active subscription once Supabase
// auth and Stripe billing are wired up. It is intentionally open for now.
export default function ProPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [data, setData] = useState<AnalyzeApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateIncome(key: IncomeFieldKey, value: string) {
    setForm((prev) => ({ ...prev, income: { ...prev.income, [key]: value } }));
  }

  function updateBalance(key: BalanceFieldKey, value: string) {
    setForm((prev) => ({
      ...prev,
      balance: { ...prev.balance, [key]: value },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const input = buildAnalysisInput(form);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          companyName: form.companyName.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as
        | AnalyzeApiResult
        | AnalyzeApiError;
      if (!response.ok || "error" in payload) {
        throw new Error(
          "error" in payload
            ? payload.error
            : "Something went wrong. Please try again."
        );
      }
      setData(payload);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const totals = data?.result.totals;
  const currency = data?.result.currency ?? form.currency;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
        Pro Analyzer
      </h1>
      <p className="mt-4 max-w-2xl text-offwhite/70">
        Enter your income statement and balance sheet below. Every ratio is
        computed by our tested calculation engine — the AI only writes the
        narrative around the numbers you see.
      </p>

      {error && (
        <div className="mt-6 rounded-md border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-serif text-xl font-semibold text-gold">
            Company
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Company name">
              <input
                type="text"
                value={form.companyName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    companyName: e.target.value,
                  }))
                }
                className={inputClass}
              />
            </Field>
            <Field label="Business type">
              <select
                value={form.businessType}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    businessType: e.target.value as BusinessType,
                  }))
                }
                className={inputClass}
              >
                {BUSINESS_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <input
                type="text"
                value={form.currency}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, currency: e.target.value }))
                }
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-serif text-xl font-semibold text-gold">
            Income statement
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INCOME_FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>
                <input
                  type="number"
                  step="any"
                  value={form.income[field.key]}
                  onChange={(e) => updateIncome(field.key, e.target.value)}
                  className={inputClass}
                />
              </Field>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-serif text-xl font-semibold text-gold">
            Balance sheet
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BALANCE_FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>
                <input
                  type="number"
                  step="any"
                  value={form.balance[field.key]}
                  onChange={(e) => updateBalance(field.key, e.target.value)}
                  className={inputClass}
                />
              </Field>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-6 py-3 text-sm font-semibold text-navy transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-navy/30 border-t-navy"
              aria-hidden="true"
            />
          )}
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {data && totals && (
        <div className="mt-14 space-y-10">
          {data.report.source === "sample" && (
            <div className="rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
              Sample report — add an Anthropic API key for the full AI
              analysis.
            </div>
          )}

          {data.result.warnings.length > 0 && (
            <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              <p className="font-semibold">Data-quality warnings</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {data.result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <section>
            <h2 className="font-serif text-2xl font-semibold">Summary</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TotalStat
                label="Net income"
                value={formatCurrency(totals.netIncome, currency)}
              />
              <TotalStat
                label="Gross profit"
                value={formatCurrency(totals.grossProfit, currency)}
              />
              <TotalStat
                label="EBITDA"
                value={formatCurrency(totals.ebitda, currency)}
              />
              <TotalStat
                label="EBIT"
                value={formatCurrency(totals.ebit, currency)}
              />
              <TotalStat
                label="Total assets"
                value={formatCurrency(totals.totalAssets, currency)}
              />
              <TotalStat
                label="Total liabilities"
                value={formatCurrency(totals.totalLiabilities, currency)}
              />
              <TotalStat
                label="Working capital"
                value={formatCurrency(totals.workingCapital, currency)}
              />
              <TotalStat
                label="Balance check"
                value={
                  totals.balanceCheckPasses
                    ? "Balanced"
                    : `Off by ${formatCurrency(totals.balanceCheckDifference, currency)}`
                }
                tone={totals.balanceCheckPasses ? "good" : "bad"}
              />
            </dl>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold">Ratios</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {Object.entries(data.result.ratios).map(([group, metrics]) => (
                <div
                  key={group}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h3 className="font-serif text-lg font-semibold text-gold">
                    {groupLabel(group)}
                  </h3>
                  <dl className="mt-4 grid grid-cols-2 gap-3">
                    {metrics.map((metric) => (
                      <div
                        key={metric.key}
                        className="rounded-lg border border-white/10 bg-white/5 p-3"
                      >
                        <dt className="text-xs uppercase tracking-wide text-offwhite/50">
                          {metric.label}
                        </dt>
                        <dd className="mt-1 text-base font-semibold text-offwhite">
                          {formatMetric(metric, currency)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold">
              AI report
              {data.report.source === "ai" && data.report.model
                ? ` (${data.report.model})`
                : ""}
            </h2>
            <div className="markdown-report mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <ReactMarkdown>{data.report.markdown}</ReactMarkdown>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
