/**
 * WhatsApp provider adapter — WATI (primary).
 *
 * WATI is a WhatsApp Business API SaaS provider popular in the Gulf region.
 * It sends messages via a simple REST POST to a WATI endpoint with an access token.
 *
 * Design:
 *  - Lazily sends only when notificationsEnabled AND keys are present.
 *  - No-op (log only) when flag is off or keys are missing.
 *  - Uses the "send text message" API (not template messages), which works for
 *    transactional messages once the 24h window is open or the number is whitelisted.
 *
 * Required env vars:
 *   WATI_API_ENDPOINT    e.g. https://live-mt-server.wati.io/123456
 *   WATI_ACCESS_TOKEN    Bearer token from WATI dashboard
 */

import { featureFlags } from "@/lib/config";
import type { SendResult } from "./types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function isWatiConfigured(): boolean {
  return (
    Boolean(process.env.WATI_API_ENDPOINT) &&
    Boolean(process.env.WATI_ACCESS_TOKEN)
  );
}

export function isWhatsAppConfigured(): boolean {
  return isWatiConfigured();
}

// ---------------------------------------------------------------------------
// WATI adapter
// ---------------------------------------------------------------------------

async function sendViaWati(to: string, body: string): Promise<SendResult> {
  const endpoint = process.env.WATI_API_ENDPOINT!.replace(/\/$/, "");
  const token = process.env.WATI_ACCESS_TOKEN!;

  // WATI expects the phone number without the leading "+"
  const phone = to.startsWith("+") ? to.slice(1) : to;

  // WATI "Send Session Message" endpoint
  const url = `${endpoint}/api/v1/sendSessionMessage/${phone}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messageText: body }),
    });

    if (!res.ok) {
      const responseBody = await res.text().catch(() => "(unreadable)");
      return { ok: false, error: `WATI ${res.status}: ${responseBody}` };
    }

    const data = (await res.json()) as { id?: string; result?: boolean };
    return { ok: true, externalId: data.id ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `WATI fetch error: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function sendWhatsApp(
  to: string,
  body: string
): Promise<SendResult> {
  // Flag-off → no-op
  if (!featureFlags.notificationsEnabled) {
    console.log(
      `[notify:whatsapp] flag off — would send to ${to} (${body.slice(0, 60)}…)`
    );
    return { ok: true, externalId: null };
  }

  if (!isWhatsAppConfigured()) {
    console.warn(
      `[notify:whatsapp] WATI not configured (set WATI_API_ENDPOINT + WATI_ACCESS_TOKEN) — skipping`
    );
    return { ok: true, externalId: null };
  }

  const result = await sendViaWati(to, body);
  if (!result.ok) {
    console.error(`[notify:whatsapp] WATI error:`, result.error);
  }
  return result;
}
