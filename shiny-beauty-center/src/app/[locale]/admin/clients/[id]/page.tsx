/**
 * Client detail — /admin/clients/[id]
 * Gated on view_client_details.
 * Shows profile + appointment history + staff notes.
 * Edit form gated on edit_client.
 * Add note gated on manage_client_notes.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getClientHistory, getClientNotes } from "@/lib/staff";
import type { Client, AppointmentStatus } from "@/lib/supabase/types";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ClientEditForm } from "@/components/admin/ClientEditForm";
import { AdminClientNoteForm } from "@/components/admin/AdminClientNoteForm";

export const metadata: Metadata = { title: "Client Profile — Admin" };

interface ClientDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  pending:    "bg-cream-100 text-cream-700",
  confirmed:  "bg-blue-50 text-blue-700",
  checked_in: "bg-rose-100 text-rose-700",
  completed:  "bg-green-50 text-green-700",
  cancelled:  "bg-charcoal-100 text-charcoal-500",
  no_show:    "bg-nude-100 text-nude-600",
};

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { locale, id } = await params;
  const t = await getTranslations("adminPortal");

  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/clients/${id}`);
  }

  if (!can(user, PERMISSIONS.VIEW_CLIENT_DETAILS)) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">◌</div>
          <p className="text-charcoal-600 text-sm">{t("access_denied_body")}</p>
        </div>
      </div>
    );
  }

  const canEdit        = can(user, PERMISSIONS.EDIT_CLIENT);
  const canViewHistory = can(user, PERMISSIONS.VIEW_CLIENT_HISTORY);
  const canManageNotes = can(user, PERMISSIONS.MANAGE_CLIENT_NOTES);

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return (
      <div className="space-y-4">
        <Link href={`/${locale}/admin/clients` as "/"} className="text-sm text-charcoal-500 hover:text-rose-600">
          ‹ {t("client_back")}
        </Link>
        <div className="card text-center py-12 text-charcoal-400 text-sm">
          {t("client_not_found")}
        </div>
      </div>
    );
  }

  const { data: clientRow } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!clientRow) notFound();
  const client = clientRow as Client;

  const [history, staffNotes] = await Promise.all([
    canViewHistory ? getClientHistory(client.id) : Promise.resolve([]),
    canManageNotes ? getClientNotes(client.id)   : Promise.resolve([]),
  ]);

  const editLabels = {
    edit_title:  t("client_edit_title"),
    save:        t("client_save"),
    saving:      t("client_saving"),
    saved:       t("client_saved"),
    cancel:      t("svc_cancel"),
    col_name:    t("col_name"),
    col_phone:   t("col_phone"),
    col_email:   t("col_email"),
    dob:         t("client_dob"),
    notes_field: t("client_notes_field"),
    active:      t("active"),
    error:       t("svc_error"),
  };

  const noteLabels = {
    add_note:       t("client_add_note"),
    adding_note:    t("client_adding_note"),
    note_added:     t("client_note_added"),
    note_placeholder: t("client_note_placeholder"),
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/admin/clients" className="text-sm text-charcoal-500 hover:text-rose-600 flex items-center gap-1">
        ‹ {t("client_back")}
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light text-charcoal-900">{client.full_name}</h1>
          <p className="text-charcoal-500 text-sm mt-0.5">{t("client_detail_subtitle")}</p>
        </div>
        <span
          className={`text-xs px-3 py-1 rounded-full font-medium ${
            client.is_active ? "bg-green-100 text-green-700" : "bg-charcoal-100 text-charcoal-500"
          }`}
        >
          {client.is_active ? t("active") : t("inactive")}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card">
            <h2 className="text-sm font-semibold text-charcoal-700 mb-4">{t("client_profile_section")}</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex gap-3">
                <dt className="text-charcoal-500 w-24 shrink-0">{t("col_phone")}</dt>
                <dd className="text-charcoal-800 font-medium">{client.phone ?? "—"}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-charcoal-500 w-24 shrink-0">{t("col_email")}</dt>
                <dd className="text-charcoal-800 break-all">{client.email ?? "—"}</dd>
              </div>
              {client.date_of_birth && (
                <div className="flex gap-3">
                  <dt className="text-charcoal-500 w-24 shrink-0">{t("client_dob")}</dt>
                  <dd className="text-charcoal-800">{client.date_of_birth.slice(0, 10)}</dd>
                </div>
              )}
              <div className="flex gap-3">
                <dt className="text-charcoal-500 w-24 shrink-0">{t("col_joined")}</dt>
                <dd className="text-charcoal-400 text-xs">{client.created_at.slice(0, 10)}</dd>
              </div>
              {client.notes && (
                <div className="pt-3 border-t border-nude-100">
                  <p className="text-xs text-charcoal-500 uppercase tracking-wide mb-1">
                    {t("client_notes_field")}
                  </p>
                  <p className="text-sm text-charcoal-700 leading-relaxed">{client.notes}</p>
                </div>
              )}
            </dl>

            {/* Edit form (conditionally shown) */}
            {canEdit && (
              <ClientEditForm
                clientId={client.id}
                locale={locale}
                initial={{
                  full_name:     client.full_name,
                  phone:         client.phone    ?? "",
                  email:         client.email    ?? "",
                  date_of_birth: client.date_of_birth?.slice(0, 10) ?? "",
                  notes:         client.notes    ?? "",
                  is_active:     client.is_active,
                }}
                labels={editLabels}
              />
            )}
          </div>
        </div>

        {/* Right: history + notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appointment history */}
          {canViewHistory && (
            <div className="card">
              <h2 className="text-base font-semibold text-charcoal-800 mb-4">
                {t("client_history_section")}
              </h2>
              {history.length === 0 ? (
                <p className="text-sm text-charcoal-400 italic">{t("client_no_history")}</p>
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
                        className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                          STATUS_STYLES[visit.status as AppointmentStatus]
                        }`}
                      >
                        {visit.status.replace("_", " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Staff notes */}
          {canManageNotes && (
            <div className="card">
              <h2 className="text-base font-semibold text-charcoal-800 mb-4">
                {t("client_notes_section")}
              </h2>
              {staffNotes.length === 0 ? (
                <p className="text-sm text-charcoal-400 italic">{t("client_no_notes")}</p>
              ) : (
                <ul className="space-y-3 mb-4">
                  {staffNotes.map((n) => (
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
              <AdminClientNoteForm clientId={client.id} labels={noteLabels} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
