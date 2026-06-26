/**
 * Shiny Beauty Center — Bootstrap first Admin user
 *
 * USAGE:
 *   1. Create the user through Supabase Auth Dashboard or:
 *        const { data } = await supabase.auth.admin.createUser({
 *          email: 'admin@shinybeatuy.sa',
 *          password: 'ChangeMe123!',
 *          email_confirm: true,
 *        });
 *
 *   2. Copy the returned user.id, then run this script:
 *        SUPABASE_SERVICE_ROLE_KEY=sk_... \
 *        NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *        ADMIN_USER_ID=<uuid-from-step-1> \
 *        ADMIN_FULL_NAME="Salon Owner" \
 *        npx ts-node --project tsconfig.json supabase/seed-admin.ts
 *
 *   Or you can run the equivalent SQL directly in the Supabase SQL editor:
 *
 *   -- After creating the auth user, run:
 *   INSERT INTO public.profiles (id, full_name, is_active)
 *   VALUES ('<auth-user-id>', 'Salon Owner', true)
 *   ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
 *
 *   INSERT INTO public.user_roles (user_id, role_id)
 *   VALUES ('<auth-user-id>', '00000001-0000-0000-0000-000000000001')
 *   ON CONFLICT DO NOTHING;
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID!;
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME ?? "Salon Admin";

// Admin role UUID (matches seed.sql)
const ADMIN_ROLE_ID = "00000001-0000-0000-0000-000000000001";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ADMIN_USER_ID) {
  console.error(
    "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USER_ID"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedAdmin() {
  console.log(`Seeding Admin for user ${ADMIN_USER_ID}…`);

  // 1. Upsert profile
  const { error: profileErr } = await supabase
    .from("profiles")
    .upsert({ id: ADMIN_USER_ID, full_name: ADMIN_FULL_NAME, is_active: true });

  if (profileErr) {
    console.error("Profile upsert failed:", profileErr.message);
    process.exit(1);
  }
  console.log("  Profile upserted.");

  // 2. Assign Admin role
  const { error: roleErr } = await supabase
    .from("user_roles")
    .upsert({ user_id: ADMIN_USER_ID, role_id: ADMIN_ROLE_ID });

  if (roleErr) {
    console.error("Role assignment failed:", roleErr.message);
    process.exit(1);
  }
  console.log("  Admin role assigned.");

  console.log("Done. The user can now sign in with full Admin access.");
}

seedAdmin().catch(console.error);
