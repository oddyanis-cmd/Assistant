/**
 * POST /api/payments/tap-webhook
 *
 * Tap Payments webhook endpoint.
 *
 * - Reads the raw request body (required for HMAC verification).
 * - Verifies the Tap signature from the `hashstring` header (or the
 *   `x-tap-signature` header, depending on Tap dashboard config).
 * - On CAPTURED/AUTHORIZED: marks payment paid, invoice paid, appointment confirmed.
 * - Idempotent: re-delivery of the same charge ID is a no-op.
 * - Returns 200 quickly; heavy work is inline (no background job needed for MVP).
 * - Returns 400 on bad signature so Tap does not retry.
 * - Returns 200 even if paymentsEnabled is false, so stale webhooks don't pile up.
 *
 * Runtime: nodejs (raw body access requires Node runtime, not Edge).
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { featureFlags } from "@/lib/config";
import { verifyTapWebhook } from "@/lib/payments/tap";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { sendBookingConfirmation } from "@/lib/notifications/booking";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // If the flag is off, acknowledge and discard (don't crash)
  if (!featureFlags.paymentsEnabled) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Read raw body for HMAC computation
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Cannot read body" }, { status: 400 });
  }

  // Tap sends the signature in the `hashstring` header
  const signature =
    request.headers.get("hashstring") ??
    request.headers.get("x-tap-signature");

  let payload;
  try {
    payload = verifyTapWebhook(rawBody, signature);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "signature error";
    console.warn("[tap-webhook] Bad signature:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const chargeId = payload.id;
  const status = payload.status; // "CAPTURED" | "AUTHORIZED" | "FAILED" | ...
  const isSuccess = status === "CAPTURED" || status === "AUTHORIZED";

  const svc = await getSupabaseServiceClient();
  if (!svc) {
    // Supabase not configured — acknowledge so Tap stops retrying
    console.error("[tap-webhook] Supabase service client not available");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Look up payment row by provider_ref (Tap charge ID)
  const { data: paymentRow, error: lookupErr } = await svc
    .from("payments")
    .select("id, appointment_id, invoice_id, status")
    .eq("provider_ref", chargeId)
    .maybeSingle();

  if (lookupErr) {
    console.error("[tap-webhook] payment lookup:", lookupErr.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!paymentRow) {
    // Unknown charge — log and return 200 (may be a test charge from Tap dashboard)
    console.warn("[tap-webhook] Unknown charge ID:", chargeId);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const payment = paymentRow as {
    id: string;
    appointment_id: string | null;
    invoice_id: string | null;
    status: string;
  };

  // Idempotency: already processed
  if (payment.status === "paid") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = svc as any;

  if (isSuccess) {
    // 1. Update payment → paid
    await db
      .from("payments")
      .update({ status: "paid", provider_ref: chargeId })
      .eq("id", payment.id);

    // 2. Update invoice → paid
    if (payment.invoice_id) {
      await db
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", payment.invoice_id);
    }

    // 3. Update appointment → confirmed (only if still pending)
    if (payment.appointment_id) {
      await db
        .from("appointments")
        .update({ status: "confirmed" })
        .eq("id", payment.appointment_id)
        .eq("status", "pending");

      // Fire booking confirmation notification (async, non-blocking)
      sendBookingConfirmation({ appointmentId: payment.appointment_id }).catch(
        (err) => console.error("[tap-webhook] notification error:", err)
      );
    }

    console.log("[tap-webhook] Confirmed appointment for charge:", chargeId);
  } else {
    // FAILED / CANCELLED — mark payment failed, leave appointment pending
    await db
      .from("payments")
      .update({ status: "failed" })
      .eq("id", payment.id);

    console.log("[tap-webhook] Payment failed for charge:", chargeId, "status:", status);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
