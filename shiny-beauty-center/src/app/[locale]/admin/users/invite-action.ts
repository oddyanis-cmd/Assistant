/**
 * Server action: invite a user by email via Supabase Admin API.
 * Requires:
 *  1. isSupabaseConfigured() — NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 *  2. supabaseConfig.serviceRoleKey — SUPABASE_SERVICE_ROLE_KEY
 *  3. Caller must hold the create_user permission.
 */
"use server";

import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { isSupabaseConfigured, supabaseConfig } from "@/lib/config";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function inviteUserAction(email: string): Promise<{ error?: string; success?: boolean }> {
  // 1. RBAC gate
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.CREATE_USER)) {
    return { error: "Forbidden" };
  }

  // 2. Supabase configured?
  if (!isSupabaseConfigured()) {
    return { error: "Supabase not configured" };
  }

  // 3. Service-role key required for admin.inviteUserByEmail
  if (!supabaseConfig.serviceRoleKey) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to your environment variables." };
  }

  const serviceClient = await getSupabaseServiceClient();
  if (!serviceClient) {
    return { error: "Could not create service-role client" };
  }

  const { error } = await serviceClient.auth.admin.inviteUserByEmail(email.trim().toLowerCase());
  if (error) return { error: error.message };
  return { success: true };
}
