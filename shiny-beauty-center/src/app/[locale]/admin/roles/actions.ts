/**
 * Server actions for Roles & Positions management.
 * Each action re-checks the caller's permission before mutating, then calls
 * the corresponding Postgres RPC (which re-checks server-side too) and
 * revalidates the roles page.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";

export interface RoleFormData {
  /** null = create a new role; otherwise update the role with this id. */
  id: string | null;
  name: string;
  description: string;
  /** Permission keys the role should hold (replaces its current set). */
  permissions: string[];
}

export async function upsertRoleAction(
  data: RoleFormData,
  locale: string
): Promise<{ error?: string; id?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_PERMISSIONS)) {
    return { error: "Forbidden" };
  }
  if (!data.name.trim()) {
    return { error: "Role name is required" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: roleId, error } = await (supabase as any).rpc("admin_upsert_role", {
    p_id: data.id,
    p_name: data.name.trim(),
    p_description: data.description.trim() || null,
    p_permissions: data.permissions,
  });

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/roles`);
  return { id: roleId as string };
}

export async function deleteRoleAction(
  id: string,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_PERMISSIONS)) {
    return { error: "Forbidden" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("admin_delete_role", { p_id: id });
  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/roles`);
  return {};
}
