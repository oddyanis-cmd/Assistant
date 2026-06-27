/**
 * Tap Payments (Qatar/Gulf) — server-only helper module.
 *
 * Design rules:
 *  - Client is lazily constructed; never instantiated when paymentsEnabled is
 *    false or when TAP_SECRET_KEY is missing. Any call to getTapClient() while
 *    the flag is off throws a clear error so callers know to guard the flag.
 *  - Raw HTTP (fetch) — no Tap SDK package required.
 *  - Webhook signature verified with HMAC-SHA256 over the raw request body.
 *  - Never import this file client-side; "use server" annotations are on the
 *    calling server actions, not here, to keep this module importable by
 *    route handlers too.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { featureFlags } from "@/lib/config";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getTapSecretKey(): string {
  const key = process.env.TAP_SECRET_KEY ?? "";
  if (!key) throw new Error("TAP_SECRET_KEY is not set");
  return key;
}

function getTapWebhookSecret(): string {
  const secret = process.env.TAP_WEBHOOK_SECRET ?? "";
  if (!secret) throw new Error("TAP_WEBHOOK_SECRET is not set");
  return secret;
}

const TAP_API_BASE = "https://api.tap.company/v2";

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

/**
 * Returns true only when paymentsEnabled AND TAP_SECRET_KEY is present.
 * Use this to short-circuit in contexts where you can't throw.
 */
export function isTapReady(): boolean {
  return featureFlags.paymentsEnabled && Boolean(process.env.TAP_SECRET_KEY);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TapChargeSource {
  /** "src_all" accepts all payment methods; pass a specific token for cards */
  id: string;
}

export interface CreateChargeParams {
  amount: number;
  currency: string;
  /** Customer details */
  customer: {
    first_name: string;
    last_name?: string;
    email?: string;
    phone?: { country_code: string; number: string };
  };
  /** Short description shown on the payment page */
  description: string;
  /** URL Tap redirects the browser to after payment */
  redirect_url: string;
  /** Arbitrary metadata stored on the Tap charge */
  metadata?: Record<string, string>;
  /** Payment source — defaults to "src_all" (card + wallet) */
  source?: TapChargeSource;
}

export interface TapCharge {
  id: string;
  status: string;
  amount: number;
  currency: string;
  transaction: { url?: string };
  redirect: { url?: string };
  metadata?: Record<string, string>;
}

export interface TapWebhookPayload {
  id: string;
  status: "CAPTURED" | "AUTHORIZED" | "FAILED" | "CANCELLED" | string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
  // Tap sends many more fields; we only care about the above
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Low-level fetch wrapper
// ---------------------------------------------------------------------------

async function tapFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const secretKey = getTapSecretKey();
  const res = await fetch(`${TAP_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secretKey}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`Tap API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Create a charge
// ---------------------------------------------------------------------------

/**
 * Creates a Tap charge and returns the full charge object.
 * The caller must redirect the user to charge.transaction.url.
 *
 * Only call this when isTapReady() === true.
 */
export async function createTapCharge(params: CreateChargeParams): Promise<TapCharge> {
  if (!featureFlags.paymentsEnabled) {
    throw new Error("Tap Payments: paymentsEnabled flag is off");
  }

  const body = {
    amount: params.amount,
    currency: params.currency,
    customer: params.customer,
    description: params.description,
    redirect: { url: params.redirect_url },
    source: params.source ?? { id: "src_all" },
    post: { url: null }, // Tap webhook URL is configured in the Tap dashboard
    metadata: params.metadata ?? {},
    // Three-domain secure — required for Qatar
    "3ds": true,
    save_card: false,
  };

  return tapFetch<TapCharge>("/charges", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Retrieve a charge by ID
// ---------------------------------------------------------------------------

export async function getTapCharge(chargeId: string): Promise<TapCharge> {
  if (!featureFlags.paymentsEnabled) {
    throw new Error("Tap Payments: paymentsEnabled flag is off");
  }
  return tapFetch<TapCharge>(`/charges/${chargeId}`);
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verifies the Tap webhook HMAC-SHA256 signature.
 *
 * Tap sends the signature in the `hashstring` field of the JSON body
 * (not a separate header). The hash is computed over a concatenated string
 * of specific fields. See Tap docs: "Webhook hashstring calculation".
 *
 * This implementation verifies the `hashstring` field included in the body
 * against an HMAC-SHA256 over the raw body bytes (the full JSON string),
 * keyed with TAP_WEBHOOK_SECRET — which is how Tap's webhook security works
 * when "Webhook Secret" is configured in the Tap dashboard.
 *
 * Returns the parsed payload on success; throws on bad signature.
 */
export function verifyTapWebhook(
  rawBody: string,
  signatureHeader: string | null
): TapWebhookPayload {
  const secret = getTapWebhookSecret();

  if (!signatureHeader) {
    throw new Error("Missing Tap webhook signature");
  }

  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  // Constant-time compare
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(signatureHeader, "hex");

  if (
    expectedBuf.length !== receivedBuf.length ||
    !timingSafeEqual(expectedBuf, receivedBuf)
  ) {
    throw new Error("Invalid Tap webhook signature");
  }

  return JSON.parse(rawBody) as TapWebhookPayload;
}

// ---------------------------------------------------------------------------
// Booking-specific helper
// ---------------------------------------------------------------------------

/**
 * How much to charge for a booking.
 *
 * Policy (controlled via env, default = full price):
 *   TAP_CHARGE_MODE = "deposit"  → charge TAP_DEPOSIT_PERCENT % (default 30 %)
 *   TAP_CHARGE_MODE = "full"     → charge full service price
 */
export function resolveChargeAmount(servicePrice: number): {
  amount: number;
  isDeposit: boolean;
} {
  const mode = (process.env.TAP_CHARGE_MODE ?? "full").toLowerCase();
  if (mode === "deposit") {
    const pct = Number(process.env.TAP_DEPOSIT_PERCENT ?? "30");
    const safePct = Number.isFinite(pct) && pct > 0 && pct <= 100 ? pct : 30;
    const deposit = Math.round((servicePrice * safePct) / 100 * 100) / 100;
    return { amount: deposit, isDeposit: true };
  }
  return { amount: servicePrice, isDeposit: false };
}
