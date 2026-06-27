/**
 * Admin Users & Permissions — /admin/users
 * Gated on manage_permissions OR assign_roles.
 * Lists all users with their roles; clicking "Manage" shows the permission panel.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getUsersWithRoles } from "@/lib/metrics";
import type { Role, Permission } from "@/lib/supabase/types";
import { getTranslations } from "next-intl/server";
import { UserPermissionsPanel } from "@/components/admin/UserPermissionsPanel";

export const metadata: Metadata = { title: "Users & Permissions — Admin" };

interface AdminUsersPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ manage?: string }>;
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: AdminUsersPageProps) {
  const { locale } = await params;
  const { manage: manageUserId } = await searchParams;

  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/users`);
  }

  const t = await getTranslations("adminPortal");

  const canManagePerms = can(user, PERMISSIONS.MANAGE_PERMISSIONS);
  const canAssignRoles = can(user, PERMISSIONS.ASSIGN_ROLES);

  if (!canManagePerms && !canAssignRoles) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">◈</div>
          <p className="text-charcoal-600 text-sm">{t("access_denied_body")}</p>
        </div>
      </div>
    );
  }

  const supabase = await getSupabaseServerClient();

  // Fetch users, roles, and all permissions
  const [users, allRoles, allPermissions] = await Promise.all([
    getUsersWithRoles(),
    supabase
      ? supabase.from("roles").select("*").order("name").then((r) => (r.data ?? []) as Role[])
      : Promise.resolve([] as Role[]),
    supabase
      ? supabase.from("permissions").select("*").order("module").order("key").then((r) => (r.data ?? []) as Permission[])
      : Promise.resolve([] as Permission[]),
  ]);

  // If managing a specific user, fetch their overrides + effective perms
  let managedUser = users.find((u) => u.userId === manageUserId) ?? null;
  let userOverrides: Array<{ permissionId: string; granted: boolean }> = [];
  let userEffectivePerms: string[] = [];

  if (managedUser && supabase) {
    const { data: overrideRows } = await supabase
      .from("user_permissions")
      .select("permission_id, granted")
      .eq("user_id", manageUserId!);
    userOverrides = (overrideRows ?? []).map((r) => ({
      permissionId: (r as { permission_id: string; granted: boolean }).permission_id,
      granted: (r as { permission_id: string; granted: boolean }).granted,
    }));

    // Compute effective permissions
    // 1. Role permissions
    const roleIds = managedUser.roles.map((r) => r.id);
    let rolePermKeys: string[] = [];
    if (roleIds.length > 0) {
      const { data: rpRows } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .in("role_id", roleIds);
      const permIds = (rpRows ?? []).map((r) => (r as { permission_id: string }).permission_id);
      if (permIds.length > 0) {
        const { data: permRows } = await supabase
          .from("permissions")
          .select("key")
          .in("id", permIds);
        rolePermKeys = (permRows ?? []).map((p) => (p as { key: string }).key);
      }
    }
    // 2. Apply overrides
    const explicitGrants = new Set<string>();
    const explicitRevokes = new Set<string>();
    const permIdToKey = new Map(allPermissions.map((p) => [p.id, p.key]));
    for (const o of userOverrides) {
      const key = permIdToKey.get(o.permissionId);
      if (key) {
        if (o.granted) explicitGrants.add(key);
        else explicitRevokes.add(key);
      }
    }
    const effective = new Set([...rolePermKeys, ...Array.from(explicitGrants)]);
    for (const rev of Array.from(explicitRevokes)) effective.delete(rev);
    userEffectivePerms = Array.from(effective).sort();
  }

  const labels = {
    roles_section:    t("roles_section"),
    permissions_section: t("permissions_section"),
    permissions_note: t("permissions_note"),
    grant:            t("grant"),
    revoke:           t("revoke"),
    clear:            t("clear"),
    assign_role:      t("assign_role"),
    remove_role:      t("remove_role"),
    effective_perms:  t("effective_perms"),
    invite_stub:      t("invite_stub"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light text-charcoal-900">{t("users_title")}</h1>
        <p className="text-charcoal-500 text-sm mt-1">{t("users_subtitle")}</p>
      </div>

      {/* Invite stub notice */}
      <div className="rounded-xl bg-cream-50 border border-cream-200 px-4 py-3 text-xs text-charcoal-600">
        <span className="font-semibold me-1">Note:</span>
        {t("invite_stub")}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---- User list ---- */}
        <div className="lg:col-span-2 space-y-3">
          {users.length === 0 && (
            <p className="text-sm text-charcoal-400 italic py-8 text-center card">
              No users found. Run migrations and seed data.
            </p>
          )}
          {users.map((u) => {
            const isManaged = u.userId === manageUserId;
            const manageHref = isManaged
              ? `?` // de-select
              : `?manage=${u.userId}`;
            return (
              <div
                key={u.userId}
                className={`card flex items-center justify-between gap-4 p-4 transition-all ${
                  isManaged ? "border-rose-300 shadow-md" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-charcoal-800 truncate">
                    {u.fullName ?? "—"}
                  </p>
                  <p className="text-xs text-charcoal-400 truncate">{u.email ?? "—"}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {u.roles.map((r) => (
                      <span
                        key={r.id}
                        className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-medium"
                      >
                        {r.name}
                      </span>
                    ))}
                    {u.roles.length === 0 && (
                      <span className="text-[10px] text-charcoal-400 italic">No roles</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      u.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-charcoal-100 text-charcoal-500"
                    }`}
                  >
                    {u.isActive ? t("active") : t("inactive")}
                  </span>
                  <a
                    href={manageHref}
                    className={`btn-ghost text-xs px-3 py-1.5 ${isManaged ? "bg-rose-50 text-rose-700" : ""}`}
                  >
                    {isManaged ? "Close" : t("manage")}
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* ---- Management panel ---- */}
        <div className="lg:col-span-1">
          {managedUser ? (
            <div className="card sticky top-24">
              <h2 className="text-sm font-semibold text-charcoal-800 mb-1">
                {t("manage_user_title")}
              </h2>
              <p className="text-xs text-charcoal-500 mb-4 truncate">
                {managedUser.fullName ?? managedUser.email}
              </p>
              <UserPermissionsPanel
                user={managedUser}
                allRoles={allRoles}
                allPermissions={allPermissions}
                userOverrides={userOverrides}
                userEffectivePerms={userEffectivePerms}
                locale={locale}
                labels={labels}
                canManagePerms={canManagePerms}
                canAssignRoles={canAssignRoles}
              />
            </div>
          ) : (
            <div className="card text-center py-12 text-charcoal-400 text-sm">
              Select a user to manage their roles and permissions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
