/**
 * Admin Roles & Positions — /admin/roles
 * Gated on manage_permissions. Lets an admin create custom roles (positions),
 * edit their description + permission set, and delete non-system roles.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import type { Role, Permission, RolePermission } from "@/lib/supabase/types";
import { RoleManager } from "@/components/admin/RoleManager";

export const metadata: Metadata = { title: "Roles & Positions — Admin" };

interface AdminRolesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminRolesPage({ params }: AdminRolesPageProps) {
  const { locale } = await params;

  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/roles`);
  }

  const canManage = can(user, PERMISSIONS.MANAGE_PERMISSIONS);

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">◈</div>
          <p className="text-charcoal-600 text-sm">
            You do not have permission to manage roles &amp; positions. Please contact your manager.
          </p>
        </div>
      </div>
    );
  }

  const supabaseReady = isSupabaseConfigured();
  const supabase = await getSupabaseServerClient();

  const [roles, permissions, rolePermissions] = await Promise.all([
    supabase
      ? supabase.from("roles").select("*").order("name").then((r) => (r.data ?? []) as Role[])
      : Promise.resolve([] as Role[]),
    supabase
      ? supabase
          .from("permissions")
          .select("*")
          .order("module")
          .order("key")
          .then((r) => (r.data ?? []) as Permission[])
      : Promise.resolve([] as Permission[]),
    supabase
      ? supabase
          .from("role_permissions")
          .select("role_id, permission_id")
          .then((r) => (r.data ?? []) as RolePermission[])
      : Promise.resolve([] as RolePermission[]),
  ]);

  // Derive each role's current permission keys from the role_permissions join.
  const permIdToKey = new Map(permissions.map((p) => [p.id, p.key]));
  const rolePermKeys: Record<string, string[]> = {};
  for (const role of roles) rolePermKeys[role.id] = [];
  for (const rp of rolePermissions) {
    const key = permIdToKey.get(rp.permission_id);
    if (!key) continue;
    if (!rolePermKeys[rp.role_id]) rolePermKeys[rp.role_id] = [];
    rolePermKeys[rp.role_id].push(key);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light text-charcoal-900">Roles &amp; Positions</h1>
        <p className="text-charcoal-500 text-sm mt-1">
          Create custom positions, edit their description, and choose which permissions each role grants.
        </p>
      </div>

      {!supabaseReady && (
        <div className="rounded-xl bg-cream-50 border border-cream-200 px-4 py-3 text-xs text-charcoal-600">
          <span className="font-semibold me-1">Note:</span>
          Connect Supabase to create, edit, or delete roles.
        </div>
      )}

      <RoleManager
        roles={roles}
        permissions={permissions}
        rolePermKeys={rolePermKeys}
        locale={locale}
        supabaseReady={supabaseReady}
      />
    </div>
  );
}
