/**
 * GET /api/cron/reminders
 *
 * Cron job that sends 24h and 2h appointment reminders.
 *
 * Security:
 *   - Requires Authorization: Bearer <CRON_SECRET> header.
 *   - On Vercel, set this via environment variable and reference it in vercel.json.
 *
 * Dedup:
 *   - Uses the `notifications` table with channel = 'email' | 'whatsapp', and a
 *     composite unique check on (appointment_id, reminder_type) stored in the
 *     `subject` column as a sentinel ("__reminder_24h__" / "__reminder_2h__").
 *   - Before sending, checks for an existing row; inserts a PENDING row first
 *     (unique constraint prevents re-insertion), then sends and updates to SENT.
 *   - This means each reminder fires at most once per appointment per window,
 *     even if the cron fires multiple times within the same period.
 *
 * Vercel cron schedule: see vercel.json — run every 15 minutes
 *   (cron expression uses "slash-15" in the minute field, stars elsewhere),
 *   which catches both the 24h and 2h windows reliably when the cron looks
 *   +/- 8 minutes around the exact threshold.
 *
 * Runtime: nodejs (needs Supabase service client + fetch).
 */
export const runtime = "nodejs";
// Do not cache this route
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { featureFlags, CURRENCY } from "@/lib/config";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { send } from "@/lib/notifications/send";
import type { TemplateData } from "@/lib/notifications/types";

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured — always deny (fail closed in every environment)
    return false;
  }
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Reminder sentinel subjects stored in the notifications table for dedup
// ---------------------------------------------------------------------------
const SENTINEL_24H = "__reminder_24h__";
const SENTINEL_2H  = "__reminder_2h__";

