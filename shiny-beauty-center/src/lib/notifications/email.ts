/**
 * Email provider adapter — Resend (primary) with fallback SMTP via nodemailer.
 *
 * Design:
 *  - Lazily constructed: the SDK/client is only imported + instantiated on the
 *    first real send call, never at module load time.
 *  - No-op (log only) when notificationsEnabled is false or keys are missing.
 *  - Supports Resend (RESEND_API_KEY) and SMTP (SMTP_HOST / SMTP_USER / SMTP_PASS).
 *    Resend takes precedence when both are configured.
 *  - Never crashes the server if env vars are absent.
 *
 * Required env vars:
 *   EMAIL_FROM          sender address, e.g. "Shiny Beauty <hello@shinybeauty.com>"
 *   RESEND_API_KEY      for Resend (preferred)
 *   -- OR --
 *   SMTP_HOST           for SMTP
 *   SMTP_PORT           (optional, default 587)
 *   SMTP_USER
 *   SMTP_PASS
 */

import { featureFlags } from "@/lib/config";
import type { SendResult } from "./types";

// ---------------------------------------------------------------------------
// Security helpers (H3)
// ---------------------------------------------------------------------------

/**
 * Strip CR and LF from any string that will be placed in an email header.
 * Without this, user-controlled subjects/recipients can inject additional
 * headers (header injection / email injection attack).
 */
function stripHeaderChars(value: string): string {
  return value.replace(/[\r\n]/g, " ");
}

/**
 * Validate that a recipient address looks like a plausible email.
 * This is a basic sanity check — the transport layer does the real validation.
 * The main goal is to catch obvious injection attempts (e.g. values containing
 * newlines that passed through stripHeaderChars as spaces).
 */
function isValidEmail(address: string): boolean {
  // RFC 5322-ish: local@domain, both parts non-empty, domain has at least one dot
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.EMAIL_FROM);
}

function isSmtpConfigured(): boolean {
  return (
    Boolean(process.env.SMTP_HOST) &&
    Boolean(process.env.SMTP_USER) &&
    Boolean(process.env.SMTP_PASS) &&
    Boolean(process.env.EMAIL_FROM)
  );
}

export function isEmailConfigured(): boolean {
  return isResendConfigured() || isSmtpConfigured();
}

// ---------------------------------------------------------------------------
// Resend adapter
// ---------------------------------------------------------------------------

async function sendViaResend(
  to: string,
  subject: string,
  html: string
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY!;
  const from = process.env.EMAIL_FROM!;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      return { ok: false, error: `Resend ${res.status}: ${body}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, externalId: data.id ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Resend fetch error: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// SMTP adapter (nodemailer — optional dependency, dynamic import)
// ---------------------------------------------------------------------------

async function sendViaSmtp(
  to: string,
  subject: string,
  html: string
): Promise<SendResult> {
  let nodemailer: typeof import("nodemailer");
  try {
    nodemailer = await import("nodemailer");
  } catch {
    return {
      ok: false,
      error: "nodemailer is not installed. Run: npm install nodemailer",
    };
  }

  const from = process.env.EMAIL_FROM!;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    });

    const info = await transporter.sendMail({ from, to, subject, html });
    return { ok: true, externalId: (info as { messageId?: string }).messageId ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `SMTP error: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<SendResult> {
  // Flag-off / keys-missing → no-op (log only)
  if (!featureFlags.notificationsEnabled) {
    console.log(
      `[notify:email] flag off — would send to ${to}: ${subject}`
    );
    return { ok: true, externalId: null };
  }

  if (!isEmailConfigured()) {
    console.warn(
      `[notify:email] no email provider configured (set RESEND_API_KEY or SMTP_* + EMAIL_FROM) — skipping`
    );
    return { ok: true, externalId: null };
  }

  // H3 FIX: Validate recipient address and strip header-injection characters
  // from header-bound fields before passing to any transport.
  if (!isValidEmail(to)) {
    console.error(`[notify:email] invalid recipient address — refusing send`);
    return { ok: false, error: "Invalid recipient email address" };
  }
  const safeSubject = stripHeaderChars(subject);

  if (isResendConfigured()) {
    const result = await sendViaResend(to, safeSubject, html);
    if (!result.ok) {
      console.error(`[notify:email] Resend error:`, result.error);
    }
    return result;
  }

  const result = await sendViaSmtp(to, safeSubject, html);
  if (!result.ok) {
    console.error(`[notify:email] SMTP error:`, result.error);
  }
  return result;
}
