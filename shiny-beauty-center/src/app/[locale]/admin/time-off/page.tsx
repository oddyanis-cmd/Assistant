/**
 * Time-Off Approval — /admin/time-off
 * Gated on manage_leave_requests permission.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getAllTimeOff } from "@/lib/metrics";
import { getTranslations } from "next-intl/server";
import { TimeOffReviewButtons } from "@/components/admin/TimeOffReviewButtons";

export const metadata: Metadata = { title: "Time-Off Approval — Admin" };

interface TimeOffPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminTimeOffPage({ params }: TimeOffPageProps) {
  const { locale } = await params;
  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/time-off`);
  }

  const t = await getTranslations("adminPortal");

  if (!can(user, PERMISSIONS.MANAGE_LEAVE_REQUESTS)) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">◐</div>
          <p className="text-charcoal-600 text-sm">{t("access_denied_body")}</p>
        </div>
      </div>
    );
  }

  const requests = await getAllTimeOff();

  const statusColors: Record<string, string> = {
    pending:  "bg-cream-100 text-cream-800 border-cream-200",
    approved: "bg-green-100 text-green-700 border-green-200",
    rejected: "bg-red-100   text-red-700   border-red-200",
  };

  const statusLabels: Record<string, string> = {
    pending:  t("status_pending"),
    approved: t("status_approved"),
    rejected: t("status_rejected"),
  };

  const pending  = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light text-charcoal-900">{t("time_off_title")}</h1>
        <p className="text-charcoal-500 text-sm mt-1">{t("time_off_subtitle")}</p>
      </div>

      {requests.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-charcoal-400 text-sm">{t("no_time_off")}</p>
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <section className="card overflow-x-auto p-0">
              <div className="px-6 py-4 border-b border-nude-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cream-400 animate-pulse"></span>
                <h2 className="text-sm font-semibold text-charcoal-700">
                  {t("status_pending")} ({pending.length})
                </h2>
              </div>
              <table className="w-full text-sm text-left rtl:text-right">
                <thead className="border-b border-nude-100">
                  <tr>
                    {[
                      t("col_staff_member"),
                      t("col_dates"),
                      t("col_reason"),
                      t("col_review"),
                    ].map((col) => (
                      <th key={col} className="py-3 px-4 text-xs font-semibold text-charcoal-500 uppercase tracking-wide">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pending.map((req) => (
                    <tr key={req.id} className="border-b border-nude-50 hover:bg-cream-50/50">
                      <td className="py-3 px-4 font-medium text-charcoal-800">{req.staffName}</td>
                      <td className="py-3 px-4 text-charcoal-600 whitespace-nowrap">
                        {req.dateFrom}
                        {req.dateTo !== req.dateFrom && ` → ${req.dateTo}`}
                      </td>
                      <td className="py-3 px-4 text-charcoal-500 max-w-xs truncate">
                        {req.reason ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        <TimeOffReviewButtons
                          id={req.id}
                          locale={locale}
                          approveLabel={t("approve")}
                          rejectLabel={t("reject")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Resolved */}
          {resolved.length > 0 && (
            <section className="card overflow-x-auto p-0">
              <div className="px-6 py-4 border-b border-nude-100">
                <h2 className="text-sm font-semibold text-charcoal-700">
                  Resolved ({resolved.length})
                </h2>
              </div>
              <table className="w-full text-sm text-left rtl:text-right">
                <thead className="border-b border-nude-100">
                  <tr>
                    {[
                      t("col_staff_member"),
                      t("col_dates"),
                      t("col_reason"),
                      t("col_status_label"),
                    ].map((col) => (
                      <th key={col} className="py-3 px-4 text-xs font-semibold text-charcoal-500 uppercase tracking-wide">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((req) => (
                    <tr key={req.id} className="border-b border-nude-50">
                      <td className="py-3 px-4 font-medium text-charcoal-700">{req.staffName}</td>
                      <td className="py-3 px-4 text-charcoal-500 whitespace-nowrap">
                        {req.dateFrom}
                        {req.dateTo !== req.dateFrom && ` → ${req.dateTo}`}
                      </td>
                      <td className="py-3 px-4 text-charcoal-400 max-w-xs truncate">
                        {req.reason ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          statusColors[req.status] ?? ""
                        }`}>
                          {statusLabels[req.status] ?? req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
