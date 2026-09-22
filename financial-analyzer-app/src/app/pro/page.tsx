"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { DictKey } from "@/lib/i18n/types";
import { en as EN } from "@/lib/i18n/merged";
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
// typo here would be a compile error rather than a silent bug). Labels are
// i18n keys resolved at render time. ----

const INCOME_FIELDS = [
  { key: "revenue", i18n: "f_revenue" },
  { key: "cogs", i18n: "f_cogs" },
  { key: "operatingExpenses", i18n: "f_opex" },
  { key: "depreciation", i18n: "f_dep" },
  { key: "interestExpense", i18n: "f_interest" },
  { key: "taxExpense", i18n: "f_tax" },
] as const satisfies { key: keyof IncomeStatementInput; i18n: DictKey }[];

const BALANCE_FIELDS = [
  { key: "cash", i18n: "f_cash" },
  { key: "accountsReceivable", i18n: "f_ar" },
  { key: "inventory", i18n: "f_inventory" },
  { key: "ppe", i18n: "f_ppe" },
  { key: "accountsPayable", i18n: "f_ap" },
  { key: "shortTermDebt", i18n: "f_std" },
  { key: "longTermDebt", i18n: "f_ltd" },
  { key: "equity", i18n: "f_equity" },
] as const satisfies { key: keyof BalanceSheetInput; i18n: DictKey }[];

type IncomeFieldKey = (typeof INCOME_FIELDS)[number]["key"];
type BalanceFieldKey = (typeof BALANCE_FIELDS)[number]["key"];

const BUSINESS_TYPE_OPTIONS: { value: BusinessType; i18n: DictKey }[] = [
  { value: "generic", i18n: "bt_generic" },
  { value: "retail", i18n: "bt_retail" },
  { value: "restaurant", i18n: "bt_restaurant" },
  { value: "saas", i18n: "bt_saas" },
  { value: "manufacturing", i18n: "bt_manufacturing" },
  { value: "services", i18n: "bt_services" },
  { value: "ecommerce", i18n: "bt_ecommerce" },
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
  const { t, lang } = useLanguage();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [data, setData] = useState<AnalyzeApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Translate an engine ratio label by its stable key, falling back to the
  // engine's own English label if a translation is somehow missing.
  function metricLabel(metric: Metric): string {
    const key = `m_${metric.key}` as DictKey;
    return key in EN ? t(key) : metric.label;
  }
  function groupTitle(group: string): string {
    const key = `g_${group}` as DictKey;
    return key in EN ? t(key) : group.charAt(0).toUpperCase() + group.slice(1);
  }

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
          language: lang,
        }),
      });
      const payload = (await response.json()) as
        | AnalyzeApiResult
        | AnalyzeApiError;
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : t("err_generic"));
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("err_generic"));
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
      <h1>{t("pro_h1")}</h1>
      <p className="lead">{t("pro_lead")}</p>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 24 }} role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
        <section className="card">
          <h2 className="card-title">{t("sec_company")}</h2>
          <div className="field-grid">
            <Field id="company-name" label={t("f_company_name")}>
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
            <Field id="company-type" label={t("f_business_type")}>
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
                    {t(option.i18n)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="company-currency" label={t("f_currency")}>
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
          <h2 className="card-title">{t("sec_income")}</h2>
          <div className="field-grid">
            {INCOME_FIELDS.map((field) => (
              <Field key={field.key} id={`income-${field.key}`} label={t(field.i18n)}>
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
          <h2 className="card-title">{t("sec_balance")}</h2>
          <div className="field-grid">
            {BALANCE_FIELDS.map((field) => (
              <Field key={field.key} id={`balance-${field.key}`} label={t(field.i18n)}>
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
          {loading ? t("btn_analyzing") : t("btn_analyze")}
        </button>
      </form>

      {data && totals && (
        <div style={{ marginTop: 56, display: "grid", gap: 40, paddingBottom: 64 }}>
          {data.report.source === "sample" && (
            <div className="alert alert-warning">{t("r_sample")}</div>
          )}

          {data.result.warnings.length > 0 && (
            <div className="alert alert-warning">
              <div>
                <p style={{ fontWeight: 600 }}>{t("r_warnings")}</p>
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
              {t("r_summary")}
            </h2>
            <div className="result-grid">
              <StatTile label={t("sl_net_income")} value={formatCurrency(totals.netIncome, currency)} />
              <StatTile label={t("sl_gross_profit")} value={formatCurrency(totals.grossProfit, currency)} />
              <StatTile label={t("sl_ebitda")} value={formatCurrency(totals.ebitda, currency)} />
              <StatTile label={t("sl_ebit")} value={formatCurrency(totals.ebit, currency)} />
              <StatTile label={t("sl_total_assets")} value={formatCurrency(totals.totalAssets, currency)} />
              <StatTile label={t("sl_total_liabilities")} value={formatCurrency(totals.totalLiabilities, currency)} />
              <StatTile label={t("sl_working_capital")} value={formatCurrency(totals.workingCapital, currency)} />
              <StatTile
                label={t("sl_balance_check")}
                value={
                  totals.balanceCheckPasses
                    ? t("r_balanced")
                    : `${t("r_off_by")} ${formatCurrency(totals.balanceCheckDifference, currency)}`
                }
                tone={totals.balanceCheckPasses ? "good" : "bad"}
              />
            </div>
          </section>

          <section>
            <h2 className="card-title" style={{ fontSize: 24, marginBottom: 4 }}>
              {t("r_ratios")}
            </h2>
            <div style={{ marginTop: 16, display: "grid", gap: 20 }}>
              {Object.entries(data.result.ratios).map(([group, metrics]) => (
                <div key={group} className="card">
                  <h3 className="card-title" style={{ fontSize: 17 }}>
                    {groupTitle(group)}
                  </h3>
                  <div className="result-grid">
                    {metrics.map((metric) => (
                      <StatTile
                        key={metric.key}
                        label={metricLabel(metric)}
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
              {t("r_ai_report")}
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
