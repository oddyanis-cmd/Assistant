/**
 * Tests for src/lib/config.ts
 *
 * Each describe block isolates env state by re-importing the module with
 * fresh env values. Because vitest caches modules, we use vi.resetModules()
 * and dynamic imports to get fresh module state per env configuration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Snapshot the original env so we can restore it
const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  // Remove all keys we might have touched
  const keys = [
    "NEXT_PUBLIC_PAYMENTS_ENABLED",
    "NEXT_PUBLIC_NOTIFICATIONS_ENABLED",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_TAP_PUBLIC_KEY",
    "NEXT_PUBLIC_APP_URL",
  ];
  for (const k of keys) {
    delete process.env[k];
  }
}

async function loadConfig() {
  vi.resetModules();
  const mod = await import("@/lib/config");
  return mod;
}

describe("featureFlags — off by default", () => {
  beforeEach(resetEnv);
  afterEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
    resetEnv();
  });

  it("paymentsEnabled is false when env var is unset", async () => {
    const { featureFlags } = await loadConfig();
    expect(featureFlags.paymentsEnabled).toBe(false);
  });

  it("notificationsEnabled is false when env var is unset", async () => {
    const { featureFlags } = await loadConfig();
    expect(featureFlags.notificationsEnabled).toBe(false);
  });

  it("paymentsEnabled is false when env var is empty string", async () => {
    process.env.NEXT_PUBLIC_PAYMENTS_ENABLED = "";
    const { featureFlags } = await loadConfig();
    expect(featureFlags.paymentsEnabled).toBe(false);
  });

  it("paymentsEnabled is true when env var is 'true'", async () => {
    process.env.NEXT_PUBLIC_PAYMENTS_ENABLED = "true";
    const { featureFlags } = await loadConfig();
    expect(featureFlags.paymentsEnabled).toBe(true);
  });

  it("paymentsEnabled is true when env var is '1'", async () => {
    process.env.NEXT_PUBLIC_PAYMENTS_ENABLED = "1";
    const { featureFlags } = await loadConfig();
    expect(featureFlags.paymentsEnabled).toBe(true);
  });

  it("paymentsEnabled is false for any other value (e.g. 'yes')", async () => {
    process.env.NEXT_PUBLIC_PAYMENTS_ENABLED = "yes";
    const { featureFlags } = await loadConfig();
    expect(featureFlags.paymentsEnabled).toBe(false);
  });

  it("notificationsEnabled is true when set to 'true'", async () => {
    process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED = "true";
    const { featureFlags } = await loadConfig();
    expect(featureFlags.notificationsEnabled).toBe(true);
  });
});

describe("isSupabaseConfigured", () => {
  beforeEach(resetEnv);
  afterEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
    resetEnv();
  });

  it("returns false when both URL and anon key are absent", async () => {
    const { isSupabaseConfigured } = await loadConfig();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns false when only URL is set", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://xyz.supabase.co";
    const { isSupabaseConfigured } = await loadConfig();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns false when only anon key is set", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "some-anon-key";
    const { isSupabaseConfigured } = await loadConfig();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns true when both URL and anon key are present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://xyz.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "some-anon-key";
    const { isSupabaseConfigured } = await loadConfig();
    expect(isSupabaseConfigured()).toBe(true);
  });
});

describe("isTapClientConfigured", () => {
  beforeEach(resetEnv);
  afterEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
    resetEnv();
  });

  it("returns false when payments flag is off (even with public key set)", async () => {
    // flag off
    process.env.NEXT_PUBLIC_TAP_PUBLIC_KEY = "pk_live_test";
    const { isTapClientConfigured } = await loadConfig();
    expect(isTapClientConfigured()).toBe(false);
  });

  it("returns false when payments flag is on but no public key", async () => {
    process.env.NEXT_PUBLIC_PAYMENTS_ENABLED = "true";
    const { isTapClientConfigured } = await loadConfig();
    expect(isTapClientConfigured()).toBe(false);
  });

  it("returns true only when flag is on AND public key is present", async () => {
    process.env.NEXT_PUBLIC_PAYMENTS_ENABLED = "true";
    process.env.NEXT_PUBLIC_TAP_PUBLIC_KEY = "pk_live_test";
    const { isTapClientConfigured } = await loadConfig();
    expect(isTapClientConfigured()).toBe(true);
  });

  it("tapConfig.publicKey does NOT read TAP_SECRET_KEY (server secret must not leak)", async () => {
    // Verify that the tapConfig only exposes NEXT_PUBLIC_TAP_PUBLIC_KEY
    // and has no reference to the server-side secret key.
    process.env.NEXT_PUBLIC_PAYMENTS_ENABLED = "true";
    process.env.NEXT_PUBLIC_TAP_PUBLIC_KEY = "pk_live_safe";
    process.env.TAP_SECRET_KEY = "sk_live_THIS_SHOULD_NOT_APPEAR";
    const { tapConfig } = await loadConfig();
    // publicKey must equal the NEXT_PUBLIC key, not the secret
    expect(tapConfig.publicKey).toBe("pk_live_safe");
    expect(tapConfig.publicKey).not.toContain("sk_live");
    // tapConfig should not have a secretKey field at all
    expect((tapConfig as Record<string, unknown>).secretKey).toBeUndefined();
  });
});

describe("appConfig defaults", () => {
  beforeEach(resetEnv);
  afterEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
    resetEnv();
  });

  it("url falls back to localhost:3000 when NEXT_PUBLIC_APP_URL is unset", async () => {
    const { appConfig } = await loadConfig();
    expect(appConfig.url).toBe("http://localhost:3000");
  });

  it("url respects NEXT_PUBLIC_APP_URL when set", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://shiny.example.com";
    const { appConfig } = await loadConfig();
    expect(appConfig.url).toBe("https://shiny.example.com");
  });

  it("locales array contains exactly 'en' and 'ar'", async () => {
    const { appConfig } = await loadConfig();
    expect(appConfig.locales).toEqual(["en", "ar"]);
  });

  it("defaultLocale is 'en'", async () => {
    const { appConfig } = await loadConfig();
    expect(appConfig.defaultLocale).toBe("en");
  });
});