type ReminderType = "24h" | "2h";

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // If flag is off → return 200 so Vercel doesn't treat it as a failure
  if (!featureFlags.notificationsEnabled) {
    return NextResponse.json({ skipped: true, reason: "notifications_disabled" });
  }

  const svc = await getSupabaseServiceClient();
  if (!svc) {
    return NextResponse.json(
      { error: "Supabase service client not available" },
      { status: 503 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = svc as any;

  const now = new Date();

  // 24-hour window: appointments starting between now+23h52m and now+24h8m
  // (±8 min gives tolerance for a 15-min cron interval)
  const window24Low  = new Date(now.getTime() + 23 * 60 * 60 * 1000 + 52 * 60 * 1000);
  const window24High = new Date(now.getTime() + 24 * 60 * 60 * 1000 +  8 * 60 * 1000);

  // 2-hour window: appointments starting between now+1h52m and now+2h8m
  const window2Low  = new Date(now.getTime() + 1 * 60 * 60 * 1000 + 52 * 60 * 1000);
  const window2High = new Date(now.getTime() + 2 * 60 * 60 * 1000 +  8 * 60 * 1000);

  const stats = { sent: 0, skipped: 0, errors: 0 };

  // Fetch appointments in BOTH windows in a single query
  const { data: appointments, error: fetchErr } = await db
    .from("appointments")
    .select(`
      id,
      start_at,
      public_token,
      services!appointments_service_id_fkey (name_en, name_ar, price),
      clients!appointments_client_id_fkey (full_name, phone, email, locale, user_id),
      staff_profiles!appointments_staff_id_fkey (
        profiles!staff_profiles_user_id_fkey (full_name)
      )
    `)
    .in("status", ["confirmed", "checked_in"])
    .or(
      `start_at.gte.${window24Low.toISOString()},start_at.lte.${window24High.toISOString()},start_at.gte.${window2Low.toISOString()},start_at.lte.${window2High.toISOString()}`
    )
    .order("start_at");

  if (fetchErr) {
    console.error("[cron:reminders] fetch error:", fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const rows = (appointments ?? []) as Array<{
    id: string;
    start_at: string;
    public_token: string | null;
    services: { name_en: string; name_ar: string; price: number } | null;
    clients: {
      full_name: string;
      phone: string | null;
      email: string | null;
      locale: "en" | "ar" | null;
      user_id: string | null;
    } | null;
    staff_profiles: {
      profiles: { full_name: string | null } | null;
    } | null;
  }>;

  for (const appt of rows) {
    if (!appt.clients) continue;

    const startAt = new Date(appt.start_at);
    const diffMs = startAt.getTime() - now.getTime();

    // Determine which reminder type applies
    const reminderType: ReminderType | null =
      diffMs >= window24Low.getTime() - now.getTime() &&
      diffMs <= window24High.getTime() - now.getTime()
        ? "24h"
        : diffMs >= window2Low.getTime() - now.getTime() &&
          diffMs <= window2High.getTime() - now.getTime()
        ? "2h"
        : null;

    if (!reminderType) continue;

    const sentinel = reminderType === "24h" ? SENTINEL_24H : SENTINEL_2H;
    const templateId = reminderType === "24h" ? "reminder_24h" : "reminder_2h";

    const client = appt.clients;
    const locale: "en" | "ar" = client.locale ?? "en";
    const service = appt.services;

    const serviceName =
      locale === "ar"
        ? (service?.name_ar ?? service?.name_en ?? "Service")
        : (service?.name_en ?? "Service");

    const staffName =
      (appt.staff_profiles as unknown as { profiles?: { full_name?: string | null } } | null)
        ?.profiles?.full_name ?? undefined;

    const price = service?.price
      ? `${service.price.toLocaleString(locale === "ar" ? "ar-SA" : "en-US")} ${CURRENCY}`
      : undefined;

    const templateData: TemplateData = {
      clientName: client.full_name,
      serviceName,
      startAt: appt.start_at,
      bookingRef: appt.public_token ?? undefined,
      staffName: staffName ?? undefined,
      location: "Shiny Beauty Center",
      price,
    };

    // The user_id we store on notifications — fall back to a synthetic value
    // when client is a walk-in (no user_id). We need a valid profile.id FK.
    // We skip notifications for walk-ins without an email/phone.
    const userId = client.user_id;
    if (!userId) continue; // walk-ins without accounts are skipped

    // ---- DEDUP: check if this reminder was already sent ------------------
    const { data: existing } = await db
      .from("notifications")
      .select("id, status")
      .eq("user_id", userId)
      .eq("subject", `${sentinel}:${appt.id}`)
      .maybeSingle();

    if (existing) {
      // Already recorded (sent or pending) — skip
      stats.skipped++;
      continue;
    }

    // ---- Insert a PENDING sentinel row to claim this reminder ----------
    const { error: insertErr } = await db.from("notifications").insert({
      user_id: userId,
      channel: "in_app", // neutral channel for the dedup record
      status: "pending",
      subject: `${sentinel}:${appt.id}`,
      body: `Reminder ${reminderType} for appointment ${appt.id}`,
    });

    if (insertErr) {
      // Unique constraint violation = another process beat us — skip
      if (insertErr.code === "23505") {
        stats.skipped++;
        continue;
      }
      console.error("[cron:reminders] insert dedup row:", insertErr.message);
      stats.errors++;
      continue;
    }

    // ---- Send notifications -------------------------------------------
    const sends: Promise<unknown>[] = [];

    if (client.email) {
      sends.push(
        send({
          channel: "email",
          to: client.email,
          template: templateId,
          data: templateData,
          locale,
        })
      );
    }

    if (client.phone) {
      sends.push(
        send({
          channel: "whatsapp",
          to: client.phone,
          template: templateId,
          data: templateData,
          locale,
        })
      );
    }

    const results = await Promise.allSettled(sends);
    const anyOk = results.some(
      (r) => r.status === "fulfilled" && (r.value as { ok?: boolean })?.ok !== false
    );

    // Update the sentinel row to reflect outcome
    await db
      .from("notifications")
      .update({
        status: anyOk ? "sent" : "failed",
        sent_at: anyOk ? new Date().toISOString() : null,
      })
      .eq("user_id", userId)
      .eq("subject", `${sentinel}:${appt.id}`);

    if (anyOk) {
      stats.sent++;
      console.log(
        `[cron:reminders] ${reminderType} reminder sent for appointment ${appt.id}`
      );
    } else {
      stats.errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: rows.length,
    ...stats,
    timestamp: now.toISOString(),
  });
}
