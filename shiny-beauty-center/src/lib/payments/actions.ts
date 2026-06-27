/**
 * Server actions for the Tap Payments integration.
 *
 * These are called from BookingWizard after the user confirms their booking.
 * When paymentsEnabled is false the whole module is never invoked.
 */
"use server";

import { featureFlags, appConfig, CURRENCY } from "@/lib/config";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import { createTapCharge, resolveChargeAmount } from "@/lib/payments/tap";

export interface InitiatePaymentResult {
  /** Redirect user to this URL to complete payment */
  paymentUrl: string;
  /** Tap charge ID — stored on the payments row */
  chargeId: string;
}

/**
 * Creates a pending payment row + invoice row in Supabase, then creates a
 * Tap charge and returns the redirect URL.
 *
 * The appointment stays in PENDING status until the webhook confirms payment.
 *
 * SECURITY: servicePrice and serviceNameEn are NOT accepted from the client.
 * They are looked up server-side from the services table using serviceId,
 * ensuring the client cannot manipulate the charged amount.
 */
export async function initiateBookingPayment(params: {
  appointmentId: string;
  serviceId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  locale: string;
}): Promise<InitiatePaymentResult | { error: string }> {
  if (!featureFlags.paymentsEnabled) {
    return { error: "Payments are not enabled" };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Resolve the client record
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!clientRow) return { error: "Client record not found" };
  const clientId = (clientRow as { id: string }).id;

  // C1 FIX: Look up price and name SERVER-SIDE from the services table.
  // Only accept active services so inactive/deleted services are rejected.
  const { data: serviceRow, error: serviceErr } = await supabase
    .from("services")
    .select("price, name_en")
    .eq("id", params.serviceId)
    .eq("is_active", true)
    .maybeSingle();

  if (serviceErr || !serviceRow) {
    console.error("[tap] service lookup:", serviceErr?.message ?? "not found");
    return { error: "Service not found or no longer available" };
  }

  const servicePrice = Number((serviceRow as { price: number; name_en: string }).price);
  const serviceNameEn = (serviceRow as { price: number; name_en: string }).name_en;

  const { amount, isDeposit } = resolveChargeAmount(servicePrice);
  const currency = CURRENCY;

  // Redirect URL Tap sends the user back to after payment
  const locale = params.locale;
  const redirectUrl = `${appConfig.url}/${locale}/book/payment-callback`;

  // Build charge
  let charge;
  try {
    const nameParts = params.clientName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? "Guest";
    const lastName = nameParts.slice(1).join(" ") || undefined;

    charge = await createTapCharge({
      amount,
      currency,
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: params.clientEmail,
        phone: params.clientPhone
          ? { country_code: "974", number: params.clientPhone.replace(/\D/g, "") }
          : undefined,
      },
      description: isDeposit
        ? `Deposit for ${serviceNameEn}`
        : `Payment for ${serviceNameEn}`,
      redirect_url: redirectUrl,
      metadata: {
        appointment_id: params.appointmentId,
        client_id: clientId,
        service_id: params.serviceId,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tap] createTapCharge:", msg);
    return { error: "Payment provider error. Please try again." };
  }

  // Use service client to bypass RLS for inserting invoice + payment rows
  const svc = await getSupabaseServiceClient();
  if (!svc) return { error: "Service client not available" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = svc as any;

  // 1. Insert invoice — use DB-authoritative price, not client-supplied value
  const { data: invoiceRow, error: invoiceErr } = await db
    .from("invoices")
    .insert({
      client_id: clientId,
      appointment_id: params.appointmentId,
      subtotal: servicePrice,
      discount: 0,
      tax: 0,
      total: servicePrice,
      currency,
      status: "pending",
    })
    .select("id")
    .single();

  if (invoiceErr || !invoiceRow) {
    console.error("[tap] insert invoice:", invoiceErr?.message);
    return { error: "Failed to create invoice" };
  }

  const invoiceId = (invoiceRow as { id: string }).id;

  // 2. Insert payment row (pending) — use DB-authoritative amount and currency
  const { error: paymentErr } = await db.from("payments").insert({
    appointment_id: params.appointmentId,
    invoice_id: invoiceId,
    amount,
    currency,
    status: "pending",
    provider: "tap",
    provider_ref: charge.id,
  });

  if (paymentErr) {
    console.error("[tap] insert payment:", paymentErr.message);
    return { error: "Failed to record payment" };
  }

  const paymentUrl = charge.transaction?.url ?? charge.redirect?.url;
  if (!paymentUrl) {
    return { error: "Tap did not return a payment URL" };
  }

  return { paymentUrl, chargeId: charge.id };
}
