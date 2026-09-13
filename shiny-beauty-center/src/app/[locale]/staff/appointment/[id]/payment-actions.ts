/**
 * Manual / offline payment recording — server action.
 * Records a cash/card-in-person payment against an appointment via the
 * record_manual_payment RPC (which itself re-checks process_payments).
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CURRENCY } from "@/lib/config";

export async function recordManualPaymentAction(
  appointmentId: string,
  amount: number,
  method: string,
  reference: string | null,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.PROCESS_PAYMENTS)) {
    return { error: "Forbidden" };
  }
  if (!amount || amount <= 0) {
    return { error: "Amount must be greater than zero" };
  }
  if (!["cash", "card", "transfer"].includes(method)) {
    return { error: "Invalid payment method" };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Service not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("record_manual_payment", {
    p_appointment_id: appointmentId,
    p_amount: amount,
    p_method: method,
    p_reference: reference || null,
    p_currency: CURRENCY,
  });

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/staff/appointment/${appointmentId}`);
  return {};
}

export async function refundAppointmentPaymentAction(
  paymentId: string,
  appointmentId: string,
  reason: string | null,
  locale: string
): Promise<{ error?: string }> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || !can(actor, PERMISSIONS.ISSUE_REFUND)) {
    return { error: "Forbidden" };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Service not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("refund_payment", {
    p_payment_id: paymentId,
    p_reason: reason || null,
  });

  if (error) return { error: (error as { message: string }).message };
  revalidatePath(`/${locale}/staff/appointment/${appointmentId}`);
  return {};
}
