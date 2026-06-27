/**
 * Server actions for client detail operations.
 * Permissions gated: edit_client, manage_client_notes.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";

export interface ClientUpdateData {
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  notes: string;
  is_active: boolean;
}

export async function updateClientAction(
  clientId: string,
  data: ClientUpdateData,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.EDIT_CLIENT)) {
    return { error: "Forbidden" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("clients")
    .update({
      full_name:     data.full_name.trim(),
      phone:         data.phone.trim()         || null,
      email:         data.email.trim()         || null,
      date_of_birth: data.date_of_birth        || null,
      notes:         data.notes.trim()         || null,
      is_active:     data.is_active,
    })
    .eq("id", clientId);

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/clients/${clientId}`);
  revalidatePath(`/${locale}/admin/clients`);
  return {};
}

export async function addAdminClientNoteAction(
  clientId: string,
  note: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_CLIENT_NOTES)) {
    return { error: "Forbidden" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // Use the existing RPC that resolves staff_id from the current user's session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("staff_add_client_note", {
    p_client_id: clientId,
    p_note:      note.trim(),
  });

  if (error) return { error: (error as { message: string }).message };
  return {};
}
