/**
 * Server actions for the Tap Payments integration.
 *
 * These are called from BookingWizard after the user confirms their booking.
 * When paymentsEnabled is false the whole module is never invoked.
 */
"use server";

import { featureFlags, appConfig } from "@/lib/config";
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
 */
export async function initiateBookingPayment(params: {
  appointmentId: string;
  serviceId: string;
  servicePrice: number;
  serviceNameEn: string;
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

  const { amount, isDeposit } = resolveChargeAmount(params.servicePrice);
  const currency = process.env.TAP_CURRENCY ?? "QAR";

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
        ? `Deposit for ${params.serviceNameEn}`
        : `Payment for ${params.serviceNameEn}`,
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

  // 1. Insert invoice
  const { data: invoiceRow, error: invoiceErr } = await db
    .from("invoices")
    .insert({
      client_id: clientId,
      appointment_id: params.appointmentId,
      subtotal: params.servicePrice,
      discount: 0,
      tax: 0,
      status: "pending",
    })
    .select("id")
    .single();

  if (invoiceErr || !invoiceRow) {
    console.error("[tap] insert invoice:", invoiceErr?.message);
    return { error: "Failed to create invoice" };
  }

  const invoiceId = (invoiceRow as { id: string }).id;

  // 2. Insert payment row (pending)
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
