/**
 * HR — /admin/hr
 * Employee directory (editable HR fields), attendance, and payroll.
 * Gated on any of: view_employees, manage_employee_records, manage_attendance,
 * manage_payroll, view_hr_reports. Each section below is further gated on
 * its own specific permission. Leave requests live at /admin/time-off — this
 * page only links there rather than duplicating that UI.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { CURRENCY } from "@/lib/config";
import {
  getEmployeeDirectory,
  getStaffOptions,
  getRecentAttendance,
  getRecentPayroll,
} from "@/lib/hr";
import { Link } from "@/i18n/navigation";
import { EmployeeEditor } from "@/components/admin/hr/EmployeeEditor";
import { AttendancePanel } from "@/components/admin/hr/AttendancePanel";
import { PayrollPanel } from "@/components/admin/hr/PayrollPanel";

export const metadata: Metadata = { title: "HR — Admin" };

interface HrPageProps {
  params: Promise<{ locale: string }>;
}

const DIRECTORY_COLUMNS = [
  "Name",
  "Job title",
  "Employment",
  "Hired on",
  "Base salary",
  "Status",
  "Actions",
];

export default async function AdminHrPage({ params }: HrPageProps) {
  const { locale } = await params;
  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/hr`);
  }

  const canViewEmployees    = can(user, PERMISSIONS.VIEW_EMPLOYEES);
  const canManageEmployees  = can(user, PERMISSIONS.MANAGE_EMPLOYEE_RECORDS);
  const canManageAttendance = can(user, PERMISSIONS.MANAGE_ATTENDANCE);
  const canManagePayroll    = can(user, PERMISSIONS.MANAGE_PAYROLL);
  const canViewHrReports    = can(user, PERMISSIONS.VIEW_HR_REPORTS);

  const hasHrAccess =
    canViewEmployees ||
    canManageEmployees ||
    canManageAttendance ||
    canManagePayroll ||
    canViewHrReports;

  if (!hasHrAccess) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">▦</div>
          <p className="text-charcoal-600 text-sm">
            You don&apos;t have permission to access HR. Please contact your manager.
          </p>
        </div>
      </div>
    );
  }

  const canViewDirectory = canViewEmployees || canManageEmployees;

  const [employees, staffOptions, attendance, payroll] = await Promise.all([
    canViewDirectory ? getEmployeeDirectory() : [],
    canManageAttendance || canManagePayroll ? getStaffOptions() : [],
    canManageAttendance ? getRecentAttendance() : [],
    canManagePayroll ? getRecentPayroll() : [],
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light text-charcoal-900">HR</h1>
        <p className="text-charcoal-500 text-sm mt-1">
          Employee directory, attendance, and payroll.
        </p>
      </div>

      {/* Employee directory */}
      {canViewDirectory && (
        <section className="card overflow-x-auto p-0">
          <div className="px-6 py-4 border-b border-nude-100">
            <h2 className="text-sm font-semibold text-charcoal-700">
              Employee directory ({employees.length})
            </h2>
          </div>
          {employees.length === 0 ? (
            <p className="text-sm text-charcoal-400 italic py-8 text-center">
              No employee records yet.
            </p>
          ) : (
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="border-b border-nude-100">
                <tr>
                  {DIRECTORY_COLUMNS.map((col) => (
                    <th
                      key={col}
                      className="py-3 px-4 text-xs font-semibold text-charcoal-500 uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <EmployeeEditor
                    key={employee.id}
                    locale={locale}
                    currency={CURRENCY}
                    canManage={canManageEmployees}
                    employee={employee}
                  />
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Attendance */}
      {canManageAttendance && (
        <AttendancePanel locale={locale} staffOptions={staffOptions} recent={attendance} />
      )}

      {/* Payroll */}
      {canManagePayroll && (
        <PayrollPanel
          locale={locale}
          currency={CURRENCY}
          staffOptions={staffOptions}
          recent={payroll}
        />
      )}

      {/* Leave & time off — handled on its own page, just link out */}
      <div className="card flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-charcoal-700">Leave & time off</h2>
          <p className="text-charcoal-400 text-xs mt-0.5">
            Staff leave requests are reviewed and approved on the Time-Off page.
          </p>
        </div>
        <Link href="/admin/time-off" className="btn-ghost text-sm whitespace-nowrap">
          Go to Time-Off →
        </Link>
      </div>
    </div>
  );
}
