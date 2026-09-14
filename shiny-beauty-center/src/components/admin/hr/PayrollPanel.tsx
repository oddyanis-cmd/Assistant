/**
 * PayrollPanel — create a payroll run for a staff member's pay period
 * (base amount + commission − deductions) and show recent payroll. Gated on
 * manage_payroll by the caller (only rendered when the admin holds it).
 * net_amount is a DB-generated column — never sent from here.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { createPayrollAction } from "@/app/[locale]/admin/hr/actions";
import type { PayrollStatus } from "@/lib/supabase/types";

export interface PayrollStaffOption {
  id: string;
  name: string;
}

export interface PayrollListItem {
  id: string;
  staffName: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  baseAmount: number;
  commission: number;
  deductions: number;
  netAmount: number;
  currency: string;
  status: PayrollStatus;
}

interface Props {
  locale: string;
  currency: string;
  staffOptions: PayrollStaffOption[];
  recent: PayrollListItem[];
}

const STATUS_OPTIONS: Array<{ value: PayrollStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
];

const STATUS_STYLES: Record<PayrollStatus, string> = {
  draft: "bg-charcoal-100 text-charcoal-500",
  approved: "bg-blue-50 text-blue-700",
  paid: "bg-green-100 text-green-700",
};

function emptyForm(staffOptions: PayrollStaffOption[]) {
  return {
    staff_id: staffOptions[0]?.id ?? "",
    period_start: "",
    period_end: "",
    base_amount: "0",
    commission: "0",
    deductions: "0",
    status: "draft" as PayrollStatus,
  };
}

export function PayrollPanel({ locale, currency, staffOptions, recent }: Props) {
  const [form, setForm] = useState(() => emptyForm(staffOptions));
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createPayrollAction(
        {
          staff_id: form.staff_id,
          period_start: form.period_start,
          period_end: form.period_end,
          base_amount: Number(form.base_amount) || 0,
          commission: Number(form.commission) || 0,
          deductions: Number(form.deductions) || 0,
          status: form.status,
        },
        locale
      );
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: "Payroll run created." });
        setForm(emptyForm(staffOptions));
        router.refresh();
      }
    });
  }

  return (
    <div className="card space-y-6">
      <div>
        <h2 className="text-base font-semibold text-charcoal-800">Payroll</h2>
        <p className="text-charcoal-400 text-xs mt-0.5">
          Create a payroll run for a pay period. Net amount ({currency}) is calculated
          automatically as base + commission − deductions.
        </p>
      </div>

      {staffOptions.length === 0 ? (
        <p className="text-sm text-charcoal-400 italic">No active staff members yet.</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
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
            <label className="field-label">Period start</label>
            <input
              type="date"
              value={form.period_start}
              onChange={(e) => setForm((p) => ({ ...p, period_start: e.target.value }))}
              required
              className="field-input"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="field-label">Period end</label>
            <input
              type="date"
              value={form.period_end}
              min={form.period_start || undefined}
              onChange={(e) => setForm((p) => ({ ...p, period_end: e.target.value }))}
              required
              className="field-input"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="field-label">Base amount ({currency})</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.base_amount}
              onChange={(e) => setForm((p) => ({ ...p, base_amount: e.target.value }))}
              required
              className="field-input"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="field-label">Commission ({currency})</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.commission}
              onChange={(e) => setForm((p) => ({ ...p, commission: e.target.value }))}
              className="field-input"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="field-label">Deductions ({currency})</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.deductions}
              onChange={(e) => setForm((p) => ({ ...p, deductions: e.target.value }))}
              className="field-input"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as PayrollStatus }))}
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
          <div className="sm:col-span-2">
            <button type="submit" disabled={isPending} className="btn-primary text-sm">
              {isPending ? "Saving…" : "Create payroll run"}
            </button>
          </div>
          {message && (
            <p className={`sm:col-span-2 text-xs ${message.ok ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
        </form>
      )}

      {/* Recent payroll */}
      <div>
        <h3 className="text-sm font-semibold text-charcoal-700 mb-3">Recent payroll</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-charcoal-400 italic">No payroll runs yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead>
                <tr className="border-b border-nude-100">
                  {["Staff", "Period", "Base", "Commission", "Deductions", "Net", "Status"].map(
                    (col) => (
                      <th
                        key={col}
                        className="py-2 px-2 text-xs font-semibold text-charcoal-500 uppercase tracking-wide"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id} className="border-b border-nude-50">
                    <td className="py-2 px-2 font-medium text-charcoal-800">{p.staffName}</td>
                    <td className="py-2 px-2 text-charcoal-600 whitespace-nowrap">
                      {p.periodStart} → {p.periodEnd}
                    </td>
                    <td className="py-2 px-2 text-charcoal-600 whitespace-nowrap">
                      {p.baseAmount.toLocaleString("en-SA")}
                    </td>
                    <td className="py-2 px-2 text-charcoal-600 whitespace-nowrap">
                      {p.commission.toLocaleString("en-SA")}
                    </td>
                    <td className="py-2 px-2 text-charcoal-600 whitespace-nowrap">
                      {p.deductions.toLocaleString("en-SA")}
                    </td>
                    <td className="py-2 px-2 font-semibold text-rose-700 whitespace-nowrap">
                      {p.netAmount.toLocaleString("en-SA")} {p.currency}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[p.status]}`}
                      >
                        {p.status}
                      </span>
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
