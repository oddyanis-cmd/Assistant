/**
 * Server actions for the Finance section — expenses CRUD + payment refunds.
 * Each action re-checks the caller's permission before mutating (RLS on the
 * `expenses` table and the `refund_payment` RPC re-check server-side too, but
 * we fail fast here with a friendly error).
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, CURRENCY } from "@/lib/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpenseFormData {
  category: string;
  description?: string | null;
  amount: number;
  incurred_on: string; // YYYY-MM-DD
  vendor?: string | null;
}

// ---------------------------------------------------------------------------
// Expenses CRUD
// ---------------------------------------------------------------------------

export async function createExpenseAction(
  data: ExpenseFormData,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_EXPENSES)) {
    return { error: "Forbidden" };
  }
  if (!data.category?.trim()) return { error: "Category is required" };
  if (data.amount == null || data.amount < 0) return { error: "Amount must be zero or greater" };
  if (!data.incurred_on) return { error: "Date is required" };
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("expenses").insert({
    category:    data.category.trim(),
    description: data.description?.trim() || null,
    amount:      data.amount,
    currency:    CURRENCY,
    incurred_on: data.incurred_on,
    vendor:      data.vendor?.trim() || null,
    created_by:  actor.id,
  });

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/finance`);
  return {};
}

export async function updateExpenseAction(
  id: string,
  data: ExpenseFormData,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_EXPENSES)) {
    return { error: "Forbidden" };
  }
  if (!data.category?.trim()) return { error: "Category is required" };
  if (data.amount == null || data.amount < 0) return { error: "Amount must be zero or greater" };
  if (!data.incurred_on) return { error: "Date is required" };
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("expenses")
    .update({
      category:    data.category.trim(),
      description: data.description?.trim() || null,
      amount:      data.amount,
      incurred_on: data.incurred_on,
      vendor:      data.vendor?.trim() || null,
    })
    .eq("id", id);

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/finance`);
  return {};
}

export async function deleteExpenseAction(
  id: string,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.MANAGE_EXPENSES)) {
    return { error: "Forbidden" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("expenses").delete().eq("id", id);
  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/finance`);
  return {};
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export async function refundPaymentAction(
  paymentId: string,
  reason: string | null,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.ISSUE_REFUND)) {
    return { error: "Forbidden" };
  }
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("refund_payment", {
    p_payment_id: paymentId,
    p_reason: reason || null,
  });

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/admin/finance`);
  return {};
}
