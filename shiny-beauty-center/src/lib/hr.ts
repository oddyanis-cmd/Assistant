/**
 * HR data-fetchers — server-only.
 * Mirrors src/lib/metrics.ts: every function guards against a null Supabase
 * client and returns a safe empty default on error.
 *
 * staff_profiles ↔ profiles has no embedded-join typing in the hand-written
 * Database types, so employee display names are resolved with two flat
 * queries (staff_profiles, then profiles) merged in JS rather than a
 * PostgREST embedded resource select.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  StaffProfile,
  Profile,
  Attendance,
  AttendanceStatus,
  Payroll,
  PayrollStatus,
} from "@/lib/supabase/types";

// ---- Types ------------------------------------------------------------

export interface EmployeeRow {
  id: string; // staff_profiles.id
  userId: string;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  employmentType: string | null;
  hiredOn: string | null;
  baseSalary: number | null;
  isActive: boolean;
}

export interface StaffOption {
  id: string; // staff_profiles.id
  name: string;
}

export interface AttendanceRow {
  id: string;
  staffId: string;
  staffName: string;
  workDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  notes: string | null;
}

export interface PayrollRow {
  id: string;
  staffId: string;
  staffName: string;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  commission: number;
  deductions: number;
  netAmount: number;
  currency: string;
  status: PayrollStatus;
}

type ProfileLite = Pick<Profile, "id" | "full_name" | "phone">;

// ---------------------------------------------------------------------------
// Employee directory: staff_profiles + profiles (two queries, merged in JS)
// ---------------------------------------------------------------------------
export async function getEmployeeDirectory(): Promise<EmployeeRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data: staffData, error: staffError } = await supabase
    .from("staff_profiles")
    .select("*");

  if (staffError) {
    console.error("[hr] getEmployeeDirectory staff_profiles:", staffError.message);
    return [];
  }

  const staff = (staffData ?? []) as StaffProfile[];
  if (staff.length === 0) return [];

  const userIds = Array.from(new Set(staff.map((s) => s.user_id)));
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", userIds);

  if (profileError) {
    console.error("[hr] getEmployeeDirectory profiles:", profileError.message);
  }

  const profileById = new Map<string, ProfileLite>();
  for (const p of (profileData ?? []) as ProfileLite[]) {
    profileById.set(p.id, p);
  }

  return staff
    .map((s) => {
      const profile = profileById.get(s.user_id);
      return {
        id: s.id,
        userId: s.user_id,
        fullName: profile?.full_name ?? "Unnamed",
        phone: profile?.phone ?? null,
        jobTitle: s.job_title,
        employmentType: s.employment_type,
        hiredOn: s.hired_on,
        baseSalary: s.base_salary != null ? Number(s.base_salary) : null,
        isActive: s.is_active,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

// ---------------------------------------------------------------------------
// Active staff only — for the Attendance / Payroll form dropdowns
// ---------------------------------------------------------------------------
export async function getStaffOptions(): Promise<StaffOption[]> {
  const employees = await getEmployeeDirectory();
  return employees
    .filter((e) => e.isActive)
    .map((e) => ({ id: e.id, name: e.fullName }));
}

// ---------------------------------------------------------------------------
// Recent attendance, most recent work_date first
// ---------------------------------------------------------------------------
export async function getRecentAttendance(limit = 30): Promise<AttendanceRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .order("work_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[hr] getRecentAttendance:", error.message);
    return [];
  }

  const rows = (data ?? []) as Attendance[];
  if (rows.length === 0) return [];

  const employees = await getEmployeeDirectory();
  const nameById = new Map(employees.map((e) => [e.id, e.fullName]));

  return rows.map((r) => ({
    id: r.id,
    staffId: r.staff_id,
    staffName: nameById.get(r.staff_id) ?? "Unknown",
    workDate: r.work_date,
    checkIn: r.check_in,
    checkOut: r.check_out,
    status: r.status,
    notes: r.notes,
  }));
}

// ---------------------------------------------------------------------------
// Recent payroll, most recent period_end first
// ---------------------------------------------------------------------------
export async function getRecentPayroll(limit = 30): Promise<PayrollRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("payroll")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[hr] getRecentPayroll:", error.message);
    return [];
  }

  const rows = (data ?? []) as Payroll[];
  if (rows.length === 0) return [];

  const employees = await getEmployeeDirectory();
  const nameById = new Map(employees.map((e) => [e.id, e.fullName]));

  return rows.map((r) => ({
    id: r.id,
    staffId: r.staff_id,
    staffName: nameById.get(r.staff_id) ?? "Unknown",
    periodStart: r.period_start,
    periodEnd: r.period_end,
    baseAmount: Number(r.base_amount),
    commission: Number(r.commission),
    deductions: Number(r.deductions),
    netAmount: Number(r.net_amount),
    currency: r.currency,
    status: r.status,
  }));
}
