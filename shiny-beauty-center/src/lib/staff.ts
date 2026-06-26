/**
 * Staff portal server actions and data fetchers.
 * All functions guard against a null Supabase client (no env vars during build).
 */
"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import type {
  Appointment,
  AppointmentStatus,
  StaffAvailability,
  StaffTimeOff,
  ClientNote,
  Notification,
} from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StaffAppointment extends Appointment {
  service_name_en: string;
  service_name_ar: string;
  client_name: string;
  client_phone: string | null;
  client_notes: string | null;
}

export interface ClientVisit {
  id: string;
  start_at: string;
  service_name_en: string;
  service_name_ar: string;
  status: AppointmentStatus;
}

export interface ClientNoteWithStaff extends ClientNote {
  staff_name: string | null;
}

// ---------------------------------------------------------------------------
// Get the staff_profiles.id for the current user (null if not staff)
// ---------------------------------------------------------------------------
export async function getMyStaffProfileId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("staff_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ? (data as { id: string }).id : null;
}

// ---------------------------------------------------------------------------
// Get appointments for a specific staff member on a given date (YYYY-MM-DD)
// ---------------------------------------------------------------------------
export async function getStaffScheduleForDay(
  date: string // YYYY-MM-DD
): Promise<StaffAppointment[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Find staff profile
  const { data: spRow } = await supabase
    .from("staff_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!spRow) return [];
  const staffId = (spRow as { id: string }).id;

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      services!appointments_service_id_fkey (name_en, name_ar),
      clients!appointments_client_id_fkey (full_name, phone, notes)
    `)
    .eq("staff_id", staffId)
    .gte("start_at", dayStart)
    .lte("start_at", dayEnd)
    .order("start_at");

  if (error) {
    console.error("[staff] getStaffScheduleForDay:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    service_name_en: row.services?.name_en ?? "Service",
    service_name_ar: row.services?.name_ar ?? "Service",
    client_name: row.clients?.full_name ?? "Client",
    client_phone: row.clients?.phone ?? null,
    client_notes: row.clients?.notes ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Get a single appointment with full detail (staff must own it or have view_all)
// ---------------------------------------------------------------------------
export async function getStaffAppointmentDetail(
  appointmentId: string
): Promise<StaffAppointment | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      services!appointments_service_id_fkey (name_en, name_ar),
      clients!appointments_client_id_fkey (full_name, phone, notes)
    `)
    .eq("id", appointmentId)
    .maybeSingle();

  if (error || !data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  return {
    ...row,
    service_name_en: row.services?.name_en ?? "Service",
    service_name_ar: row.services?.name_ar ?? "Service",
    client_name: row.clients?.full_name ?? "Client",
    client_phone: row.clients?.phone ?? null,
    client_notes: row.clients?.notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Get client visit history (past appointments with this client)
// ---------------------------------------------------------------------------
export async function getClientHistory(clientId: string): Promise<ClientVisit[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const user = await getCurrentUserWithPermissions();
  if (!user) return [];
  if (!can(user, PERMISSIONS.VIEW_CLIENT_HISTORY)) return [];

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id,
      start_at,
      status,
      services!appointments_service_id_fkey (name_en, name_ar)
    `)
    .eq("client_id", clientId)
    .order("start_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[staff] getClientHistory:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    start_at: row.start_at,
    service_name_en: row.services?.name_en ?? "Service",
    service_name_ar: row.services?.name_ar ?? "Service",
    status: row.status as AppointmentStatus,
  }));
}

// ---------------------------------------------------------------------------
// Get client notes for a client
// ---------------------------------------------------------------------------
export async function getClientNotes(clientId: string): Promise<ClientNoteWithStaff[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const user = await getCurrentUserWithPermissions();
  if (!user) return [];
  if (!can(user, PERMISSIONS.MANAGE_CLIENT_NOTES) && !can(user, PERMISSIONS.VIEW_CLIENT_HISTORY)) {
    return [];
  }

  const { data, error } = await supabase
    .from("client_notes")
    .select(`
      *,
      staff_profiles!client_notes_staff_id_fkey (
        profiles!staff_profiles_user_id_fkey (full_name)
      )
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[staff] getClientNotes:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    staff_name: (row.staff_profiles as any)?.profiles?.full_name ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Transition appointment status via RPC
// ---------------------------------------------------------------------------
export async function transitionAppointmentStatus(
  appointmentId: string,
  newStatus: "confirmed" | "checked_in" | "completed" | "no_show"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("staff_transition_appointment", {
    p_appointment_id: appointmentId,
    p_new_status: newStatus,
  });

  if (error) {
    console.error("[staff] transitionAppointmentStatus:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Add a private client note via RPC
// ---------------------------------------------------------------------------
export async function addClientNote(
  clientId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("staff_add_client_note", {
    p_client_id: clientId,
    p_note: note,
  });

  if (error) {
    console.error("[staff] addClientNote:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Get the staff member's weekly availability
// ---------------------------------------------------------------------------
export async function getMyAvailability(): Promise<StaffAvailability[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: spRow } = await supabase
    .from("staff_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!spRow) return [];
  const staffId = (spRow as { id: string }).id;

  const { data, error } = await supabase
    .from("staff_availability")
    .select("*")
    .eq("staff_id", staffId)
    .order("day_of_week");

  if (error) {
    console.error("[staff] getMyAvailability:", error.message);
    return [];
  }

  return (data ?? []) as StaffAvailability[];
}

// ---------------------------------------------------------------------------
// Upsert availability via RPC
// ---------------------------------------------------------------------------
export async function upsertAvailability(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  isAvailable: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("staff_upsert_availability", {
    p_day_of_week: dayOfWeek,
    p_start_time: startTime,
    p_end_time: endTime,
    p_is_available: isAvailable,
  });

  if (error) {
    console.error("[staff] upsertAvailability:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Get my time-off requests
// ---------------------------------------------------------------------------
export async function getMyTimeOffRequests(): Promise<StaffTimeOff[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const staffId = await getMyStaffProfileId();
  if (!staffId) return [];

  const { data, error } = await supabase
    .from("staff_time_off")
    .select("*")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[staff] getMyTimeOffRequests:", error.message);
    return [];
  }

  return (data ?? []) as StaffTimeOff[];
}

// ---------------------------------------------------------------------------
// Request time off via RPC
// ---------------------------------------------------------------------------
export async function requestTimeOff(
  dateFrom: string,
  dateTo: string,
  reason: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("staff_request_time_off", {
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_reason: reason,
  });

  if (error) {
    console.error("[staff] requestTimeOff:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Get in-app notifications for the current user
// ---------------------------------------------------------------------------
export async function getMyNotifications(): Promise<Notification[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("channel", "in_app")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[staff] getMyNotifications:", error.message);
    return [];
  }

  return (data ?? []) as Notification[];
}

// ---------------------------------------------------------------------------
// Mark a notification as read
// ---------------------------------------------------------------------------
export async function markNotificationRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---------------------------------------------------------------------------
// Mark all in-app notifications as read
// ---------------------------------------------------------------------------
export async function markAllNotificationsRead(): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("channel", "in_app")
    .neq("status", "read");

  if (error) return { success: false, error: error.message };
  return { success: true };
}
