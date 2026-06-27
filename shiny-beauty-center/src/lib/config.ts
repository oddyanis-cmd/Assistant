/**
 * Central feature-flag + runtime config module.
 *
 * All env reads are isolated here so nothing else crashes on missing values
 * during `next build` without a live Supabase instance.
 */

function envFlag(key: string, fallback = false): boolean {
  const val = process.env[key];
  if (val === undefined || val === "") return fallback;
  return val === "true" || val === "1";
}

function envString(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

// ---- Feature flags --------------------------------------------------------
export const featureFlags = {
  /** Phase 3: Tap Payments integration */
  paymentsEnabled: envFlag("NEXT_PUBLIC_PAYMENTS_ENABLED", false),
  /** Phase 4: WhatsApp / WATI push notifications */
  notificationsEnabled: envFlag("NEXT_PUBLIC_NOTIFICATIONS_ENABLED", false),
} as const;

export type FeatureFlags = typeof featureFlags;

// ---- Supabase connection ---------------------------------------------------
export const supabaseConfig = {
  url: envString("NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: envString("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRoleKey: envString("SUPABASE_SERVICE_ROLE_KEY"),
} as const;

/** Returns true only when Supabase env vars are present (non-empty). */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey);
}

// ---- Tap Payments ---------------------------------------------------------
/**
 * Returns the Tap publishable key for client-side use (NEXT_PUBLIC_*).
 * Safe to call at build time — returns empty string when not set.
 */
export const tapConfig = {
  publicKey: envString("NEXT_PUBLIC_TAP_PUBLIC_KEY"),
} as const;

/** True only when both the flag AND the publishable key are present. */
export function isTapClientConfigured(): boolean {
  return featureFlags.paymentsEnabled && Boolean(tapConfig.publicKey);
}

// ---- App ------------------------------------------------------------------
export const appConfig = {
  url: envString("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  name: "Shiny Beauty Center",
  tagline: "Luxury Beauty, Exclusively for Women",
  defaultLocale: "en" as const,
  locales: ["en", "ar"] as const,
} as const;

export type AppLocale = (typeof appConfig.locales)[number];

// ---- Currency (single source of truth) ------------------------------------
/**
 * All charges, stored amounts, and UI labels use this currency.
 * Defaults to QAR (Qatari Riyal) — the currency for this Qatar salon.
 * Override via TAP_CURRENCY env var if needed.
 */
export const CURRENCY: string = process.env.TAP_CURRENCY ?? "QAR";
