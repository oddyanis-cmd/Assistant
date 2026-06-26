/**
 * Auth helpers — server-side only.
 *
 * `getCurrentUserWithPermissions()` fetches the authenticated session user
 * plus all their effective permissions via joined queries.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/supabase/types";

export interface AuthUser {
  id: string;
  email: string | null;
  profile: Profile | null;
  roles: Role[];
  permissions: string[]; // effective permission keys
}

/**
 * Returns the current session user with their profile, roles, and effective
 * permissions list. Returns null when not authenticated or Supabase is not
 * configured (e.g. during build).
 */
export async function getCurrentUserWithPermissions(): Promise<AuthUser | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch profile
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = profileData as Profile | null;

  // Fetch roles: join user_roles → roles
  const { data: userRoleRows } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id);

  const roleIds = (userRoleRows ?? []).map((r) => (r as { role_id: string }).role_id);

  let roles: Role[] = [];
  if (roleIds.length > 0) {
    const { data: roleData } = await supabase
      .from("roles")
      .select("*")
      .in("id", roleIds);
    roles = (roleData ?? []) as Role[];
  }

  // Fetch permission keys for all assigned roles
  let rolePermKeys: string[] = [];
  if (roleIds.length > 0) {
    const { data: rpRows } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .in("role_id", roleIds);

    const permIds = (rpRows ?? []).map(
      (r) => (r as { permission_id: string }).permission_id
    );

    if (permIds.length > 0) {
      const { data: permRows } = await supabase
        .from("permissions")
        .select("key")
        .in("id", permIds);
      rolePermKeys = (permRows ?? []).map((p) => (p as { key: string }).key);
    }
  }

  // Fetch individual grants/revokes
  const { data: indivRows } = await supabase
    .from("user_permissions")
    .select("granted, permission_id")
    .eq("user_id", user.id);

  const indivPermIds = (indivRows ?? []).map(
    (r) => (r as { permission_id: string; granted: boolean }).permission_id
  );

  let indivPerms: Array<{ key: string; granted: boolean }> = [];
  if (indivPermIds.length > 0) {
    const { data: indivPermRows } = await supabase
      .from("permissions")
      .select("id, key")
      .in("id", indivPermIds);

    const permKeyMap: Record<string, string> = {};
    for (const p of indivPermRows ?? []) {
      const row = p as { id: string; key: string };
      permKeyMap[row.id] = row.key;
    }

    indivPerms = (indivRows ?? []).flatMap((r) => {
      const row = r as { permission_id: string; granted: boolean };
      const key = permKeyMap[row.permission_id];
      return key ? [{ key, granted: row.granted }] : [];
    });
  }

  const explicitGrants = new Set<string>();
  const explicitRevokes = new Set<string>();
  for (const { key, granted } of indivPerms) {
    if (granted) explicitGrants.add(key);
    else explicitRevokes.add(key);
  }

  // Merge: role perms + individual grants, minus explicit revokes
  const allPerms = new Set<string>([...rolePermKeys, ...explicitGrants]);
  for (const revoked of Array.from(explicitRevokes)) {
    allPerms.delete(revoked);
  }

  return {
    id: user.id,
    email: user.email ?? null,
    profile,
    roles,
    permissions: Array.from(allPerms),
  };
}

/**
 * Convenience: given a resolved AuthUser, check whether they hold a
 * specific permission key.
 */
export function can(user: AuthUser | null, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}

/**
 * Throws when the user lacks a permission.
 * Use in Server Actions / Route Handlers.
 */
export function assertPermission(user: AuthUser | null, permission: string): void {
  if (!can(user, permission)) {
    throw new Error(`Forbidden: missing permission '${permission}'`);
  }
}

