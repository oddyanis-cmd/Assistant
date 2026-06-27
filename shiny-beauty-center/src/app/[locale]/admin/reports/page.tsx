/**
 * Admin Reports — /admin/reports
 * Gated on view_sales_reports | view_staff_performance | view_booking_reports
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import {
  getStaffPerformance,
  getServicePopularity,
  getCommissionSummary,
} from "@/lib/metrics";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = { title: "Reports — Admin" };

interface ReportsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; report?: string }>;
}

export default async function AdminReportsPage({
  params,
  searchParams,
}: ReportsPageProps) {
  const { locale } = await params;
  const { from, to, report: rawReport } = await searchParams;
  const report = rawReport ?? "staff";

  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/reports`);
  }

  const t = await getTranslations("adminPortal");

  const canStaff       = can(user, PERMISSIONS.VIEW_STAFF_PERFORMANCE);
  const canServices    = can(user, PERMISSIONS.VIEW_SALES_REPORTS) || can(user, PERMISSIONS.VIEW_BOOKING_REPORTS);
  const canCommission  = can(user, PERMISSIONS.VIEW_COMMISSION);

  if (!canStaff && !canServices && !canCommission) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">◎</div>
          <p className="text-charcoal-600 text-sm">{t("access_denied_body")}</p>
        </div>
      </div>
    );
  }

  // Fetch data depending on selected report
  let staffRows = canStaff && report === "staff"
    ? await getStaffPerformance(from, to)
    : [];
  let serviceRows = canServices && report === "services"
    ? await getServicePopularity(from, to)
    : [];
  let commissionRows = canCommission && report === "commission"
    ? await getCommissionSummary(from, to)
    : [];

  // Available tabs
  const tabs = [
    { key: "staff",      label: t("report_staff_performance"),  show: canStaff },
    { key: "services",   label: t("report_service_popularity"), show: canServices },
    { key: "commission", label: t("report_commission"),         show: canCommission },
  ].filter((tb) => tb.show);

  // CSV export URL
  const csvParams = new URLSearchParams({ report });
  if (from) csvParams.set("from", from);
  if (to)   csvParams.set("to",   to);
  const csvUrl = `/${locale}/admin/reports/export.csv?${csvParams}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-charcoal-900">{t("reports_title")}</h1>
          <p className="text-charcoal-500 text-sm mt-1">{t("reports_subtitle")}</p>
        </div>

        {/* CSV Export */}
        <a
          href={csvUrl}
          download
          className="btn-secondary text-sm self-start whitespace-nowrap"
        >
          {t("export_csv")}
        </a>
      </div>

      {/* Date filter */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <input type="hidden" name="report" value={report} />
        <div>
          <label className="field-label">{t("date_from")}</label>
          <input
            name="from"
            type="date"
            defaultValue={from ?? ""}
            className="field-input w-auto"
          />
        </div>
        <div>
          <label className="field-label">{t("date_to")}</label>
          <input
            name="to"
            type="date"
            defaultValue={to ?? ""}
            className="field-input w-auto"
          />
        </div>
        <button type="submit" className="btn-primary h-11">
          {t("apply_filter")}
        </button>
      </form>

      {/* Report tabs */}
      <div className="flex gap-1 bg-white/80 rounded-xl p-1 border border-nude-200 self-start w-fit">
        {tabs.map((tab) => {
          const href = `?report=${tab.key}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;
          return (
            <a
              key={tab.key}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                report === tab.key
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-charcoal-600 hover:bg-rose-50"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* ---- Staff performance table ---- */}
      {report === "staff" && canStaff && (
        <section className="card overflow-x-auto">
          <h2 className="text-base font-semibold text-charcoal-800 mb-4">
            {t("report_staff_performance")}
          </h2>
          {staffRows.length === 0 ? (
            <EmptyState message={t("no_data")} />
          ) : (
            <table className="w-full text-sm text-left rtl:text-right">
              <thead>
                <tr className="border-b border-nude-100">
                  {[
                    t("col_staff"),
                    t("col_appointments"),
                    t("col_completed"),
                    t("col_revenue"),
                    t("col_no_shows"),
                    t("col_rating"),
                  ].map((col) => (
                    <th key={col} className="py-2 px-3 text-xs font-semibold text-charcoal-500 uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffRows.map((row) => (
                  <tr key={row.staffId} className="border-b border-nude-50 hover:bg-rose-50/30">
                    <td className="py-3 px-3 font-medium text-charcoal-800">{row.staffName}</td>
                    <td className="py-3 px-3 text-charcoal-600">{row.totalAppts}</td>
                    <td className="py-3 px-3 text-charcoal-600">{row.completed}</td>
                    <td className="py-3 px-3 text-charcoal-600">{row.revenue.toLocaleString("en-SA")}</td>
                    <td className="py-3 px-3 text-charcoal-600">{row.noShows}</td>
                    <td className="py-3 px-3 text-charcoal-600">
                      {row.avgRating != null ? (
                        <span className="flex items-center gap-1">
                          <span className="text-rose-400">★</span>
                          {row.avgRating.toFixed(1)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* ---- Service popularity table ---- */}
      {report === "services" && canServices && (
        <section className="card overflow-x-auto">
          <h2 className="text-base font-semibold text-charcoal-800 mb-4">
            {t("report_service_popularity")}
          </h2>
          {serviceRows.length === 0 ? (
            <EmptyState message={t("no_data")} />
          ) : (
            <table className="w-full text-sm text-left rtl:text-right">
              <thead>
                <tr className="border-b border-nude-100">
                  {[
                    t("col_service"),
                    t("col_category"),
                    t("col_bookings"),
                    t("col_revenue"),
                    t("col_avg_price"),
                  ].map((col) => (
                    <th key={col} className="py-2 px-3 text-xs font-semibold text-charcoal-500 uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serviceRows.map((row) => (
                  <tr key={row.serviceId} className="border-b border-nude-50 hover:bg-rose-50/30">
                    <td className="py-3 px-3 font-medium text-charcoal-800">{row.serviceName}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-nude-100 text-nude-700 text-xs">
                        {row.categoryName}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-charcoal-600">{row.bookingCount}</td>
                    <td className="py-3 px-3 text-charcoal-600">{row.revenue.toLocaleString("en-SA")}</td>
                    <td className="py-3 px-3 text-charcoal-600">{row.avgPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* ---- Commission table ---- */}
      {report === "commission" && canCommission && (
        <section className="card overflow-x-auto">
          <h2 className="text-base font-semibold text-charcoal-800 mb-4">
            {t("report_commission")}
          </h2>
          {commissionRows.length === 0 ? (
            <EmptyState message={t("no_data")} />
          ) : (
            <table className="w-full text-sm text-left rtl:text-right">
              <thead>
                <tr className="border-b border-nude-100">
                  {[
                    t("col_staff"),
                    t("col_completed"),
                    t("col_revenue"),
                    t("col_commission"),
                  ].map((col) => (
                    <th key={col} className="py-2 px-3 text-xs font-semibold text-charcoal-500 uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissionRows.map((row) => (
                  <tr key={row.staffId} className="border-b border-nude-50 hover:bg-rose-50/30">
                    <td className="py-3 px-3 font-medium text-charcoal-800">{row.staffName}</td>
                    <td className="py-3 px-3 text-charcoal-600">{row.completedAppts}</td>
                    <td className="py-3 px-3 text-charcoal-600">{row.revenue.toLocaleString("en-SA")}</td>
                    <td className="py-3 px-3 font-semibold text-rose-700">
                      {row.commission.toLocaleString("en-SA")} SAR
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-charcoal-400 italic py-6 text-center">{message}</p>;
}
