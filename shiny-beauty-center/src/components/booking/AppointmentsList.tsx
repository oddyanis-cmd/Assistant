"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import type { AppointmentWithDetails } from "@/lib/appointments";
import { cancelAppointment } from "@/lib/appointments";
import type { AppointmentStatus } from "@/lib/supabase/types";

interface AppointmentsListProps {
  upcoming: AppointmentWithDetails[];
  past: AppointmentWithDetails[];
  locale: string;
}

function statusBadge(status: AppointmentStatus, t: ReturnType<typeof useTranslations>) {
  const map: Record<AppointmentStatus, { label: string; cls: string }> = {
    confirmed:  { label: t("status_confirmed"),  cls: "bg-green-100 text-green-700" },
    pending:    { label: t("status_pending"),    cls: "bg-yellow-100 text-yellow-700" },
    completed:  { label: t("status_completed"),  cls: "bg-charcoal-100 text-charcoal-600" },
    cancelled:  { label: t("status_cancelled"),  cls: "bg-rose-100 text-rose-600" },
    checked_in: { label: t("status_checked_in"), cls: "bg-blue-100 text-blue-700" },
    no_show:    { label: t("status_no_show"),    cls: "bg-orange-100 text-orange-700" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-nude-100 text-charcoal-500" };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-SA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-SA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return { date, time };
}

function AppointmentCard({
  appt,
  canCancel,
}: {
  appt: AppointmentWithDetails;
  canCancel?: boolean;
}) {
  const t = useTranslations("appointments");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelled, setCancelled] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { date, time } = formatDateTime(appt.start_at);

  function handleCancel() {
    if (!confirm(t("cancel_confirm"))) return;
    setErr(null);
    startTransition(async () => {
      const result = await cancelAppointment(appt.id);
      if (result.success) {
        setCancelled(true);
        router.refresh();
      } else {
        setErr(result.error ?? "Error");
      }
    });
  }

  if (cancelled) {
    return (
      <div className="bg-white border border-nude-100 rounded-2xl p-4 opacity-50">
        <p className="text-sm text-charcoal-400">{t("cancelled_success")}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-nude-100 rounded-2xl p-4 shadow-sm">
      {/* Service + status */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-charcoal-900 text-sm leading-snug me-2">
          {appt.service_name}
        </h3>
        {statusBadge(appt.status, t)}
      </div>

      {/* Meta */}
      <div className="space-y-1 mb-4">
        <MetaRow icon="👤" value={appt.staff_name ?? t("no_preference")} />
        <MetaRow icon="📅" value={`${date} — ${time}`} />
        {appt.public_token && (
          <MetaRow
            icon="🔖"
            value={`${t("ref_label")}: ${appt.public_token.toUpperCase()}`}
            mono
          />
        )}
      </div>

      {err && (
        <p className="text-xs text-rose-600 mb-3">{err}</p>
      )}

      {/* Actions — only for upcoming confirmed/pending */}
      {canCancel && (
        <div className="flex gap-2">
          <Link
            href={`/book?serviceId=${appt.service_id}`}
            className="btn-secondary text-xs px-3 py-1.5 flex-1"
          >
            {t("reschedule")}
          </Link>
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-full border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors flex-1 disabled:opacity-50"
          >
            {isPending ? t("cancelling") : t("cancel")}
          </button>
        </div>
      )}
    </div>
  );
}

function MetaRow({
  icon,
  value,
  mono,
}: {
  icon: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-charcoal-500">
      <span aria-hidden="true">{icon}</span>
      <span className={mono ? "font-mono tracking-wide" : ""}>{value}</span>
    </div>
  );
}

export function AppointmentsList({
  upcoming,
  past,
  locale: _locale,
}: AppointmentsListProps) {
  const t = useTranslations("appointments");
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const items = tab === "upcoming" ? upcoming : past;

  return (
    <div>
      {/* Tabs */}
      <div className="flex bg-nude-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setTab("upcoming")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "upcoming"
              ? "bg-white text-rose-600 shadow-sm"
              : "text-charcoal-500"
          }`}
        >
          {t("upcoming")}
          {upcoming.length > 0 && (
            <span className="ms-1.5 bg-rose-100 text-rose-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              {upcoming.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("past")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "past"
              ? "bg-white text-charcoal-700 shadow-sm"
              : "text-charcoal-500"
          }`}
        >
          {t("past")}
        </button>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-charcoal-400">
          <div className="text-4xl mb-4">📅</div>
          <p className="text-sm mb-6">
            {tab === "upcoming" ? t("empty_upcoming") : t("empty_past")}
          </p>
          {tab === "upcoming" && (
            <Link href="/services" className="btn-primary">
              {t("book_cta")}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              canCancel={
                tab === "upcoming" &&
                (appt.status === "confirmed" || appt.status === "pending")
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