// ---- Permission keys (type-safe reference) --------------------------------
// Keep in sync with supabase/seed.sql
export const PERMISSIONS = {
  // Appointments
  VIEW_ALL_BOOKINGS: "view_all_bookings",
  VIEW_OWN_BOOKINGS: "view_own_bookings",
  CREATE_BOOKING: "create_booking",
  EDIT_BOOKING: "edit_booking",
  RESCHEDULE_BOOKING: "reschedule_booking",
  CANCEL_BOOKING: "cancel_booking",
  ASSIGN_STAFF_TO_BOOKING: "assign_staff_to_booking",
  CONFIRM_BOOKING: "confirm_booking",
  CHECK_IN_CLIENT: "check_in_client",
  MARK_NO_SHOW: "mark_no_show",
  MANAGE_WAITLIST: "manage_waitlist",
  // Services
  VIEW_SERVICES: "view_services",
  CREATE_SERVICE: "create_service",
  EDIT_SERVICE: "edit_service",
  DELETE_SERVICE: "delete_service",
  MANAGE_SERVICE_CATEGORIES: "manage_service_categories",
  MANAGE_SERVICE_PRICING: "manage_service_pricing",
  MANAGE_SERVICE_DURATION: "manage_service_duration",
  // Clients
  VIEW_ALL_CLIENTS: "view_all_clients",
  VIEW_CLIENT_DETAILS: "view_client_details",
  CREATE_CLIENT: "create_client",
  EDIT_CLIENT: "edit_client",
  DELETE_CLIENT: "delete_client",
  VIEW_CLIENT_HISTORY: "view_client_history",
  MANAGE_CLIENT_NOTES: "manage_client_notes",
  EXPORT_CLIENT_DATA: "export_client_data",
  // Staff/Users
  VIEW_STAFF: "view_staff",
  CREATE_USER: "create_user",
  EDIT_USER: "edit_user",
  DEACTIVATE_USER: "deactivate_user",
  ASSIGN_ROLES: "assign_roles",
  MANAGE_PERMISSIONS: "manage_permissions",
  VIEW_STAFF_SCHEDULE: "view_staff_schedule",
  EDIT_STAFF_SCHEDULE: "edit_staff_schedule",
  MANAGE_STAFF_AVAILABILITY: "manage_staff_availability",
  // Sales/Promotions
  VIEW_SALES: "view_sales",
  CREATE_SALE: "create_sale",
  APPLY_DISCOUNT: "apply_discount",
  MANAGE_PROMOTIONS: "manage_promotions",
  MANAGE_GIFT_CARDS: "manage_gift_cards",
  MANAGE_PACKAGES: "manage_packages",
  VIEW_COMMISSION: "view_commission",
  // Finance
  VIEW_FINANCIAL_REPORTS: "view_financial_reports",
  VIEW_REVENUE: "view_revenue",
  MANAGE_INVOICES: "manage_invoices",
  PROCESS_PAYMENTS: "process_payments",
  ISSUE_REFUND: "issue_refund",
  MANAGE_EXPENSES: "manage_expenses",
  VIEW_PAYOUTS: "view_payouts",
  MANAGE_TAXES: "manage_taxes",
  EXPORT_FINANCIAL_DATA: "export_financial_data",
  // Inventory
  VIEW_INVENTORY: "view_inventory",
  MANAGE_INVENTORY: "manage_inventory",
  ADJUST_STOCK: "adjust_stock",
  MANAGE_SUPPLIERS: "manage_suppliers",
  LOW_STOCK_ALERTS: "low_stock_alerts",
  // Reports
  VIEW_DASHBOARD: "view_dashboard",
  VIEW_SALES_REPORTS: "view_sales_reports",
  VIEW_BOOKING_REPORTS: "view_booking_reports",
  VIEW_STAFF_PERFORMANCE: "view_staff_performance",
  VIEW_CLIENT_REPORTS: "view_client_reports",
  EXPORT_REPORTS: "export_reports",
  // Marketing
  MANAGE_CAMPAIGNS: "manage_campaigns",
  SEND_NOTIFICATIONS: "send_notifications",
  MANAGE_LOYALTY_PROGRAM: "manage_loyalty_program",
  MANAGE_REVIEWS: "manage_reviews",
  // HR
  VIEW_EMPLOYEES: "view_employees",
  MANAGE_EMPLOYEE_RECORDS: "manage_employee_records",
  MANAGE_ATTENDANCE: "manage_attendance",
  MANAGE_LEAVE_REQUESTS: "manage_leave_requests",
  MANAGE_PAYROLL: "manage_payroll",
  VIEW_HR_REPORTS: "view_hr_reports",
  // Settings
  MANAGE_SALON_SETTINGS: "manage_salon_settings",
  MANAGE_BUSINESS_HOURS: "manage_business_hours",
  MANAGE_PAYMENT_SETTINGS: "manage_payment_settings",
  MANAGE_NOTIFICATION_SETTINGS: "manage_notification_settings",
  MANAGE_INTEGRATIONS: "manage_integrations",
  VIEW_AUDIT_LOG: "view_audit_log",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
