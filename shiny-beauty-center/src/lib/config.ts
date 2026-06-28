/**
 * Central feature-flag + runtime config module.
 *
 * IMPORTANT: NEXT_PUBLIC_* vars MUST be read via STATIC member access
 * (`process.env.NEXT_PUBLIC_X`) so Next.js inlines them into the client
 * bundle at build time. A dynamic lookup (`process.env[key]`) is NOT inlined
 * and is `undefined` in the browser — which makes the Supabase client appear
 * "not configured" on the client even when the vars are set.
 */

function parseFlag(val: string | undefined, fallback = false): boolean {
  if (val === undefined || val === "") return fallback;
  return val === "true" || val === "1";
}

// ---- Feature flags --------------------------------------------------------
export const featureFlags = {
  /** Phase 3: Tap Payments integration */
  paymentsEnabled: parseFlag(process.env.NEXT_PUBLIC_PAYMENTS_ENABLED, false),
  /** Phase 4: WhatsApp / WATI push notifications */
  notificationsEnabled: parseFlag(process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED, false),
} as const;

export type FeatureFlags = typeof featureFlags;

// ---- Supabase connection ---------------------------------------------------
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
} as const;

/** Returns true only when Supabase env vars are present (non-empty). */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey);
}

// ---- Tap Payments ---------------------------------------------------------
/**
 * Tap publishable key for client-side use (NEXT_PUBLIC_*).
 * Safe at build time — empty string when not set.
 */
export const tapConfig = {
  publicKey: process.env.NEXT_PUBLIC_TAP_PUBLIC_KEY ?? "",
} as const;

/** True only when both the flag AND the publishable key are present. */
export function isTapClientConfigured(): boolean {
  return featureFlags.paymentsEnabled && Boolean(tapConfig.publicKey);
}

// ---- App ------------------------------------------------------------------
export const appConfig = {
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  name: "Shiny Beauty Center",
  tagline: "Luxury Beauty, Exclusively for Women",
  defaultLocale: "en" as const,
  locales: ["en", "ar"] as const,
} as const;

export type AppLocale = (typeof appConfig.locales)[number];

// ---- Currency (single source of truth) ------------------------------------
/**
 * All charges, stored amounts, and UI labels use this currency.
 * Defaults to QAR (Qatari Riyal). Override via TAP_CURRENCY (server-only).
 */
export const CURRENCY: string = process.env.TAP_CURRENCY ?? "QAR";
