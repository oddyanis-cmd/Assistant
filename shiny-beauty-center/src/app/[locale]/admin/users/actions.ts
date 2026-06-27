/**
 * Server actions for user/permission management.
 * Each action re-checks the caller's permissions before mutating.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { assignRole, removeRole, setUserPermission, clearUserPermission } from "@/lib/metrics";

export async function assignRoleAction(
  userId: string,
  roleId: string,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.ASSIGN_ROLES)) {
    return { error: "Forbidden" };
  }
  const result = await assignRole(userId, roleId);
  if (result.error) return { error: result.error };
  revalidatePath(`/${locale}/admin/users`);
  return {};
}

export async function removeRoleAction(
  userId: string,
  roleId: string,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.ASSIGN_ROLES)) {
    return { error: "Forbidden" };
  }
  const result = await removeRole(userId, roleId);
  if (result.error) return { error: result.error };
  revalidatePath(`/${locale}/admin/users`);
  return {};
}

export async function setPermissionAction(
  userId: string,
  permissionId: string,
  granted: boolean,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_PERMISSIONS)) {
    return { error: "Forbidden" };
  }
  const result = await setUserPermission(userId, permissionId, granted);
  if (result.error) return { error: result.error };
  revalidatePath(`/${locale}/admin/users`);
  return {};
}

export async function clearPermissionAction(
  userId: string,
  permissionId: string,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_PERMISSIONS)) {
    return { error: "Forbidden" };
  }
  const result = await clearUserPermission(userId, permissionId);
  if (result.error) return { error: result.error };
  revalidatePath(`/${locale}/admin/users`);
  return {};
}
