/**
 * i18n parity test: every key in messages/en.json must exist in
 * messages/ar.json and vice-versa. Nested keys are fully traversed.
 *
 * This catches missing translations before they reach production and cause
 * runtime errors (next-intl throws on missing keys).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const MESSAGES_DIR = path.resolve(__dirname, "../messages");

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null) {
      return flattenKeys(v, full);
    }
    return [full];
  });
}

function loadMessages(locale: string): Record<string, unknown> {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}

const enMessages = loadMessages("en");
const arMessages = loadMessages("ar");

const enKeys = new Set(flattenKeys(enMessages));
const arKeys = new Set(flattenKeys(arMessages));

describe("i18n key parity: en ↔ ar", () => {
  it("every key in en.json exists in ar.json", () => {
    const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));
    expect(missingInAr, `Keys in en.json missing from ar.json:\n${missingInAr.join("\n")}`).toEqual([]);
  });

  it("every key in ar.json exists in en.json", () => {
    const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
    expect(missingInEn, `Keys in ar.json missing from en.json:\n${missingInEn.join("\n")}`).toEqual([]);
  });

  it("both files have at least 50 leaf keys (sanity: not empty)", () => {
    expect(enKeys.size).toBeGreaterThan(50);
    expect(arKeys.size).toBeGreaterThan(50);
  });

  it("en.json and ar.json have the same number of leaf keys", () => {
    expect(enKeys.size).toBe(arKeys.size);
  });
});
