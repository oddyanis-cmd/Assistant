/**
 * Server actions for Service Catalog CRUD.
 * Each action re-checks the caller's permission via has_permission before mutating.
 * Guards against unconfigured Supabase — returns { error } instead of crashing.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServiceFormData {
  category_id: string;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
}

export interface CategoryFormData {
  name_en: string;
  name_ar: string;
  sort_order?: number;
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// Service CRUD
// ---------------------------------------------------------------------------

export async function createServiceAction(
  data: ServiceFormData,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.CREATE_SERVICE)) {
    return { error: "Forbidden" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("services").insert({
    category_id:    data.category_id,
    name_en:        data.name_en.trim(),
    name_ar:        data.name_ar.trim(),
    description_en: data.description_en?.trim() || null,
    description_ar: data.description_ar?.trim() || null,
    price:          data.price,
    duration_minutes: data.duration_minutes,
    is_active:      data.is_active,
  });

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/services`);
  return {};
}

export async function updateServiceAction(
  id: string,
  data: ServiceFormData,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor) return { error: "Forbidden" };

  // edit_service covers all fields; pricing/duration have their own gates
  const canEdit     = can(actor, PERMISSIONS.EDIT_SERVICE);
  const canPricing  = can(actor, PERMISSIONS.MANAGE_SERVICE_PRICING);
  const canDuration = can(actor, PERMISSIONS.MANAGE_SERVICE_DURATION);

  if (!canEdit && !canPricing && !canDuration) {
    return { error: "Forbidden" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // Build update payload respecting fine-grained permissions
  const update: Record<string, unknown> = {};

  if (canEdit) {
    update.category_id    = data.category_id;
    update.name_en        = data.name_en.trim();
    update.name_ar        = data.name_ar.trim();
    update.description_en = data.description_en?.trim() || null;
    update.description_ar = data.description_ar?.trim() || null;
    update.is_active      = data.is_active;
  }
  if (canEdit || canPricing) {
    update.price = data.price;
  }
  if (canEdit || canDuration) {
    update.duration_minutes = data.duration_minutes;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("services").update(update).eq("id", id);
  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/services`);
  return {};
}

export async function deleteServiceAction(
  id: string,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.DELETE_SERVICE)) {
    return { error: "Forbidden" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("services").delete().eq("id", id);
  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/services`);
  return {};
}

// ---------------------------------------------------------------------------
// Category CRUD
// ---------------------------------------------------------------------------

export async function createCategoryAction(
  data: CategoryFormData,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_SERVICE_CATEGORIES)) {
    return { error: "Forbidden" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("service_categories").insert({
    name_en:    data.name_en.trim(),
    name_ar:    data.name_ar.trim(),
    sort_order: data.sort_order ?? 0,
    is_active:  data.is_active ?? true,
  });

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/services`);
  return {};
}

export async function updateCategoryAction(
  id: string,
  data: CategoryFormData,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_SERVICE_CATEGORIES)) {
    return { error: "Forbidden" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("service_categories")
    .update({
      name_en:    data.name_en.trim(),
      name_ar:    data.name_ar.trim(),
      sort_order: data.sort_order ?? 0,
      is_active:  data.is_active ?? true,
    })
    .eq("id", id);

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/services`);
  return {};
}
