/**
 * EmployeeEditor — renders one employee-directory row.
 * In view mode it's plain text; toggling "Edit" swaps the HR-field cells for
 * inputs (job_title / employment_type / hired_on / base_salary) and saves via
 * updateEmployeeAction. Gated on manage_employee_records by the caller —
 * pass canManage={false} to render a read-only row (no Edit control).
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { updateEmployeeAction } from "@/app/[locale]/admin/hr/actions";

export interface EmployeeEditorEmployee {
  id: string;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  employmentType: string | null;
  hiredOn: string | null; // YYYY-MM-DD
  baseSalary: number | null;
  isActive: boolean;
}

interface Props {
  locale: string;
  currency: string;
  employee: EmployeeEditorEmployee;
  canManage: boolean;
}

const EMPLOYMENT_TYPES: Array<{ value: string; label: string }> = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
];

function formatEmploymentType(value: string | null): string {
  const match = EMPLOYMENT_TYPES.find((t) => t.value === value);
  return match ? match.label : "—";
}

export function EmployeeEditor({ locale, currency, employee, canManage }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    job_title: employee.jobTitle ?? "",
    employment_type: employee.employmentType ?? "",
    hired_on: employee.hiredOn ?? "",
    base_salary: employee.baseSalary != null ? String(employee.baseSalary) : "",
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const statusBadge = (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
        employee.isActive ? "bg-green-100 text-green-700" : "bg-charcoal-100 text-charcoal-500"
      }`}
    >
      {employee.isActive ? "Active" : "Inactive"}
    </span>
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateEmployeeAction(
        employee.id,
        {
          job_title: form.job_title.trim() || null,
          employment_type: form.employment_type || null,
          hired_on: form.hired_on || null,
          base_salary: form.base_salary === "" ? null : Number(form.base_salary),
        },
        locale
      );
      if (result.error) {
        setError(result.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function cancel() {
    setForm({
      job_title: employee.jobTitle ?? "",
      employment_type: employee.employmentType ?? "",
      hired_on: employee.hiredOn ?? "",
      base_salary: employee.baseSalary != null ? String(employee.baseSalary) : "",
    });
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <tr className="border-b border-nude-50 bg-rose-50/20">
        <td className="py-3 px-4 font-medium text-charcoal-800 align-top">
          {employee.fullName}
          {employee.phone && <span className="block text-[11px] text-charcoal-400">{employee.phone}</span>}
        </td>
        <td className="py-2 px-4 align-top">
          <input
            type="text"
            value={form.job_title}
            onChange={(e) => setForm((p) => ({ ...p, job_title: e.target.value }))}
            placeholder="Job title"
            className="field-input py-1.5 text-sm"
            disabled={isPending}
          />
        </td>
        <td className="py-2 px-4 align-top">
          <select
            value={form.employment_type}
            onChange={(e) => setForm((p) => ({ ...p, employment_type: e.target.value }))}
            className="field-input py-1.5 text-sm"
            disabled={isPending}
          >
            <option value="">—</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </td>
        <td className="py-2 px-4 align-top">
          <input
            type="date"
            value={form.hired_on}
            onChange={(e) => setForm((p) => ({ ...p, hired_on: e.target.value }))}
            className="field-input py-1.5 text-sm"
            disabled={isPending}
          />
        </td>
        <td className="py-2 px-4 align-top">
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.base_salary}
            onChange={(e) => setForm((p) => ({ ...p, base_salary: e.target.value }))}
            placeholder={`0.00 ${currency}`}
            className="field-input py-1.5 text-sm"
            disabled={isPending}
          />
        </td>
        <td className="py-3 px-4 align-top">{statusBadge}</td>
        <td className="py-2 px-4 align-top">
          <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
            <button type="submit" disabled={isPending} className="btn-primary text-xs px-3 py-1.5">
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Cancel
            </button>
          </form>
          {error && <p className="text-[10px] text-red-600 mt-1">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-nude-50 hover:bg-rose-50/20">
      <td className="py-3 px-4 font-medium text-charcoal-800">
        {employee.fullName}
        {employee.phone && <span className="block text-[11px] text-charcoal-400">{employee.phone}</span>}
      </td>
      <td className="py-3 px-4 text-charcoal-600">{employee.jobTitle ?? "—"}</td>
      <td className="py-3 px-4 text-charcoal-600">{formatEmploymentType(employee.employmentType)}</td>
      <td className="py-3 px-4 text-charcoal-600 whitespace-nowrap">{employee.hiredOn ?? "—"}</td>
      <td className="py-3 px-4 text-charcoal-600 whitespace-nowrap">
        {employee.baseSalary != null ? `${employee.baseSalary.toLocaleString("en-SA")} ${currency}` : "—"}
      </td>
      <td className="py-3 px-4">{statusBadge}</td>
      <td className="py-3 px-4">
        {canManage ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-rose-600 hover:underline"
          >
            Edit
          </button>
        ) : (
          <span className="text-xs text-charcoal-300">—</span>
        )}
      </td>
    </tr>
  );
}
