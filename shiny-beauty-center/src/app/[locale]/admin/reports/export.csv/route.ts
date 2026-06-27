/**
 * CSV Export Route Handler — GET /[locale]/admin/reports/export.csv
 * Streams a CSV file for the requested report type.
 * Gated on export_reports + the report-specific permission.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import {
  getStaffPerformance,
  getServicePopularity,
  getCommissionSummary,
} from "@/lib/metrics";

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  // Wrap in quotes if contains comma, quote, or newline
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ];
  return lines.join("\r\n");
}

export async function GET(
  request: NextRequest,
  // Next.js requires params as second arg but we use searchParams here
): Promise<NextResponse> {
  const user = await getCurrentUserWithPermissions();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!can(user, PERMISSIONS.EXPORT_REPORTS)) {
    return new NextResponse("Forbidden: export_reports required", { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const report = sp.get("report") ?? "staff";
  const from   = sp.get("from")   ?? undefined;
  const to     = sp.get("to")     ?? undefined;

  let csv = "";
  let filename = "report.csv";

  if (report === "staff") {
    if (!can(user, PERMISSIONS.VIEW_STAFF_PERFORMANCE)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const rows = await getStaffPerformance(from, to);
    csv = buildCSV(
      ["Staff Name", "Total Appointments", "Completed", "Revenue (SAR)", "No-Shows", "Avg Rating"],
      rows.map((r) => [
        r.staffName,
        r.totalAppts,
        r.completed,
        r.revenue,
        r.noShows,
        r.avgRating ?? "",
      ])
    );
    filename = "staff-performance.csv";

  } else if (report === "services") {
    if (!can(user, PERMISSIONS.VIEW_SALES_REPORTS) && !can(user, PERMISSIONS.VIEW_BOOKING_REPORTS)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const rows = await getServicePopularity(from, to);
    csv = buildCSV(
      ["Service", "Category", "Bookings", "Revenue (SAR)", "Avg Price (SAR)"],
      rows.map((r) => [r.serviceName, r.categoryName, r.bookingCount, r.revenue, r.avgPrice])
    );
    filename = "service-popularity.csv";

  } else if (report === "commission") {
    if (!can(user, PERMISSIONS.VIEW_COMMISSION)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const rows = await getCommissionSummary(from, to);
    csv = buildCSV(
      ["Staff Name", "Completed Appointments", "Revenue (SAR)", "Commission (SAR)"],
      rows.map((r) => [r.staffName, r.completedAppts, r.revenue, r.commission])
    );
    filename = "commission-summary.csv";

  } else {
    return new NextResponse("Unknown report type", { status: 400 });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
