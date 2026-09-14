/**
 * Billing helpers for the appointment detail view — service price + any
 * payments recorded against an appointment (online or manual).
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface AppointmentPaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string | null;
  created_at: string;
}

export interface AppointmentBilling {
  price: number;
  payments: AppointmentPaymentRow[];
  paidTotal: number;
}

export async function getAppointmentBilling(
  appointmentId: string
): Promise<AppointmentBilling | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data: appt } = await supabase
    .from("appointments")
    .select("service_id, services!appointments_service_id_fkey (price)")
    .eq("id", appointmentId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const price = Number((appt as any)?.services?.price ?? 0);

  const { data: pays } = await supabase
    .from("payments")
    .select("id, amount, currency, status, provider, created_at")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (pays ?? []) as any[];
  const payments: AppointmentPaymentRow[] = rows.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    provider: p.provider,
    created_at: p.created_at,
  }));
  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);

  return { price, payments, paidTotal };
}
