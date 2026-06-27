/**
 * Tests for the pure TypeScript helpers in src/lib/auth.ts:
 *   - can(user, permission)
 *   - assertPermission(user, permission)
 *
 * The RBAC merge logic (role perms + individual grants, minus revokes) lives
 * in getCurrentUserWithPermissions() which requires a live Supabase client.
 * We test the observable contract of that merge through the `permissions`
 * array on AuthUser — constructing AuthUser instances directly without any DB.
 *
 * The SQL-level RBAC (has_permission Postgres function) is verified separately
 * against Postgres. The tests here confirm the TS layer enforces the same rules.
 */

import { describe, it, expect } from "vitest";
import { can, assertPermission, PERMISSIONS } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

function makeUser(permissions: string[]): AuthUser {
  return {
    id: "user-1",
    email: "test@example.com",
    profile: null,
    roles: [],
    permissions,
  };
}

// ---------------------------------------------------------------------------
// can()
// ---------------------------------------------------------------------------

describe("can() — permission check", () => {
  it("returns false for null user", () => {
    expect(can(null, PERMISSIONS.VIEW_ALL_BOOKINGS)).toBe(false);
  });

  it("returns false for user with no permissions", () => {
    const user = makeUser([]);
    expect(can(user, PERMISSIONS.VIEW_ALL_BOOKINGS)).toBe(false);
  });

  it("returns true when the user holds the exact permission", () => {
    const user = makeUser([PERMISSIONS.VIEW_ALL_BOOKINGS]);
    expect(can(user, PERMISSIONS.VIEW_ALL_BOOKINGS)).toBe(true);
  });

  it("returns false when the user holds a different permission", () => {
    const user = makeUser([PERMISSIONS.VIEW_OWN_BOOKINGS]);
    expect(can(user, PERMISSIONS.VIEW_ALL_BOOKINGS)).toBe(false);
  });

  it("returns true for one of multiple permissions the user holds", () => {
    const user = makeUser([
      PERMISSIONS.VIEW_OWN_BOOKINGS,
      PERMISSIONS.VIEW_ALL_BOOKINGS,
      PERMISSIONS.CREATE_BOOKING,
    ]);
    expect(can(user, PERMISSIONS.VIEW_ALL_BOOKINGS)).toBe(true);
    expect(can(user, PERMISSIONS.CREATE_BOOKING)).toBe(true);
  });

  it("does NOT grant a permission that is not in the list", () => {
    const user = makeUser([PERMISSIONS.VIEW_OWN_BOOKINGS, PERMISSIONS.CREATE_BOOKING]);
    expect(can(user, PERMISSIONS.CANCEL_BOOKING)).toBe(false);
  });

  it("is case-sensitive (VIEW_ALL_BOOKINGS !== view_all_bookings mixed case)", () => {
    // The permissions list uses snake_case strings; a raw string that isn't in
    // PERMISSIONS won't match
    const user = makeUser(["VIEW_ALL_BOOKINGS"]); // wrong case stored
    expect(can(user, PERMISSIONS.VIEW_ALL_BOOKINGS)).toBe(false); // "view_all_bookings"
  });
});

// ---------------------------------------------------------------------------
// RBAC merge invariants (simulated via `permissions` array construction)
//
// The merge logic in getCurrentUserWithPermissions():
//   effective = (role_perms ∪ explicit_grants) − explicit_revokes
//
// These tests simulate each scenario by passing the expected resulting
// `permissions` array and verifying can() / assertPermission() behave correctly.
// ---------------------------------------------------------------------------

describe("RBAC merge: revoke wins over role + grant", () => {
  it("revoke removes a role-granted permission", () => {
    // Role has CANCEL_BOOKING but it was individually revoked → not in list
    const user = makeUser([PERMISSIONS.VIEW_OWN_BOOKINGS]); // CANCEL_BOOKING missing
    expect(can(user, PERMISSIONS.CANCEL_BOOKING)).toBe(false);
  });

  it("explicit grant adds a permission not in any role", () => {
    // No roles, but EXPORT_REPORTS was individually granted
    const user = makeUser([PERMISSIONS.EXPORT_REPORTS]);
    expect(can(user, PERMISSIONS.EXPORT_REPORTS)).toBe(true);
  });

  it("user with both VIEW_ALL_BOOKINGS and CANCEL_BOOKING (typical staff role)", () => {
    const user = makeUser([
      PERMISSIONS.VIEW_ALL_BOOKINGS,
      PERMISSIONS.CANCEL_BOOKING,
      PERMISSIONS.CONFIRM_BOOKING,
    ]);
    expect(can(user, PERMISSIONS.VIEW_ALL_BOOKINGS)).toBe(true);
    expect(can(user, PERMISSIONS.CANCEL_BOOKING)).toBe(true);
    expect(can(user, PERMISSIONS.MANAGE_PAYROLL)).toBe(false); // admin-only
  });
});

// ---------------------------------------------------------------------------
// assertPermission()
// ---------------------------------------------------------------------------

describe("assertPermission()", () => {
  it("does not throw when user holds the permission", () => {
    const user = makeUser([PERMISSIONS.EXPORT_REPORTS]);
    expect(() => assertPermission(user, PERMISSIONS.EXPORT_REPORTS)).not.toThrow();
  });

  it("throws when user does not hold the permission", () => {
    const user = makeUser([PERMISSIONS.VIEW_OWN_BOOKINGS]);
    expect(() => assertPermission(user, PERMISSIONS.EXPORT_REPORTS)).toThrow(
      "Forbidden: missing permission 'export_reports'"
    );
  });

  it("throws when user is null", () => {
    expect(() => assertPermission(null, PERMISSIONS.VIEW_DASHBOARD)).toThrow(
      "Forbidden: missing permission 'view_dashboard'"
    );
  });

  it("error message includes the permission key for debugging", () => {
    const user = makeUser([]);
    let errorMsg = "";
    try {
      assertPermission(user, PERMISSIONS.MANAGE_PAYROLL);
    } catch (e) {
      errorMsg = (e as Error).message;
    }
    expect(errorMsg).toContain("manage_payroll");
  });
});

// ---------------------------------------------------------------------------
// PERMISSIONS constant completeness
// ---------------------------------------------------------------------------

describe("PERMISSIONS constant", () => {
  it("all permission values are non-empty lowercase strings", () => {
    for (const [key, val] of Object.entries(PERMISSIONS)) {
      expect(typeof val, `${key} value type`).toBe("string");
      expect(val.length, `${key} is non-empty`).toBeGreaterThan(0);
      expect(val, `${key} is lowercase`).toBe(val.toLowerCase());
    }
  });

  it("no two permission keys share the same value", () => {
    const values = Object.values(PERMISSIONS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
