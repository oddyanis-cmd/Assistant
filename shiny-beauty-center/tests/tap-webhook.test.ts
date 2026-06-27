/**
 * Tests for verifyTapWebhook and resolveChargeAmount in src/lib/payments/tap.ts
 *
 * No network calls — crypto is stdlib, featureFlags is read from process.env.
 */

import { createHmac } from "crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

// We must set TAP_WEBHOOK_SECRET before importing so getTapWebhookSecret()
// finds a value. Use a dynamic import inside each helper that re-imports after
// env is set. Instead, pre-set the env before the module is first loaded.
const TEST_SECRET = "test-webhook-secret-key";
const TEST_RAW_BODY = JSON.stringify({
  id: "chg_abc123",
  status: "CAPTURED",
  amount: 250,
  currency: "SAR",
  metadata: { appointment_id: "appt-xyz" },
});

function makeSignature(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

// Set the env before any import so the module-level getTapWebhookSecret() sees it
process.env.TAP_WEBHOOK_SECRET = TEST_SECRET;
// featureFlags.paymentsEnabled reads NEXT_PUBLIC_PAYMENTS_ENABLED; we don't
// need it for verifyTapWebhook or resolveChargeAmount, but set it clean.
delete process.env.NEXT_PUBLIC_PAYMENTS_ENABLED;

// Now we can import (vitest runs top-level imports after vi.mock calls, but
// since we have no vi.mock here, direct import is fine).
import { verifyTapWebhook, resolveChargeAmount } from "@/lib/payments/tap";

// ---------------------------------------------------------------------------
// verifyTapWebhook — signature verification
// ---------------------------------------------------------------------------

describe("verifyTapWebhook — signature verification", () => {
  it("returns parsed payload when signature is valid", () => {
    const sig = makeSignature(TEST_SECRET, TEST_RAW_BODY);
    const payload = verifyTapWebhook(TEST_RAW_BODY, sig);
    expect(payload.id).toBe("chg_abc123");
    expect(payload.status).toBe("CAPTURED");
    expect(payload.amount).toBe(250);
    expect(payload.currency).toBe("SAR");
  });

  it("throws when signature header is null (missing)", () => {
    expect(() => verifyTapWebhook(TEST_RAW_BODY, null)).toThrow(
      "Missing Tap webhook signature"
    );
  });

  it("throws when signature header is empty string", () => {
    // empty string is treated same as missing (null guard rejects null, but
    // an empty hex string will be a different length after Buffer.from)
    // The code checks `!signatureHeader` — empty string is falsy
    expect(() => verifyTapWebhook(TEST_RAW_BODY, "")).toThrow(
      "Missing Tap webhook signature"
    );
  });

  it("throws when body has been tampered with (body differs, same signature)", () => {
    const validSig = makeSignature(TEST_SECRET, TEST_RAW_BODY);
    const tamperedBody = TEST_RAW_BODY.replace("CAPTURED", "FAILED");
    expect(() => verifyTapWebhook(tamperedBody, validSig)).toThrow(
      "Invalid Tap webhook signature"
    );
  });

  it("throws when signature uses wrong secret key", () => {
    const wrongSig = makeSignature("wrong-secret", TEST_RAW_BODY);
    expect(() => verifyTapWebhook(TEST_RAW_BODY, wrongSig)).toThrow(
      "Invalid Tap webhook signature"
    );
  });

  it("throws when signature is a plausible-length but random hex string", () => {
    const randomHex = "a".repeat(64); // 32-byte hex, correct length but wrong value
    expect(() => verifyTapWebhook(TEST_RAW_BODY, randomHex)).toThrow(
      "Invalid Tap webhook signature"
    );
  });

  it("throws when received signature is wrong length (prevents length-extension bypass)", () => {
    const shortSig = "deadbeef"; // shorter than a SHA-256 hex digest
    expect(() => verifyTapWebhook(TEST_RAW_BODY, shortSig)).toThrow(
      "Invalid Tap webhook signature"
    );
  });

  it("valid signature on a minimal JSON body (no extra fields)", () => {
    const minimalBody = JSON.stringify({ id: "chg_min", status: "AUTHORIZED", amount: 100, currency: "SAR" });
    const sig = makeSignature(TEST_SECRET, minimalBody);
    const payload = verifyTapWebhook(minimalBody, sig);
    expect(payload.status).toBe("AUTHORIZED");
  });

  it("is timing-safe: throws for a one-char-off signature", () => {
    const validSig = makeSignature(TEST_SECRET, TEST_RAW_BODY);
    // flip the first hex nibble
    const flipped = (validSig[0] === "a" ? "b" : "a") + validSig.slice(1);
    expect(() => verifyTapWebhook(TEST_RAW_BODY, flipped)).toThrow(
      "Invalid Tap webhook signature"
    );
  });
});

// ---------------------------------------------------------------------------
// resolveChargeAmount — deposit vs full price logic
// ---------------------------------------------------------------------------

describe("resolveChargeAmount — deposit vs full mode", () => {
  const originalMode = process.env.TAP_CHARGE_MODE;
  const originalPct = process.env.TAP_DEPOSIT_PERCENT;

  afterEach(() => {
    // Restore env after each test
    if (originalMode === undefined) {
      delete process.env.TAP_CHARGE_MODE;
    } else {
      process.env.TAP_CHARGE_MODE = originalMode;
    }
    if (originalPct === undefined) {
      delete process.env.TAP_DEPOSIT_PERCENT;
    } else {
      process.env.TAP_DEPOSIT_PERCENT = originalPct;
    }
  });

  it("returns full service price when mode is unset (default)", () => {
    delete process.env.TAP_CHARGE_MODE;
    const result = resolveChargeAmount(300);
    expect(result.amount).toBe(300);
    expect(result.isDeposit).toBe(false);
  });

  it("returns full price when mode is explicitly 'full'", () => {
    process.env.TAP_CHARGE_MODE = "full";
    const result = resolveChargeAmount(150);
    expect(result.amount).toBe(150);
    expect(result.isDeposit).toBe(false);
  });

  it("returns 30% deposit when mode is 'deposit' with no TAP_DEPOSIT_PERCENT set", () => {
    process.env.TAP_CHARGE_MODE = "deposit";
    delete process.env.TAP_DEPOSIT_PERCENT;
    const result = resolveChargeAmount(100);
    // 30% of 100 = 30
    expect(result.amount).toBe(30);
    expect(result.isDeposit).toBe(true);
  });

  it("respects custom TAP_DEPOSIT_PERCENT", () => {
    process.env.TAP_CHARGE_MODE = "deposit";
    process.env.TAP_DEPOSIT_PERCENT = "50";
    const result = resolveChargeAmount(200);
    // 50% of 200 = 100
    expect(result.amount).toBe(100);
    expect(result.isDeposit).toBe(true);
  });

  it("falls back to 30% when TAP_DEPOSIT_PERCENT is zero (invalid)", () => {
    process.env.TAP_CHARGE_MODE = "deposit";
    process.env.TAP_DEPOSIT_PERCENT = "0"; // invalid: pct must be > 0
    const result = resolveChargeAmount(100);
    expect(result.amount).toBe(30); // falls back to 30%
    expect(result.isDeposit).toBe(true);
  });

  it("falls back to 30% when TAP_DEPOSIT_PERCENT is > 100 (invalid)", () => {
    process.env.TAP_CHARGE_MODE = "deposit";
    process.env.TAP_DEPOSIT_PERCENT = "150";
    const result = resolveChargeAmount(100);
    expect(result.amount).toBe(30);
    expect(result.isDeposit).toBe(true);
  });

  it("falls back to 30% when TAP_DEPOSIT_PERCENT is non-numeric", () => {
    process.env.TAP_CHARGE_MODE = "deposit";
    process.env.TAP_DEPOSIT_PERCENT = "abc";
    const result = resolveChargeAmount(100);
    expect(result.amount).toBe(30);
    expect(result.isDeposit).toBe(true);
  });

  it("rounds deposit to 2 decimal places", () => {
    process.env.TAP_CHARGE_MODE = "deposit";
    process.env.TAP_DEPOSIT_PERCENT = "30";
    // 30% of 333.33 = 99.999 → rounds to 100
    const result = resolveChargeAmount(333.33);
    // Math.round(333.33 * 30 / 100 * 100) / 100 = Math.round(9999.9) / 100 = 10000/100 = 100
    expect(result.amount).toBe(100);
    expect(result.isDeposit).toBe(true);
  });

  it("deposit mode is case-insensitive (DEPOSIT uppercased)", () => {
    process.env.TAP_CHARGE_MODE = "DEPOSIT";
    delete process.env.TAP_DEPOSIT_PERCENT;
    const result = resolveChargeAmount(200);
    expect(result.amount).toBe(60); // 30% of 200
    expect(result.isDeposit).toBe(true);
  });
});
