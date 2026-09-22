/**
 * AttendancePanel — record daily attendance (staff + date + status, optional
 * check in/out + notes) and show the most recent entries. Gated on
 * manage_attendance by the caller (only rendered when the admin holds it).
 * Upserts on (staff_id, work_date) via recordAttendanceAction.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { recordAttendanceAction } from "@/app/[locale]/admin/hr/actions";
import type { AttendanceStatus } from "@/lib/supabase/types";

export interface AttendanceStaffOption {
  id: string;
  name: string;
}

export interface AttendanceListItem {
  id: string;
  staffId: string;
  staffName: string;
  workDate: string; // YYYY-MM-DD
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  notes: string | null;
}

interface Props {
  locale: string;
  staffOptions: AttendanceStaffOption[];
  recent: AttendanceListItem[];
}

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "Leave" },
];

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-green-100 text-green-700",
  late: "bg-cream-100 text-cream-700",
  absent: "bg-red-100 text-red-700",
  leave: "bg-blue-50 text-blue-700",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(staffOptions: AttendanceStaffOption[]) {
  return {
    staff_id: staffOptions[0]?.id ?? "",
    work_date: today(),
    status: "present" as AttendanceStatus,
    check_in: "",
    check_out: "",
    notes: "",
  };
}

function formatTime(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AttendancePanel({ locale, staffOptions, recent }: Props) {
  const [form, setForm] = useState(() => emptyForm(staffOptions));
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await recordAttendanceAction(
        {
          staff_id: form.staff_id,
          work_date: form.work_date,
          status: form.status,
          check_in: form.check_in || null,
          check_out: form.check_out || null,
          notes: form.notes.trim() || null,
        },
        locale
      );
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: "Attendance saved." });
        setForm(emptyForm(staffOptions));
        router.refresh();
      }
    });
  }

  return (
    <div className="card space-y-6">
      <div>
        <h2 className="text-base font-semibold text-charcoal-800">Attendance</h2>
        <p className="text-charcoal-400 text-xs mt-0.5">
          Record a check-in / status for a staff member. Saving again for the same staff and
          date updates that day's record.
        </p>
      </div>

      {staffOptions.length === 0 ? (
        <p className="text-sm text-charcoal-400 italic">No active staff members yet.</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Staff member</label>
            <select
              value={form.staff_id}
              onChange={(e) => setForm((p) => ({ ...p, staff_id: e.target.value }))}
              required
              className="field-input"
              disabled={isPending}
            >
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Date</label>
            <input
              type="date"
              value={form.work_date}
              onChange={(e) => setForm((p) => ({ ...p, work_date: e.target.value }))}
              required
              className="field-input"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as AttendanceStatus }))}
              className="field-input"
              disabled={isPending}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div />
          <div>
            <label className="field-label">Check-in (optional)</label>
            <input
              type="datetime-local"
              value={form.check_in}
              onChange={(e) => setForm((p) => ({ ...p, check_in: e.target.value }))}
              className="field-input"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="field-label">Check-out (optional)</label>
            <input
              type="datetime-local"
              value={form.check_out}
              onChange={(e) => setForm((p) => ({ ...p, check_out: e.target.value }))}
              className="field-input"
              disabled={isPending}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="field-input resize-none"
              disabled={isPending}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={isPending} className="btn-primary text-sm">
              {isPending ? "Saving…" : "Save attendance"}
            </button>
          </div>
          {message && (
            <p className={`sm:col-span-2 text-xs ${message.ok ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
        </form>
      )}

      {/* Recent attendance */}
      <div>
        <h3 className="text-sm font-semibold text-charcoal-700 mb-3">Recent attendance</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-charcoal-400 italic">No attendance recorded yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead>
                <tr className="border-b border-nude-100">
                  {["Staff", "Date", "Status", "Check-in", "Check-out", "Notes"].map((col) => (
                    <th
                      key={col}
                      className="py-2 px-2 text-xs font-semibold text-charcoal-500 uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-nude-50">
                    <td className="py-2 px-2 font-medium text-charcoal-800">{r.staffName}</td>
                    <td className="py-2 px-2 text-charcoal-600 whitespace-nowrap">{r.workDate}</td>
                    <td className="py-2 px-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-charcoal-500 whitespace-nowrap">
                      {formatTime(r.checkIn, locale)}
                    </td>
                    <td className="py-2 px-2 text-charcoal-500 whitespace-nowrap">
                      {formatTime(r.checkOut, locale)}
                    </td>
                    <td className="py-2 px-2 text-charcoal-400 max-w-[12rem] truncate">
                      {r.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
