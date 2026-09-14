/**
 * Finance — /admin/finance
 * Gated on any of: view_financial_reports, view_revenue, manage_invoices,
 * manage_expenses, view_sales_reports.
 * Revenue summary + recent payments (with refund) + recent invoices +
 * the expenses ledger (list/add/edit/delete via ExpensesPanel).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getRevenueMetrics } from "@/lib/metrics";
import { getRecentPayments, getRecentInvoices, getExpenses, type PaymentRow, type InvoiceRow } from "@/lib/finance";
import { CURRENCY } from "@/lib/config";
import { RefundButton } from "@/components/admin/finance/RefundButton";
import { ExpensesPanel } from "@/components/admin/finance/ExpensesPanel";

export const metadata: Metadata = { title: "Finance — Admin" };

interface FinancePageProps {
  params: Promise<{ locale: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  paid:     "bg-green-100 text-green-700",
  partial:  "bg-cream-100 text-cream-700",
  pending:  "bg-nude-100 text-nude-600",
  refunded: "bg-charcoal-100 text-charcoal-500",
  failed:   "bg-red-100 text-red-700",
};

export default async function AdminFinancePage({ params }: FinancePageProps) {
  const { locale } = await params;
  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/finance`);
  }

  const canView =
    can(user, PERMISSIONS.VIEW_FINANCIAL_REPORTS) ||
    can(user, PERMISSIONS.VIEW_REVENUE) ||
    can(user, PERMISSIONS.MANAGE_INVOICES) ||
    can(user, PERMISSIONS.MANAGE_EXPENSES) ||
    can(user, PERMISSIONS.VIEW_SALES_REPORTS);

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">◈</div>
          <p className="text-charcoal-600 text-sm">
            You do not have permission to view financial data.
          </p>
        </div>
      </div>
    );
  }

  const canRefund         = can(user, PERMISSIONS.ISSUE_REFUND);
  const canManageExpenses = can(user, PERMISSIONS.MANAGE_EXPENSES);

  const [revenue, payments, invoices, expenses] = await Promise.all([
    getRevenueMetrics("month"),
    getRecentPayments(25),
    getRecentInvoices(25),
    getExpenses(200),
  ]);

  const expensesTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netRevenue = revenue.currentRevenue - expensesTotal;

  const fmt = (n: number) =>
    `${n.toLocaleString("en-SA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${CURRENCY}`;

  const dateFmt = (value: string) =>
    new Date(value).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-light text-charcoal-900">Finance</h1>
        <p className="text-charcoal-500 text-sm mt-1">
          Revenue, payments, invoices, and expenses.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Revenue (this month)"
          value={fmt(revenue.currentRevenue)}
          sub={`${revenue.changePct >= 0 ? "+" : ""}${revenue.changePct}% vs previous`}
          accent="rose"
        />
        <SummaryCard
          label="Total bookings"
          value={String(revenue.totalBookings)}
          sub={`${revenue.completedCount} completed · ${revenue.cancelledCount} cancelled`}
          accent="nude"
        />
        <SummaryCard
          label="Expenses logged"
          value={fmt(expensesTotal)}
          sub={`${expenses.length} ${expenses.length === 1 ? "entry" : "entries"}`}
          accent="nude"
        />
        <SummaryCard
          label="Net (revenue − expenses)"
          value={fmt(netRevenue)}
          sub="This month's revenue minus all logged expenses"
          accent={netRevenue >= 0 ? "green" : "red"}
        />
      </div>

      {/* Recent payments */}
      <section className="card overflow-x-auto p-0">
        <div className="px-6 py-4 border-b border-nude-100">
          <h2 className="text-sm font-semibold text-charcoal-700">Recent Payments</h2>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-charcoal-400 italic py-8 text-center">No payments yet.</p>
        ) : (
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="border-b border-nude-100">
              <tr>
                {["Date", "Client", "Amount", "Provider", "Status", ""].map((col) => (
                  <th
                    key={col}
                    className="py-3 px-4 text-xs font-semibold text-charcoal-500 uppercase tracking-wide"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p: PaymentRow) => (
                <tr key={p.id} className="border-b border-nude-50 hover:bg-rose-50/20">
                  <td className="py-3 px-4 text-charcoal-600 whitespace-nowrap">
                    {dateFmt(p.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-charcoal-700">{p.clientName ?? "—"}</td>
                  <td className="py-3 px-4 font-medium text-charcoal-800 whitespace-nowrap">
                    {p.amount.toLocaleString("en-SA")} {p.currency}
                  </td>
                  <td className="py-3 px-4 text-charcoal-500 capitalize">{p.provider ?? "—"}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                        STATUS_STYLES[p.status] ?? "bg-nude-100 text-nude-600"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {canRefund && p.status === "paid" && (
                      <RefundButton paymentId={p.id} locale={locale} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Recent invoices */}
      <section className="card overflow-x-auto p-0">
        <div className="px-6 py-4 border-b border-nude-100">
          <h2 className="text-sm font-semibold text-charcoal-700">Recent Invoices</h2>
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-charcoal-400 italic py-8 text-center">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="border-b border-nude-100">
              <tr>
                {["Issued", "Client", "Total", "Status", "Paid"].map((col) => (
                  <th
                    key={col}
                    className="py-3 px-4 text-xs font-semibold text-charcoal-500 uppercase tracking-wide"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: InvoiceRow) => (
                <tr key={inv.id} className="border-b border-nude-50 hover:bg-rose-50/20">
                  <td className="py-3 px-4 text-charcoal-600 whitespace-nowrap">
                    {dateFmt(inv.issuedAt)}
                  </td>
                  <td className="py-3 px-4 text-charcoal-700">{inv.clientName ?? "—"}</td>
                  <td className="py-3 px-4 font-medium text-charcoal-800 whitespace-nowrap">
                    {inv.total.toLocaleString("en-SA")} {CURRENCY}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                        STATUS_STYLES[inv.status] ?? "bg-nude-100 text-nude-600"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-charcoal-500 whitespace-nowrap">
                    {inv.paidAt ? dateFmt(inv.paidAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Expenses ledger */}
      <ExpensesPanel
        locale={locale}
        expenses={expenses}
        canManage={canManageExpenses}
        currency={CURRENCY}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "rose" | "nude" | "green" | "red";
}) {
  const accentClasses: Record<string, string> = {
    rose: "bg-rose-50 border-rose-100",
    nude: "bg-nude-50 border-nude-100",
    green: "bg-green-50 border-green-100",
    red: "bg-red-50 border-red-100",
  };
  const valueClasses: Record<string, string> = {
    rose: "text-charcoal-900",
    nude: "text-charcoal-900",
    green: "text-green-700",
    red: "text-red-600",
  };

  return (
    <div className={`rounded-2xl border p-5 ${accentClasses[accent]}`}>
      <p className="text-xs font-medium text-charcoal-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-semibold truncate ${valueClasses[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-charcoal-400 mt-1.5">{sub}</p>}
    </div>
  );
}
