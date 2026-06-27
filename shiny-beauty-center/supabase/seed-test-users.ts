/**
 * Shiny Beauty Center — Test-User Seeder
 *
 * Creates one confirmed Supabase Auth user per role so testers can exercise
 * every role end-to-end without touching production data.
 *
 * USAGE:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   TEST_USER_PASSWORD=ShinyTest123! \
 *   npx tsx supabase/seed-test-users.ts
 *
 * Or via the npm script:
 *   npm run db:seed:test
 *
 * Idempotent: safe to run multiple times. Existing auth users are updated;
 * profile rows are upserted; role assignments use ON CONFLICT DO NOTHING.
 */

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "\nMissing required environment variables.\n" +
    "  NEXT_PUBLIC_SUPABASE_URL  — your Supabase project URL\n" +
    "  SUPABASE_SERVICE_ROLE_KEY — service-role key (Settings → API)\n\n" +
    "Example:\n" +
    "  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \\\n" +
    "  SUPABASE_SERVICE_ROLE_KEY=eyJ... \\\n" +
    "  npx tsx supabase/seed-test-users.ts\n"
  );
  process.exit(1);
}

const PASSWORD = process.env.TEST_USER_PASSWORD ?? "ShinyTest123!";

// ---------------------------------------------------------------------------
// Role UUIDs (must match supabase/seed.sql)
// ---------------------------------------------------------------------------

const ROLES = {
  Admin:   "00000001-0000-0000-0000-000000000001",
  Manager: "00000001-0000-0000-0000-000000000002",
  Staff:   "00000001-0000-0000-0000-000000000007",
  Client:  "00000001-0000-0000-0000-000000000008",
} as const;

// ---------------------------------------------------------------------------
// Test-user definitions
// ---------------------------------------------------------------------------

interface TestUser {
  email: string;
  fullName: string;
  role: keyof typeof ROLES;
  /** Creates staff_profiles + staff_availability rows when true */
  needsStaffProfile: boolean;
}

const TEST_USERS: TestUser[] = [
  {
    email: "admin@shiny.test",
    fullName: "Admin Tester",
    role: "Admin",
    needsStaffProfile: false,
  },
  {
    email: "manager@shiny.test",
    fullName: "Manager Tester",
    role: "Manager",
    needsStaffProfile: false,
  },
  {
    email: "staff@shiny.test",
    fullName: "Staff Tester",
    role: "Staff",
    needsStaffProfile: true,
  },
  {
    email: "client@shiny.test",
    fullName: "Client Tester",
    role: "Client",
    needsStaffProfile: false,
  },
];

// ---------------------------------------------------------------------------
// Supabase admin client (service role — never expose to the browser)
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

async function seedUser(user: TestUser): Promise<{ email: string; userId: string }> {
  const { email, fullName, role, needsStaffProfile } = user;

  // 1. Create or update auth user (email_confirm: true → no email required)
  const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let userId: string;

  if (createErr) {
    // If the user already exists (code 422 / "already registered"), fetch them
    if (
      createErr.message.toLowerCase().includes("already") ||
      createErr.message.toLowerCase().includes("exists") ||
      (createErr as { status?: number }).status === 422
    ) {
      const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);
      const existing = listData?.users?.find((u) => u.email === email);
      if (!existing) throw new Error(`User ${email} exists but could not be found in list`);

      // Update password + confirm status to keep credentials in sync
      const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (updateErr) throw new Error(`updateUserById(${email}): ${updateErr.message}`);

      userId = existing.id;
    } else {
      throw new Error(`createUser(${email}): ${createErr.message}`);
    }
  } else {
    userId = createData.user.id;
  }

  // 2. Upsert profile row
  const { error: profileErr } = await db.from("profiles").upsert(
    { id: userId, full_name: fullName, locale: "en", is_active: true },
    { onConflict: "id" }
  );
  if (profileErr) throw new Error(`profile upsert(${email}): ${profileErr.message}`);

  // 3. Assign role (idempotent)
  const { error: roleErr } = await db
    .from("user_roles")
    .insert({ user_id: userId, role_id: ROLES[role] })
    .select()
    // on conflict do nothing equivalent via upsert
    .throwOnError();

  // Ignore unique-constraint violations (user already has this role)
  if (roleErr && roleErr.code !== "23505") {
    throw new Error(`user_roles insert(${email}): ${roleErr.message}`);
  }

  // 4. Staff-specific rows
  if (needsStaffProfile) {
    // 4a. Upsert staff_profiles row
    const { data: spData, error: spErr } = await db
      .from("staff_profiles")
      .upsert({ user_id: userId, is_active: true }, { onConflict: "user_id" })
      .select("id")
      .single();

    if (spErr) throw new Error(`staff_profiles upsert(${email}): ${spErr.message}`);

    const staffId: string = spData.id;

    // 4b. Upsert staff_availability — Sun–Thu (0–4), 10:00–20:00
    const availabilityRows = [0, 1, 2, 3, 4].map((day) => ({
      staff_id: staffId,
      day_of_week: day,
      start_time: "10:00:00",
      end_time: "20:00:00",
      is_available: true,
    }));

    const { error: avErr } = await db
      .from("staff_availability")
      .upsert(availabilityRows, { onConflict: "staff_id,day_of_week" });

    if (avErr) throw new Error(`staff_availability upsert(${email}): ${avErr.message}`);
  }

  return { email, userId };
}

async function main() {
  console.log("\nShiny Beauty Center — Test-User Seeder");
  console.log("======================================\n");

  const results: Array<{ email: string; role: string; userId: string; status: string }> = [];

  for (const user of TEST_USERS) {
    try {
      const { email, userId } = await seedUser(user);
      results.push({ email, role: user.role, userId, status: "OK" });
      console.log(`  [OK]  ${email}  (${user.role})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ email: user.email, role: user.role, userId: "—", status: `ERROR: ${message}` });
      console.error(`  [ERR] ${user.email}  — ${message}`);
    }
  }

  console.log("\n┌─────────────────────────────────────────────────────────────────────────────┐");
  console.log("│                      Test Credentials Summary                               │");
  console.log("├──────────────────────┬──────────┬──────────────────────────────────────────┤");
  console.log("│ Email                │ Role     │ User ID                                  │");
  console.log("├──────────────────────┬──────────┬──────────────────────────────────────────┤");

  for (const r of results) {
    const emailPad = r.email.padEnd(20);
    const rolePad  = r.role.padEnd(8);
    const idPad    = r.userId.padEnd(40);
    console.log(`│ ${emailPad} │ ${rolePad} │ ${idPad} │`);
  }

  console.log("└──────────────────────┴──────────┴──────────────────────────────────────────┘");
  console.log(`\n  Shared password: ${PASSWORD}`);
  console.log(
    "\n  staff@shiny.test also has:\n" +
    "    • staff_profiles row (is_active=true)\n" +
    "    • staff_availability Sun–Thu 10:00–20:00\n"
  );

  const hasError = results.some((r) => r.status.startsWith("ERROR"));
  if (hasError) {
    console.error("\nOne or more users failed to seed. Check the errors above.\n");
    process.exit(1);
  }

  console.log("Done. All test users are ready.\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
