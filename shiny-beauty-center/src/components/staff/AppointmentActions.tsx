/**
 * Client component: appointment status action buttons.
 * Calls the staff_transition_appointment server action.
 */
"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { transitionAppointmentStatus } from "@/lib/staff";
import type { AppointmentStatus } from "@/lib/supabase/types";

interface AppointmentActionsProps {
  appointmentId: string;
  currentStatus: AppointmentStatus;
  canConfirm: boolean;
  canCheckIn: boolean;
  canMarkNoShow: boolean;
}

type TargetStatus = "confirmed" | "checked_in" | "completed" | "no_show";

export function AppointmentActions({
  appointmentId,
  currentStatus,
  canConfirm,
  canCheckIn,
  canMarkNoShow,
}: AppointmentActionsProps) {
  const t = useTranslations("staff");
  const router = useRouter();
  const [loading, setLoading] = useState<TargetStatus | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function transition(newStatus: TargetStatus) {
    setLoading(newStatus);
    setMessage(null);

    const result = await transitionAppointmentStatus(appointmentId, newStatus);

    if (result.success) {
      setMessage({ type: "success", text: t("action_success") });
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error ?? t("action_error") });
    }

    setLoading(null);
  }

  // Determine which buttons to show based on current status
  const showConfirm = currentStatus === "pending" && canConfirm;
  const showCheckIn = currentStatus === "confirmed" && canCheckIn;
  const showComplete = currentStatus === "checked_in" && canCheckIn;
  const showNoShow =
    canMarkNoShow &&
    ["pending", "confirmed", "checked_in"].includes(currentStatus);

  const hasAnyAction = showConfirm || showCheckIn || showComplete || showNoShow;

  if (!hasAnyAction) return null;

  return (
    <div>
      <h2 className="text-base font-semibold text-charcoal-800 mb-3">{t("actions_title")}</h2>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {showConfirm && (
          <button
            onClick={() => transition("confirmed")}
            disabled={loading !== null}
            className="btn-primary"
          >
            {loading === "confirmed" ? t("confirming") : t("confirm")}
          </button>
        )}

        {showCheckIn && (
          <button
            onClick={() => transition("checked_in")}
            disabled={loading !== null}
            className="btn-primary"
          >
            {loading === "checked_in" ? t("checking_in") : t("check_in")}
          </button>
        )}

        {showComplete && (
          <button
            onClick={() => transition("completed")}
            disabled={loading !== null}
            className="btn-primary"
          >
            {loading === "completed" ? t("completing") : t("complete")}
          </button>
        )}

        {showNoShow && (
          <button
            onClick={() => transition("no_show")}
            disabled={loading !== null}
            className="btn-secondary"
          >
            {loading === "no_show" ? t("marking_no_show") : t("no_show")}
          </button>
        )}
      </div>
    </div>
  );
}
