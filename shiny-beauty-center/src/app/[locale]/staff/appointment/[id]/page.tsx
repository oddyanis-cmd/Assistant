/**
 * Appointment detail page with status action buttons, client history, and notes.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import {
  getStaffAppointmentDetail,
  getClientHistory,
  getClientNotes,
} from "@/lib/staff";
import { AppointmentActions } from "@/components/staff/AppointmentActions";
import { AddClientNoteForm } from "@/components/staff/AddClientNoteForm";
import { Link } from "@/i18n/navigation";
import type { AppointmentStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Appointment — Staff" };

interface AppointmentDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  pending: "bg-cream-100 text-cream-700",
  confirmed: "bg-blue-50 text-blue-700",
  checked_in: "bg-rose-100 text-rose-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-charcoal-100 text-charcoal-500",
  no_show: "bg-nude-100 text-nude-600",
};

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AppointmentDetailPage({ params }: AppointmentDetailPageProps) {
  const { locale, id } = await params;
  const t = await getTranslations("staff");

  const [user, appt] = await Promise.all([
    getCurrentUserWithPermissions(),
    getStaffAppointmentDetail(id),
  ]);

  if (!appt) notFound();

  const canConfirm = can(user, PERMISSIONS.CONFIRM_BOOKING);
  const canCheckIn = can(user, PERMISSIONS.CHECK_IN_CLIENT);
  const canMarkNoShow = can(user, PERMISSIONS.MARK_NO_SHOW);
  const canViewHistory = can(user, PERMISSIONS.VIEW_CLIENT_HISTORY);
  const canManageNotes = can(user, PERMISSIONS.MANAGE_CLIENT_NOTES);

  const [history, privateNotes] = await Promise.all([
    canViewHistory ? getClientHistory(appt.client_id) : Promise.resolve([]),
    canManageNotes ? getClientNotes(appt.client_id) : Promise.resolve([]),
  ]);

  // Find today's date for the back link
  const apptDate = appt.start_at.slice(0, 10);
  const status = appt.status as AppointmentStatus;

  return (
    <div>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={`/staff/schedule?date=${apptDate}` as "/"}
          className="text-sm text-charcoal-500 hover:text-rose-600 flex items-center gap-1"
        >
          ‹ {t("back_to_schedule")}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main detail */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appointment info card */}
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-xl font-semibold text-charcoal-900">
                {locale === "ar" ? appt.service_name_ar : appt.service_name_en}
              </h1>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${STATUS_STYLES[status]}`}>
                {status.replace("_", " ")}
              </span>
            </div>

            <dl className="space-y-3">
              <div className="flex gap-4">
                <dt className="text-sm text-charcoal-500 w-24 flex-shrink-0">{t("start_time")}</dt>
                <dd className="text-sm font-medium text-charcoal-800">
                  {formatDateTime(appt.start_at, locale)}
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-sm text-charcoal-500 w-24 flex-shrink-0">Ends</dt>
                <dd className="text-sm text-charcoal-600">
                  {formatDateTime(appt.end_at, locale)}
                </dd>
              </div>
              {appt.notes && (
                <div className="flex gap-4">
                  <dt className="text-sm text-charcoal-500 w-24 flex-shrink-0">Notes</dt>
                  <dd className="text-sm text-charcoal-600 italic">{appt.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Status actions */}
          <div className="card">
            <AppointmentActions
              appointmentId={appt.id}
              currentStatus={status}
              canConfirm={canConfirm}
              canCheckIn={canCheckIn}
              canMarkNoShow={canMarkNoShow}
            />
          </div>

          {/* Client visit history */}
          {canViewHistory && (
            <div className="card">
              <h2 className="text-base font-semibold text-charcoal-800 mb-4">
                {t("client_history")}
              </h2>
              {history.length === 0 ? (
                <p className="text-sm text-charcoal-400 italic">{t("no_history")}</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((visit) => (
                    <li
                      key={visit.id}
                      className="flex items-center justify-between py-2 border-b border-nude-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-charcoal-700">
                          {locale === "ar" ? visit.service_name_ar : visit.service_name_en}
                        </p>
                        <p className="text-xs text-charcoal-400">
                          {formatDate(visit.start_at, locale)}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[visit.status as AppointmentStatus]}`}
                      >
                        {visit.status.replace("_", " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: client info + private notes */}
        <div className="space-y-6">
          {/* Client info */}
          <div className="card">
            <h2 className="text-base font-semibold text-charcoal-800 mb-4">
              {t("client_section")}
            </h2>
            <div className="space-y-2">
              <p className="font-semibold text-charcoal-800">{appt.client_name}</p>
              {appt.client_phone && (
                <p className="text-sm text-charcoal-500">{appt.client_phone}</p>
              )}
              {appt.client_notes && (
                <div className="mt-3 pt-3 border-t border-nude-100">
                  <p className="text-xs font-medium text-charcoal-500 uppercase tracking-wider mb-1">
                    {t("client_notes_label")}
                  </p>
                  <p className="text-sm text-charcoal-700 leading-relaxed">
                    {appt.client_notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Private staff notes */}
          {canManageNotes && (
            <div className="card">
              <h2 className="text-base font-semibold text-charcoal-800 mb-4">
                {t("private_note_label")}
              </h2>

              {/* Existing notes */}
              {privateNotes.length > 0 && (
                <ul className="space-y-3 mb-4">
                  {privateNotes.map((n) => (
                    <li key={n.id} className="bg-nude-50 rounded-xl p-3">
                      <p className="text-sm text-charcoal-700 leading-relaxed">{n.note}</p>
                      <p className="text-xs text-charcoal-400 mt-1">
                        {n.staff_name ?? "Staff"} ·{" "}
                        {new Date(n.created_at).toLocaleDateString(
                          locale === "ar" ? "ar-SA" : "en-GB"
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <AddClientNoteForm clientId={appt.client_id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
