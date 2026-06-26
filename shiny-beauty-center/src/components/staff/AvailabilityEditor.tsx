/**
 * Client component: interactive weekly hours editor + time-off form.
 */
"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { upsertAvailability, requestTimeOff } from "@/lib/staff";
import type { StaffAvailability } from "@/lib/supabase/types";

interface DayRow {
  dow: number; // 0=Sun … 6=Sat
  label: string;
  availability: StaffAvailability | undefined;
}

interface AvailabilityEditorProps {
  rows: DayRow[];
  canEdit: boolean;
}

// ---- Working Hours -------------------------------------------------------

export function WorkingHoursEditor({ rows, canEdit }: AvailabilityEditorProps) {
  const t = useTranslations("staff");
  const router = useRouter();

  // Local state: one entry per day-of-week
  type DayState = {
    isAvailable: boolean;
    startTime: string;
    endTime: string;
  };

  const initial: Record<number, DayState> = {};
  for (const row of rows) {
    initial[row.dow] = {
      isAvailable: row.availability?.is_available ?? false,
      startTime: row.availability?.start_time ?? "09:00",
      endTime: row.availability?.end_time ?? "17:00",
    };
  }

  const [days, setDays] = useState(initial);
  const [saving, setSaving] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, { type: "success" | "error"; text: string }>>({});

  function setDayField(dow: number, field: keyof DayState, value: string | boolean) {
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], [field]: value } }));
  }

  async function saveDayRow(dow: number) {
    if (!canEdit) return;
    setSaving(dow);
    setMessages((prev) => {
      const next = { ...prev };
      delete next[dow];
      return next;
    });

    const d = days[dow];
    const result = await upsertAvailability(dow, d.startTime, d.endTime, d.isAvailable);

    setSaving(null);
    if (result.success) {
      setMessages((prev) => ({ ...prev, [dow]: { type: "success", text: t("hours_saved") } }));
      router.refresh();
    } else {
      setMessages((prev) => ({
        ...prev,
        [dow]: { type: "error", text: result.error ?? "Failed to save." },
      }));
    }
  }

  return (
    <div className="card">
      <h2 className="text-base font-semibold text-charcoal-800 mb-4">{t("working_hours")}</h2>

      <div className="space-y-3">
        {rows.map((row) => {
          const d = days[row.dow];
          const msg = messages[row.dow];
          const isSaving = saving === row.dow;

          return (
            <div key={row.dow} className="rounded-xl border border-nude-100 p-4 bg-nude-50/50">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={d.isAvailable}
                    onChange={(e) => setDayField(row.dow, "isAvailable", e.target.checked)}
                    disabled={!canEdit}
                    className="w-4 h-4 accent-rose-500"
                  />
                  <span className="text-sm font-medium text-charcoal-700 w-24">{row.label}</span>
                </label>

                {d.isAvailable ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-charcoal-500">{t("start")}</span>
                      <input
                        type="time"
                        value={d.startTime}
                        onChange={(e) => setDayField(row.dow, "startTime", e.target.value)}
                        disabled={!canEdit}
                        className="field-input w-28 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-charcoal-500">{t("end")}</span>
                      <input
                        type="time"
                        value={d.endTime}
                        onChange={(e) => setDayField(row.dow, "endTime", e.target.value)}
                        disabled={!canEdit}
                        className="field-input w-28 py-1.5 text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-charcoal-400 italic">{t("day_off")}</span>
                )}

                {canEdit && (
                  <button
                    onClick={() => saveDayRow(row.dow)}
                    disabled={isSaving}
                    className="btn-secondary text-xs px-3 py-1.5 ms-auto"
                  >
                    {isSaving ? t("saving_hours") : t("save_hours")}
                  </button>
                )}
              </div>

              {msg && (
                <div
                  className={`mt-2 text-xs font-medium px-3 py-1.5 rounded-lg ${
                    msg.type === "success"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {msg.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Time Off Form -------------------------------------------------------

export function TimeOffForm() {
  const t = useTranslations("staff");
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await requestTimeOff(dateFrom, dateTo, reason.trim() || null);

    if (result.success) {
      setMessage({ type: "success", text: t("request_submitted") });
      setReason("");
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to submit." });
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2 className="text-base font-semibold text-charcoal-800 mb-1">{t("request_time_off")}</h2>
      <p className="text-xs text-charcoal-400 mb-4">{t("time_off_subtitle")}</p>

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

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="field-label">{t("from_date")}</label>
          <input
            type="date"
            value={dateFrom}
            min={today}
            onChange={(e) => setDateFrom(e.target.value)}
            required
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">{t("to_date")}</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => setDateTo(e.target.value)}
            required
            className="field-input"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="field-label">{t("reason_label")}</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("reason_placeholder")}
          rows={3}
          className="field-input resize-none"
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? t("submitting") : t("submit_request")}
      </button>
    </form>
  );
}
