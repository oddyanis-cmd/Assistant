/**
 * Unified notification send() entry point.
 *
 * Usage:
 *   import { send } from "@/lib/notifications/send";
 *
 *   await send({
 *     channel: "email",
 *     to: "client@example.com",
 *     template: "booking_confirmed",
 *     data: { clientName: "Sarah", serviceName: "Facial", startAt: iso },
 *     locale: "en",
 *   });
 *
 * When notificationsEnabled is false, or the relevant provider is not
 * configured, this is a safe no-op (logs to console, never throws).
 */

import { sendEmail } from "./email";
import { sendWhatsApp } from "./whatsapp";
import { renderEmailTemplate, renderWhatsAppTemplate } from "./templates";
import type { SendParams, SendResult } from "./types";

export type { SendParams, SendResult };

export async function send(params: SendParams): Promise<SendResult> {
  const locale = params.locale ?? "en";

  try {
    if (params.channel === "email") {
      const { subject, html } = renderEmailTemplate(
        params.template,
        params.data,
        locale
      );
      return await sendEmail(params.to, subject, html);
    }

    if (params.channel === "whatsapp") {
      const body = renderWhatsAppTemplate(params.template, params.data, locale);
      return await sendWhatsApp(params.to, body);
    }

    return { ok: false, error: `Unknown channel: ${params.channel}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[notify:send] Unexpected error:`, msg);
    // Never throw — notification failures must not break booking flows
    return { ok: false, error: msg };
  }
}
