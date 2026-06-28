/**
 * All-Staff Calendar — /admin/calendar
 * Gated on view_all_bookings permission.
 * Shows a week view across all staff members.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getAllBookings, type CalendarBooking } from "@/lib/metrics";
import { CURRENCY } from "@/lib/config";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = { title: "All-Staff Calendar — Admin" };

interface CalendarPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; view?: string }>;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function startOfWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return toDateStr(d);
}

export default async function AdminCalendarPage({
  params,
  searchParams,
}: CalendarPageProps) {
  const { locale } = await params;
  const { from: rawFrom, view: rawView } = await searchParams;
  const view = rawView === "day" ? "day" : "week";

  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/calendar`);
  }

  const t = await getTranslations("adminPortal");

  if (!can(user, PERMISSIONS.VIEW_ALL_BOOKINGS)) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">◷</div>
          <p className="text-charcoal-600 text-sm">{t("access_denied_body")}</p>
        </div>
      </div>
    );
  }

  const today = toDateStr(new Date());
  const baseDate = rawFrom ?? today;
  const weekStart = view === "week" ? startOfWeek(baseDate) : baseDate;
  const fromDate  = weekStart;
  const toDate    = view === "week" ? addDays(weekStart, 6) : weekStart;

  const prevDate  = view === "week" ? addDays(weekStart, -7) : addDays(weekStart, -1);
  const nextDate  = view === "week" ? addDays(weekStart, 7)  : addDays(weekStart, 1);

  const bookings = await getAllBookings(fromDate, toDate);

  // Collect all days in range
  const days: string[] = [];
  let cur = fromDate;
  while (cur <= toDate) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  // Collect staff list
  const staffSet = new Set<string>();
  for (const b of bookings) {
    staffSet.add(b.staffName ?? "Unassigned");
  }
  const staffList = Array.from(staffSet).sort();

  // Group bookings by day
  const byDay = new Map<string, CalendarBooking[]>();
  for (const day of days) {
    byDay.set(day, bookings.filter((b) => b.startAt.slice(0, 10) === day));
  }

  const statusColors: Record<string, string> = {
    confirmed:  "bg-rose-100 border-rose-300 text-rose-800",
    pending:    "bg-cream-100 border-cream-300 text-cream-800",
    checked_in: "bg-green-100 border-green-300 text-green-800",
    completed:  "bg-nude-100 border-nude-300 text-nude-800",
    cancelled:  "bg-charcoal-100 border-charcoal-300 text-charcoal-500 line-through",
    no_show:    "bg-red-50 border-red-200 text-red-600",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-charcoal-900">{t("calendar_title")}</h1>
          <p className="text-charcoal-500 text-sm mt-1">{t("calendar_subtitle")}</p>
        </div>

        {/* View switcher */}
        <div className="flex gap-1 bg-white/80 rounded-xl p-1 border border-nude-200 self-start">
          {(["week", "day"] as const).map((v) => (
            <a
              key={v}
              href={`?from=${weekStart}&view=${v}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                view === v ? "bg-rose-500 text-white" : "text-charcoal-600 hover:bg-rose-50"
              }`}
            >
              {v === "week" ? t("view_week") : t("view_day")}
            </a>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <a
          href={`?from=${prevDate}&view=${view}`}
          className="btn-secondary text-sm px-4 py-2"
        >
          {t("prev")}
        </a>
        <span className="text-sm font-medium text-charcoal-700 min-w-32 text-center">
          {view === "week"
            ? `${fromDate} – ${toDate}`
            : fromDate}
        </span>
        <a
          href={`?from=${nextDate}&view=${view}`}
          className="btn-secondary text-sm px-4 py-2"
        >
          {t("next")}
        </a>
        <a
          href={`?from=${today}&view=${view}`}
          className="btn-ghost text-sm"
        >
          Today
        </a>
      </div>

      {bookings.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-charcoal-400 text-sm">{t("no_bookings")}</p>
        </div>
      ) : view === "week" ? (
        /* ---- Week grid ---- */
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm border-collapse" style={{ minWidth: 640 }}>
            <thead>
              <tr className="border-b border-nude-100">
                <th className="py-3 px-4 text-left text-xs font-semibold text-charcoal-500 uppercase w-24">
                  {t("col_staff")}
                </th>
                {days.map((day) => {
                  const d = new Date(day + "T12:00:00");
                  const label = d.toLocaleDateString("en-SA", { weekday: "short", month: "short", day: "numeric" });
                  const isToday = day === today;
                  return (
                    <th
                      key={day}
                      className={`py-3 px-2 text-center text-xs font-medium ${
                        isToday ? "text-rose-600 bg-rose-50" : "text-charcoal-500"
                      }`}
                    >
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staffList.map((staffName) => (
                <tr key={staffName} className="border-b border-nude-50">
                  <td className="py-3 px-4 font-medium text-charcoal-700 text-xs align-top">
                    {staffName}
                  </td>
                  {days.map((day) => {
                    const dayBookings = (byDay.get(day) ?? []).filter(
                      (b) => (b.staffName ?? "Unassigned") === staffName
                    );
                    return (
                      <td key={day} className="py-2 px-1 align-top">
                        <div className="space-y-1">
                          {dayBookings.map((b) => (
                            <div
                              key={b.id}
                              className={`rounded-lg border px-2 py-1 text-[10px] leading-tight ${
                                statusColors[b.status] ?? "bg-nude-50 border-nude-200 text-nude-800"
                              }`}
                            >
                              <p className="font-semibold truncate">
                                {b.startAt.slice(11, 16)} {b.serviceName}
                              </p>
                              <p className="text-[9px] opacity-75 truncate">{b.clientName}</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ---- Day list ---- */
        <div className="space-y-3">
          {(byDay.get(fromDate) ?? []).map((b) => (
            <div
              key={b.id}
              className={`card flex items-start gap-4 p-4 border ${
                statusColors[b.status] ?? "border-nude-100"
              }`}
            >
              <div
                className="w-1 self-stretch rounded-full shrink-0"
                style={{ backgroundColor: b.colorHex ?? "#fda4af" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-charcoal-800">
                    {b.startAt.slice(11, 16)} – {b.endAt.slice(11, 16)}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    statusColors[b.status] ?? ""
                  }`}>
                    {b.status}
                  </span>
                </div>
                <p className="text-sm text-charcoal-700">{b.serviceName}</p>
                <p className="text-xs text-charcoal-500 mt-0.5">
                  {b.clientName} · {b.staffName ?? "Unassigned"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-charcoal-700">{b.price.toLocaleString("en-SA")} {CURRENCY}</p>
              </div>
            </div>
          ))}
          {(byDay.get(fromDate) ?? []).length === 0 && (
            <div className="card text-center py-12">
              <p className="text-charcoal-400 text-sm">{t("no_bookings")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
