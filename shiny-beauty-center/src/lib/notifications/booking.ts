/**
 * Booking notification helpers — called from the booking confirmation path.
 *
 * `sendBookingConfirmation()` fires email + WhatsApp when an appointment
 * reaches CONFIRMED status. It is:
 *  - Fully gated by featureFlags.notificationsEnabled.
 *  - Never throws — all errors are logged and swallowed so booking flows
 *    remain unaffected.
 *  - Uses the service-role Supabase client to look up client/service details.
 */

import { featureFlags } from "@/lib/config";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { send } from "./send";

export interface BookingNotificationParams {
  appointmentId: string;
}

/**
 * Look up appointment details and send confirmation via email + WhatsApp.
 * Safe to await fire-and-forget (never throws).
 */
export async function sendBookingConfirmation(
  params: BookingNotificationParams
): Promise<void> {
  if (!featureFlags.notificationsEnabled) return;

  try {
    const svc = await getSupabaseServiceClient();
    if (!svc) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = svc as any;

    // Fetch appointment with joined client + service + staff
    const { data: row, error } = await db
      .from("appointments")
      .select(`
        id,
        start_at,
        public_token,
        status,
        services!appointments_service_id_fkey (name_en, name_ar, price),
        clients!appointments_client_id_fkey (full_name, phone, email, locale),
        staff_profiles!appointments_staff_id_fkey (
          profiles!staff_profiles_user_id_fkey (full_name)
        )
      `)
      .eq("id", params.appointmentId)
      .maybeSingle();

    if (error || !row) {
      console.error(
        "[notify:booking] Failed to fetch appointment:",
        error?.message ?? "not found"
      );
      return;
    }

    const appt = row as {
      id: string;
      start_at: string;
      public_token: string | null;
      status: string;
      services: { name_en: string; name_ar: string; price: number } | null;
      clients: {
        full_name: string;
        phone: string | null;
        email: string | null;
        locale: "en" | "ar";
      } | null;
      staff_profiles: {
        profiles: { full_name: string | null } | null;
      } | null;
    };

    // Require at least client info
    if (!appt.clients) {
      console.warn("[notify:booking] No client attached to appointment:", params.appointmentId);
      return;
    }

    const client = appt.clients;
    const service = appt.services;
    const locale: "en" | "ar" = client.locale ?? "en";

    const serviceName =
      locale === "ar"
        ? (service?.name_ar ?? service?.name_en ?? "Service")
        : (service?.name_en ?? "Service");

    const staffName =
      (appt.staff_profiles as unknown as { profiles?: { full_name?: string | null } } | null)
        ?.profiles?.full_name ?? undefined;

    const price = service?.price
      ? `${service.price.toLocaleString(locale === "ar" ? "ar-SA" : "en-US")} SAR`
      : undefined;

    const templateData = {
      clientName: client.full_name,
      serviceName,
      startAt: appt.start_at,
      bookingRef: appt.public_token ?? undefined,
      staffName: staffName ?? undefined,
      location: "Shiny Beauty Center",
      price,
    };

    const sends: Promise<unknown>[] = [];

    // Email
    if (client.email) {
      sends.push(
        send({
          channel: "email",
          to: client.email,
          template: "booking_confirmed",
          data: templateData,
          locale,
        })
      );
    }

    // WhatsApp
    if (client.phone) {
      sends.push(
        send({
          channel: "whatsapp",
          to: client.phone,
          template: "booking_confirmed",
          data: templateData,
          locale,
        })
      );
    }

    await Promise.allSettled(sends);
    console.log(`[notify:booking] Confirmation sent for appointment ${params.appointmentId}`);
  } catch (err) {
    // Never propagate — this must not break booking
    console.error("[notify:booking] Unexpected error:", err instanceof Error ? err.message : String(err));
  }
}
