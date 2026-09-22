/**
 * Server actions for the HR section — employee records, attendance, payroll.
 * Each action re-checks the caller's permission via has_permission before
 * mutating. Guards against unconfigured Supabase — returns { error } instead
 * of crashing. Mirrors src/app/[locale]/admin/services/actions.ts.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, CURRENCY } from "@/lib/config";
import type { AttendanceStatus, PayrollStatus } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmployeeFormData {
  job_title: string | null;
  employment_type: string | null;
  hired_on: string | null; // YYYY-MM-DD
  base_salary: number | null;
}

export interface AttendanceFormData {
  staff_id: string;
  work_date: string; // YYYY-MM-DD
  check_in?: string | null; // datetime-local value, e.g. 2026-09-13T09:00
  check_out?: string | null;
  status: AttendanceStatus;
  notes?: string | null;
}

export interface PayrollFormData {
  staff_id: string;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  base_amount: number;
  commission: number;
  deductions: number;
  status: PayrollStatus;
}

// ---------------------------------------------------------------------------
// Employee directory — edit HR fields
// ---------------------------------------------------------------------------

export async function updateEmployeeAction(
  employeeId: string,
  data: EmployeeFormData,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_EMPLOYEE_RECORDS)) {
    return { error: "Forbidden" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("staff_profiles")
    .update({
      job_title: data.job_title?.trim() || null,
      employment_type: data.employment_type || null,
      hired_on: data.hired_on || null,
      base_salary: data.base_salary,
    })
    .eq("id", employeeId);

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/hr`);
  return {};
}

// ---------------------------------------------------------------------------
// Attendance — upsert on (staff_id, work_date)
// ---------------------------------------------------------------------------

export async function recordAttendanceAction(
  data: AttendanceFormData,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_ATTENDANCE)) {
    return { error: "Forbidden" };
  }
  if (!data.staff_id) return { error: "Staff member is required" };
  if (!data.work_date) return { error: "Date is required" };
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("attendance")
    .upsert(
      {
        staff_id: data.staff_id,
        work_date: data.work_date,
        check_in: data.check_in || null,
        check_out: data.check_out || null,
        status: data.status,
        notes: data.notes?.trim() || null,
        created_by: actor.id,
      },
      { onConflict: "staff_id,work_date" }
    );

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/hr`);
  return {};
}

// ---------------------------------------------------------------------------
// Payroll — create a draft/approved/paid run for a pay period
// ---------------------------------------------------------------------------

export async function createPayrollAction(
  data: PayrollFormData,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_PAYROLL)) {
    return { error: "Forbidden" };
  }
  if (!data.staff_id) return { error: "Staff member is required" };
  if (!data.period_start || !data.period_end) {
    return { error: "Pay period start and end are required" };
  }
  if (data.period_end < data.period_start) {
    return { error: "Pay period end must be on or after the start date" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // net_amount is a generated column (base_amount + commission - deductions)
  // — never insert it directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("payroll").insert({
    staff_id: data.staff_id,
    period_start: data.period_start,
    period_end: data.period_end,
    base_amount: data.base_amount,
    commission: data.commission,
    deductions: data.deductions,
    currency: CURRENCY,
    status: data.status,
    created_by: actor.id,
  });

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/hr`);
  return {};
}
