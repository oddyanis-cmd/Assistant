/**
 * Admin metrics data-fetchers — server-only.
 * All functions guard against null Supabase client and return safe empty defaults.
 * Each calls the SECURITY DEFINER functions defined in 005_admin_metrics.sql.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";

// ---- Types ----------------------------------------------------------------

export interface RevenueMetrics {
  currentRevenue: number;
  previousRevenue: number;
  changePct: number;
  totalBookings: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  noShowRate: number;
}

export interface RevenueTrendPoint {
  day: string; // YYYY-MM-DD
  revenue: number;
  bookings: number;
}

export interface PeakHourPoint {
  dayOfWeek: number;  // 0=Sun … 6=Sat
  hourOfDay: number;  // 0-23
  count: number;
}

export interface ClientMetrics {
  totalClients: number;
  newClients: number;
  returningClients: number;
}

export interface StaffPerformanceRow {
  staffId: string;
  staffName: string;
  totalAppts: number;
  completed: number;
  revenue: number;
  noShows: number;
  avgRating: number | null;
}

export interface ServicePopularityRow {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  bookingCount: number;
  revenue: number;
  avgPrice: number;
}

export interface CommissionRow {
  staffId: string;
  staffName: string;
  completedAppts: number;
  revenue: number;
  commission: number;
}

export interface TimeOffRow {
  id: string;
  staffId: string;
  staffName: string;
  dateFrom: string;
  dateTo: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface CalendarBooking {
  id: string;
  clientName: string;
  staffName: string | null;
  serviceName: string;
  status: string;
  startAt: string;
  endAt: string;
  price: number;
  colorHex: string | null;
}

export interface UserWithRoles {
  userId: string;
  fullName: string | null;
  email: string | null;
  isActive: boolean;
  roles: Array<{ id: string; name: string }>;
  createdAt: string;
}

// ---- Zero defaults --------------------------------------------------------

const EMPTY_REVENUE: RevenueMetrics = {
  currentRevenue: 0,
  previousRevenue: 0,
  changePct: 0,
  totalBookings: 0,
  completedCount: 0,
  cancelledCount: 0,
  noShowCount: 0,
  noShowRate: 0,
};

// ---- Data fetchers --------------------------------------------------------

export async function getRevenueMetrics(
  period: "today" | "week" | "month" = "month"
): Promise<RevenueMetrics> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return EMPTY_REVENUE;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_get_revenue_metrics", {
    p_period: period,
  });

  if (error) {
    console.error("[metrics] getRevenueMetrics:", error.message);
    return EMPTY_REVENUE;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (data as any[])?.[0];
  if (!row) return EMPTY_REVENUE;

  return {
    currentRevenue:  Number(row.current_revenue  ?? 0),
    previousRevenue: Number(row.previous_revenue ?? 0),
    changePct:       Number(row.change_pct       ?? 0),
    totalBookings:   Number(row.total_bookings   ?? 0),
    completedCount:  Number(row.completed_count  ?? 0),
    cancelledCount:  Number(row.cancelled_count  ?? 0),
    noShowCount:     Number(row.no_show_count    ?? 0),
    noShowRate:      Number(row.no_show_rate     ?? 0),
  };
}

export async function getRevenueTrend(days = 30): Promise<RevenueTrendPoint[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_get_revenue_trend", {
    p_days: days,
  });

  if (error) {
    console.error("[metrics] getRevenueTrend:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    day:      String(row.day),
    revenue:  Number(row.revenue),
    bookings: Number(row.bookings),
  }));
}

export async function getPeakHours(days = 90): Promise<PeakHourPoint[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_get_peak_hours", {
    p_days: days,
  });

  if (error) {
    console.error("[metrics] getPeakHours:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    dayOfWeek:  Number(row.day_of_week),
    hourOfDay:  Number(row.hour_of_day),
    count:      Number(row.count),
  }));
}

export async function getClientMetrics(
  period: "today" | "week" | "month" = "month"
): Promise<ClientMetrics> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { totalClients: 0, newClients: 0, returningClients: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_get_client_metrics", {
    p_period: period,
  });

  if (error) {
    console.error("[metrics] getClientMetrics:", error.message);
    return { totalClients: 0, newClients: 0, returningClients: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (data as any[])?.[0];
  if (!row) return { totalClients: 0, newClients: 0, returningClients: 0 };

  return {
    totalClients:     Number(row.total_clients     ?? 0),
    newClients:       Number(row.new_clients       ?? 0),
    returningClients: Number(row.returning_clients ?? 0),
  };
}

export async function getStaffPerformance(
  from?: string,
  to?: string
): Promise<StaffPerformanceRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_get_staff_performance", {
    p_from: from ?? null,
    p_to:   to   ?? null,
  });

  if (error) {
    console.error("[metrics] getStaffPerformance:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    staffId:    String(row.staff_id),
    staffName:  String(row.staff_name ?? ""),
    totalAppts: Number(row.total_appts ?? 0),
    completed:  Number(row.completed  ?? 0),
    revenue:    Number(row.revenue    ?? 0),
    noShows:    Number(row.no_shows   ?? 0),
    avgRating:  row.avg_rating != null ? Number(row.avg_rating) : null,
  }));
}

export async function getServicePopularity(
  from?: string,
  to?: string
): Promise<ServicePopularityRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_get_service_popularity", {
    p_from: from ?? null,
    p_to:   to   ?? null,
  });

  if (error) {
    console.error("[metrics] getServicePopularity:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    serviceId:    String(row.service_id),
    serviceName:  String(row.service_name  ?? ""),
    categoryName: String(row.category_name ?? ""),
    bookingCount: Number(row.booking_count ?? 0),
    revenue:      Number(row.revenue       ?? 0),
    avgPrice:     Number(row.avg_price     ?? 0),
  }));
}

export async function getCommissionSummary(
  from?: string,
  to?: string,
  commissionPct = 30
): Promise<CommissionRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_get_commission_summary", {
    p_from:           from ?? null,
    p_to:             to   ?? null,
    p_commission_pct: commissionPct,
  });

  if (error) {
    console.error("[metrics] getCommissionSummary:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    staffId:        String(row.staff_id),
    staffName:      String(row.staff_name       ?? ""),
    completedAppts: Number(row.completed_appts  ?? 0),
    revenue:        Number(row.revenue          ?? 0),
    commission:     Number(row.commission       ?? 0),
  }));
}

export async function getAllTimeOff(): Promise<TimeOffRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_get_all_time_off");

  if (error) {
    console.error("[metrics] getAllTimeOff:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    id:          String(row.id),
    staffId:     String(row.staff_id),
    staffName:   String(row.staff_name ?? ""),
    dateFrom:    String(row.date_from),
    dateTo:      String(row.date_to),
    reason:      row.reason ?? null,
    status:      row.status as "pending" | "approved" | "rejected",
    reviewedBy:  row.reviewed_by ?? null,
    reviewedAt:  row.reviewed_at ?? null,
    createdAt:   String(row.created_at),
  }));
}

export async function getAllBookings(
  from?: string,
  to?: string
): Promise<CalendarBooking[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_get_all_bookings", {
    p_from: from ?? null,
    p_to:   to   ?? null,
  });

  if (error) {
    console.error("[metrics] getAllBookings:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    id:          String(row.id),
    clientName:  String(row.client_name  ?? ""),
    staffName:   row.staff_name ?? null,
    serviceName: String(row.service_name ?? ""),
    status:      String(row.status),
    startAt:     String(row.start_at),
    endAt:       String(row.end_at),
    price:       Number(row.price    ?? 0),
    colorHex:    row.color_hex ?? null,
  }));
}

export async function getUsersWithRoles(): Promise<UserWithRoles[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_get_users_with_roles");

  if (error) {
    console.error("[metrics] getUsersWithRoles:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    userId:    String(row.user_id),
    fullName:  row.full_name ?? null,
    email:     row.email     ?? null,
    isActive:  Boolean(row.is_active),
    roles:     Array.isArray(row.roles) ? row.roles : [],
    createdAt: String(row.created_at),
  }));
}

// ---- Mutating server actions -----------------------------------------------

export async function reviewTimeOff(
  id: string,
  status: "approved" | "rejected"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("admin_review_time_off", {
    p_id:     id,
    p_status: status,
  });

  if (error) {
    console.error("[metrics] reviewTimeOff:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function assignRole(
  userId: string,
  roleId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("admin_assign_role", {
    p_user_id: userId,
    p_role_id: roleId,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function removeRole(
  userId: string,
  roleId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("admin_remove_role", {
    p_user_id: userId,
    p_role_id: roleId,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function setUserPermission(
  userId: string,
  permissionId: string,
  granted: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("admin_set_user_permission", {
    p_user_id:       userId,
    p_permission_id: permissionId,
    p_granted:       granted,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function clearUserPermission(
  userId: string,
  permissionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("admin_clear_user_permission", {
    p_user_id:       userId,
    p_permission_id: permissionId,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
