/**
 * Staff Availability — weekly working hours + time-off requests.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getMyAvailability, getMyTimeOffRequests } from "@/lib/staff";
import { WorkingHoursEditor, TimeOffForm } from "@/components/staff/AvailabilityEditor";
import type { StaffAvailability, TimeOffStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "My Availability — Staff" };

interface AvailabilityPageProps {
  params: Promise<{ locale: string }>;
}

const TIME_OFF_BADGE: Record<TimeOffStatus, string> = {
  pending: "bg-cream-100 text-cream-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

export default async function AvailabilityPage({ params }: AvailabilityPageProps) {
  const { locale } = await params;
  const t = await getTranslations("staff");

  const user = await getCurrentUserWithPermissions();
  if (!user) redirect(`/${locale}/auth/signin`);

  const canEdit =
    can(user, PERMISSIONS.MANAGE_STAFF_AVAILABILITY) ||
    can(user, PERMISSIONS.EDIT_STAFF_SCHEDULE);

  const [availability, timeOffRequests] = await Promise.all([
    getMyAvailability(),
    getMyTimeOffRequests(),
  ]);

  // Build display labels for all 7 days
  const dayLabels: Record<number, string> = {
    0: t("days.0"),
    1: t("days.1"),
    2: t("days.2"),
    3: t("days.3"),
    4: t("days.4"),
    5: t("days.5"),
    6: t("days.6"),
  };

  const availabilityMap: Record<number, StaffAvailability> = {};
  for (const row of availability) {
    availabilityMap[row.day_of_week] = row;
  }

  const rows = [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
    dow,
    label: dayLabels[dow],
    availability: availabilityMap[dow],
  }));

  function formatDateRange(from: string, to: string): string {
    const f = new Date(`${from}T12:00:00Z`).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-GB",
      { day: "numeric", month: "short", year: "numeric" }
    );
    if (from === to) return f;
    const t2 = new Date(`${to}T12:00:00Z`).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-GB",
      { day: "numeric", month: "short", year: "numeric" }
    );
    return `${f} – ${t2}`;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-light text-charcoal-900">{t("availability_title")}</h1>
        <p className="text-charcoal-500 text-sm mt-1">{t("availability_subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Working hours editor */}
        <div className="lg:col-span-2">
          <WorkingHoursEditor rows={rows} canEdit={canEdit} />
        </div>

        {/* Time off sidebar */}
        <div className="space-y-6">
          <TimeOffForm />

          {/* Existing requests */}
          <div className="card">
            <h2 className="text-base font-semibold text-charcoal-800 mb-4">
              {t("time_off_title")}
            </h2>

            {timeOffRequests.length === 0 ? (
              <p className="text-sm text-charcoal-400 italic">{t("no_time_off")}</p>
            ) : (
              <ul className="space-y-3">
                {timeOffRequests.map((req) => (
                  <li
                    key={req.id}
                    className="rounded-xl border border-nude-100 p-3 bg-nude-50/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-charcoal-700">
                          {formatDateRange(req.date_from, req.date_to)}
                        </p>
                        {req.reason && (
                          <p className="text-xs text-charcoal-500 mt-0.5 italic">
                            {req.reason}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${TIME_OFF_BADGE[req.status as TimeOffStatus]}`}
                      >
                        {req.status === "pending"
                          ? t("status_pending")
                          : req.status === "approved"
                          ? t("status_approved")
                          : t("status_rejected")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
