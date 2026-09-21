"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/components/providers/LanguageProvider";
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

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="stat-tile">
      <div className="sl">{label}</div>
      <div className={`sv${tone === "bad" ? " bad" : " money"}`}>{value}</div>
    </div>
  );
}

// TODO: gate this page behind auth + an active subscription once Supabase
// auth and Stripe billing are wired up. It is intentionally open for now.
export default function ProPage() {
  const { t } = useLanguage();
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
    <div className="wrap page-head">
      <p className="eyebrow">{t("nav_cta")}</p>
      <h1>Pro Analyzer</h1>
      <p className="lead">
        Enter your income statement and balance sheet below. Every ratio is
        computed by our tested calculation engine — the AI only writes the
        narrative around the numbers you see.
      </p>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 24 }} role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
        <section className="card">
          <h2 className="card-title">Company</h2>
          <div className="field-grid">
            <Field id="company-name" label="Company name">
              <input
                id="company-name"
                type="text"
                value={form.companyName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    companyName: e.target.value,
                  }))
                }
              />
            </Field>
            <Field id="company-type" label="Business type">
              <select
                id="company-type"
                value={form.businessType}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    businessType: e.target.value as BusinessType,
                  }))
                }
              >
                {BUSINESS_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="company-currency" label="Currency">
              <input
                id="company-currency"
                type="text"
                value={form.currency}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, currency: e.target.value }))
                }
              />
            </Field>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Income statement</h2>
          <div className="field-grid">
            {INCOME_FIELDS.map((field) => (
              <Field key={field.key} id={`income-${field.key}`} label={field.label}>
                <input
                  id={`income-${field.key}`}
                  type="number"
                  step="any"
                  value={form.income[field.key]}
                  onChange={(e) => updateIncome(field.key, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Balance sheet</h2>
          <div className="field-grid">
            {BALANCE_FIELDS.map((field) => (
              <Field key={field.key} id={`balance-${field.key}`} label={field.label}>
                <input
                  id={`balance-${field.key}`}
                  type="number"
                  step="any"
                  value={form.balance[field.key]}
                  onChange={(e) => updateBalance(field.key, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </section>

        <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: 22 }}>
          {loading && <span className="spinner" aria-hidden="true" />}
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {data && totals && (
        <div style={{ marginTop: 56, display: "grid", gap: 40, paddingBottom: 64 }}>
          {data.report.source === "sample" && (
            <div className="alert alert-warning">
              Sample report — add an Anthropic API key for the full AI
              analysis.
            </div>
          )}

          {data.result.warnings.length > 0 && (
            <div className="alert alert-warning">
              <div>
                <p style={{ fontWeight: 600 }}>Data-quality warnings</p>
                <ul>
                  {data.result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <section>
            <h2 className="card-title" style={{ fontSize: 24, marginBottom: 4 }}>
              Summary
            </h2>
            <div className="result-grid">
              <StatTile label="Net income" value={formatCurrency(totals.netIncome, currency)} />
              <StatTile label="Gross profit" value={formatCurrency(totals.grossProfit, currency)} />
              <StatTile label="EBITDA" value={formatCurrency(totals.ebitda, currency)} />
              <StatTile label="EBIT" value={formatCurrency(totals.ebit, currency)} />
              <StatTile label="Total assets" value={formatCurrency(totals.totalAssets, currency)} />
              <StatTile label="Total liabilities" value={formatCurrency(totals.totalLiabilities, currency)} />
              <StatTile label="Working capital" value={formatCurrency(totals.workingCapital, currency)} />
              <StatTile
                label="Balance check"
                value={
                  totals.balanceCheckPasses
                    ? "Balanced"
                    : `Off by ${formatCurrency(totals.balanceCheckDifference, currency)}`
                }
                tone={totals.balanceCheckPasses ? "good" : "bad"}
              />
            </div>
          </section>

          <section>
            <h2 className="card-title" style={{ fontSize: 24, marginBottom: 4 }}>
              Ratios
            </h2>
            <div style={{ marginTop: 16, display: "grid", gap: 20 }}>
              {Object.entries(data.result.ratios).map(([group, metrics]) => (
                <div key={group} className="card">
                  <h3 className="card-title" style={{ fontSize: 17 }}>
                    {groupLabel(group)}
                  </h3>
                  <div className="result-grid">
                    {metrics.map((metric) => (
                      <StatTile
                        key={metric.key}
                        label={metric.label}
                        value={formatMetric(metric, currency)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="card-title" style={{ fontSize: 24, marginBottom: 4 }}>
              AI report
              {data.report.source === "ai" && data.report.model
                ? ` (${data.report.model})`
                : ""}
            </h2>
            <div className="report-paper" style={{ marginTop: 16 }}>
              <div className="markdown-report">
                <ReactMarkdown>{data.report.markdown}</ReactMarkdown>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
