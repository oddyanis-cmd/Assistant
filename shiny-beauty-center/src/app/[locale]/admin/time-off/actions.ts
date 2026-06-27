"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { reviewTimeOff } from "@/lib/metrics";

export async function reviewTimeOffAction(
  id: string,
  status: "approved" | "rejected",
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_LEAVE_REQUESTS)) {
    return { error: "Forbidden" };
  }
  const result = await reviewTimeOff(id, status);
  if (result.error) return { error: result.error };
  revalidatePath(`/${locale}/admin/time-off`);
  return {};
}
