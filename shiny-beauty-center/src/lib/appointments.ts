/**
 * Client-side and server-side appointment helpers.
 * These are server actions / server-only functions.
 */
"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Appointment, AppointmentStatus } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Extended appointment row with joined service + staff names
// ---------------------------------------------------------------------------
export interface AppointmentWithDetails extends Appointment {
  service_name: string;
  staff_name: string | null;
}

// ---------------------------------------------------------------------------
// Fetch the current user's appointments
// ---------------------------------------------------------------------------
export async function getMyAppointments(): Promise<{
  upcoming: AppointmentWithDetails[];
  past: AppointmentWithDetails[];
}> {
  const supabase = await getSupabaseServerClient();
  const empty = { upcoming: [], past: [] };
  if (!supabase) return empty;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  // Find the client record for this user
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!clientRow) return empty;
  const clientId = (clientRow as { id: string }).id;

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      services!appointments_service_id_fkey (name_en, name_ar),
      staff_profiles!appointments_staff_id_fkey (
        profiles!staff_profiles_user_id_fkey (full_name)
      )
    `)
    .eq("client_id", clientId)
    .order("start_at", { ascending: false });

  if (error) {
    console.error("[appointments] getMyAppointments:", error.message);
    return empty;
  }

  const now = new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: AppointmentWithDetails[] = ((data ?? []) as any[]).map((row) => ({
    ...row,
    service_name: row.services?.name_en ?? "Service",
    staff_name: row.staff_profiles?.profiles?.full_name ?? null,
  }));

  const upcoming = rows.filter(
    (r) =>
      new Date(r.start_at) >= now &&
      r.status !== "cancelled" &&
      r.status !== "no_show"
  );
  const past = rows.filter(
    (r) =>
      new Date(r.start_at) < now ||
      r.status === "cancelled" ||
      r.status === "no_show"
  );

  return { upcoming, past };
}

// ---------------------------------------------------------------------------
// Cancel an appointment (server action)
// ---------------------------------------------------------------------------
export async function cancelAppointment(
  appointmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Verify ownership via client record
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!clientRow) return { success: false, error: "Client not found" };
  const clientId = (clientRow as { id: string }).id;

  // We update using a raw cast to satisfy the strict generic
  const newStatus: AppointmentStatus = "cancelled";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("appointments")
    .update({ status: newStatus })
    .eq("id", appointmentId)
    .eq("client_id", clientId)
    .in("status", ["pending", "confirmed"]);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---------------------------------------------------------------------------
// Get available slots via RPC
// ---------------------------------------------------------------------------
export async function fetchAvailableSlots(
  serviceId: string,
  staffId: string | null,
  date: string // YYYY-MM-DD
): Promise<Array<{ staff_id: string; staff_name: string; slot_start: string }>> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_available_slots", {
    p_service_id: serviceId,
    p_staff_id: staffId,
    p_date: date,
  });

  if (error) {
    console.error("[appointments] fetchAvailableSlots:", error.message);
    return [];
  }
  return (data ?? []) as Array<{
    staff_id: string;
    staff_name: string;
    slot_start: string;
  }>;
}

// ---------------------------------------------------------------------------
// Create appointment via RPC
// ---------------------------------------------------------------------------
export async function createAppointmentAction(params: {
  serviceId: string;
  staffId: string | null;
  startAt: string;
  notes?: string;
}): Promise<{ appointmentId: string; publicToken: string } | { error: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("create_appointment", {
    p_service_id: params.serviceId,
    p_staff_id: params.staffId,
    p_start_at: params.startAt,
    p_notes: params.notes ?? null,
  });

  if (error) return { error: error.message };

  const row = (
    data as Array<{ appointment_id: string; public_token: string }>
  )?.[0];
  if (!row) return { error: "Unexpected empty response" };
  return { appointmentId: row.appointment_id, publicToken: row.public_token };
}
