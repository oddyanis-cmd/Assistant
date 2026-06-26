/**
 * Staff Schedule — Day View
 * Displays the signed-in staff member's appointments for a selected day.
 * Navigable with prev/next day + today. Each appointment links to detail.
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getStaffScheduleForDay } from "@/lib/staff";
import { Link } from "@/i18n/navigation";
import { AppointmentStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "My Schedule — Staff" };

interface SchedulePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
}

function formatDateParam(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function shiftDay(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return formatDateParam(d);
}

function formatDisplayDate(date: string, locale: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  pending: "bg-cream-100 text-cream-700",
  confirmed: "bg-blue-50 text-blue-700",
  checked_in: "bg-rose-100 text-rose-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-charcoal-100 text-charcoal-500",
  no_show: "bg-nude-100 text-nude-600",
};

const STATUS_DOTS: Record<AppointmentStatus, string> = {
  pending: "bg-cream-400",
  confirmed: "bg-blue-400",
  checked_in: "bg-rose-400",
  completed: "bg-green-400",
  cancelled: "bg-charcoal-300",
  no_show: "bg-nude-400",
};

export default async function SchedulePage({ params, searchParams }: SchedulePageProps) {
  const { locale } = await params;
  const { date: dateParam } = await searchParams;

  const today = formatDateParam(new Date());
  const selectedDate = dateParam ?? today;
  const isToday = selectedDate === today;

  const prevDate = shiftDay(selectedDate, -1);
  const nextDate = shiftDay(selectedDate, +1);

  const appointments = await getStaffScheduleForDay(selectedDate);
  const t = await getTranslations("staff");

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-light text-charcoal-900">{t("schedule_title")}</h1>
        <p className="text-charcoal-500 text-sm mt-1">
          {t("schedule_subtitle")}{" "}
          <span className="font-medium text-charcoal-700">
            {formatDisplayDate(selectedDate, locale)}
          </span>
        </p>
      </div>

      {/* Day navigation */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href={`/staff/schedule?date=${prevDate}` as "/"}
          className="btn-ghost text-sm px-3 py-2"
          aria-label={t("prev_day")}
        >
          ‹
        </Link>

        <div className="flex-1 text-center">
          <div className="inline-flex items-center gap-2 bg-white rounded-xl px-4 py-2 border border-nude-200 shadow-sm">
            <span className="text-sm font-medium text-charcoal-700">
              {formatDisplayDate(selectedDate, locale)}
            </span>
            {isToday && (
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                {t("today")}
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/staff/schedule?date=${nextDate}` as "/"}
          className="btn-ghost text-sm px-3 py-2"
          aria-label={t("next_day")}
        >
          ›
        </Link>
      </div>

      {/* Today shortcut */}
      {!isToday && (
        <div className="flex justify-center mb-4">
          <Link href="/staff/schedule" className="text-sm text-rose-600 hover:text-rose-700 underline-offset-2 hover:underline">
            ← {t("today")}
          </Link>
        </div>
      )}

      {/* Appointment list */}
      {appointments.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4 text-nude-300">◎</div>
          <p className="text-charcoal-500 text-sm">{t("no_appointments")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const status = appt.status as AppointmentStatus;
            return (
              <Link
                key={appt.id}
                href={`/staff/appointment/${appt.id}` as "/"}
                className="block card hover:shadow-md transition-all duration-200 hover:border-rose-200 group"
              >
                <div className="flex items-start gap-4">
                  {/* Time column */}
                  <div className="flex-shrink-0 w-20 text-center">
                    <div className="text-sm font-semibold text-charcoal-800">
                      {formatTime(appt.start_at, locale)}
                    </div>
                    <div className="text-xs text-charcoal-400 mt-0.5">
                      {formatTime(appt.end_at, locale)}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 ${STATUS_DOTS[status]}`} />
                    <div className="w-px flex-1 bg-nude-200" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-charcoal-800 group-hover:text-rose-700 transition-colors">
                          {locale === "ar" ? appt.service_name_ar : appt.service_name_en}
                        </p>
                        <p className="text-sm text-charcoal-500 mt-0.5">
                          {appt.client_name}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[status]}`}>
                          {status.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    {appt.notes && (
                      <p className="text-xs text-charcoal-400 mt-2 line-clamp-1 italic">
                        {appt.notes}
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0 text-charcoal-300 group-hover:text-rose-400 transition-colors self-center">
                    ›
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {appointments.length > 0 && (
        <div className="mt-4 text-center text-xs text-charcoal-400">
          {appointments.length} appointment{appointments.length !== 1 ? "s" : ""} scheduled
        </div>
      )}
    </div>
  );
}
