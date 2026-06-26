/**
 * Server-side data fetchers for the services catalog.
 * All functions guard against a null Supabase client (no env vars during build).
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Service, ServiceCategory, StaffProfile } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Service categories
// ---------------------------------------------------------------------------
export async function getServiceCategories(): Promise<ServiceCategory[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("[catalog] getServiceCategories:", error.message);
    return [];
  }
  return (data ?? []) as ServiceCategory[];
}

// ---------------------------------------------------------------------------
// All active services (optionally filtered by category)
// ---------------------------------------------------------------------------
export async function getServices(categoryId?: string): Promise<Service[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("created_at");

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[catalog] getServices:", error.message);
    return [];
  }
  return (data ?? []) as Service[];
}

// ---------------------------------------------------------------------------
// Single service
// ---------------------------------------------------------------------------
export async function getServiceById(id: string): Promise<Service | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error) return null;
  return data as Service;
}

// ---------------------------------------------------------------------------
// Active staff profiles (with profile join for name)
// ---------------------------------------------------------------------------
export interface StaffWithProfile {
  id: string;              // staff_profiles.id
  user_id: string;
  full_name: string;
  bio: string | null;
  specialties: string[] | null;
  color_hex: string | null;
  is_active: boolean;
}

export async function getActiveStaff(): Promise<StaffWithProfile[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("staff_profiles")
    .select(`
      id,
      user_id,
      bio,
      specialties,
      color_hex,
      is_active,
      profiles!staff_profiles_user_id_fkey (
        full_name
      )
    `)
    .eq("is_active", true);

  if (error) {
    console.error("[catalog] getActiveStaff:", error.message);
    return [];
  }

  return ((data ?? []) as Array<StaffProfile & { profiles: { full_name: string | null } | null }>).map(
    (row) => ({
      id: row.id,
      user_id: row.user_id,
      full_name: row.profiles?.full_name ?? "Staff Member",
      bio: row.bio,
      specialties: row.specialties,
      color_hex: row.color_hex,
      is_active: row.is_active,
    })
  );
}
