import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Link } from "@/i18n/navigation";
import type { Role, Permission } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Users & Roles — Admin",
};

interface AdminUsersPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminUsersPage({ params }: AdminUsersPageProps) {
  const { locale } = await params;
  const user = await getCurrentUserWithPermissions();

  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/users`);
  }

  // RBAC gate: require manage_permissions
  if (!can(user, "manage_permissions")) {
    return (
      <div className="min-h-screen bg-brand-gradient flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-4xl mb-4">◈</div>
          <h1 className="text-xl font-semibold text-charcoal-800 mb-2">Access Denied</h1>
          <p className="text-charcoal-500 text-sm mb-6">
            You need the{" "}
            <code className="bg-rose-50 text-rose-600 px-1 py-0.5 rounded">
              manage_permissions
            </code>{" "}
            permission to view this page.
          </p>
          <Link href="/portal" className="btn-primary">
            Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  // Fetch roles and permissions (safe to fail when Supabase not connected)
  const supabase = await getSupabaseServerClient();

  const rolesRaw = supabase
    ? (await supabase.from("roles").select("*").order("name")).data
    : null;
  const roles: Role[] = (rolesRaw ?? []) as Role[];

  const permissionsRaw = supabase
    ? (await supabase.from("permissions").select("*").order("module").order("key")).data
    : null;
  const permissions: Permission[] = (permissionsRaw ?? []) as Permission[];

  // Group permissions by module
  const permsByModule: Record<string, Permission[]> = {};
  for (const perm of permissions) {
    if (!permsByModule[perm.module]) permsByModule[perm.module] = [];
    permsByModule[perm.module].push(perm);
  }

  return (
    <div className="min-h-screen bg-brand-gradient flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full border-b border-rose-100">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/portal" className="btn-ghost text-sm">
            Portal
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-light text-charcoal-900 mb-2">Users &amp; Roles</h1>
          <p className="text-charcoal-500">
            Manage user accounts, role assignments, and permission grants.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Roles panel */}
          <section className="card">
            <h2 className="text-lg font-semibold text-charcoal-800 mb-4">
              Roles
              <span className="ms-2 text-xs font-normal text-charcoal-400">
                {roles.length} total
              </span>
            </h2>
            {roles.length === 0 ? (
              <EmptyState message="No roles found. Run database migrations and seed." />
            ) : (
              <ul className="space-y-2">
                {roles.map((role) => (
                  <li
                    key={role.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-rose-50"
                  >
                    <div>
                      <p className="font-medium text-charcoal-800 text-sm">{role.name}</p>
                      {role.description && (
                        <p className="text-xs text-charcoal-500 mt-0.5">{role.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                      Role
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Permissions panel */}
          <section className="card">
            <h2 className="text-lg font-semibold text-charcoal-800 mb-4">
              Permissions
              <span className="ms-2 text-xs font-normal text-charcoal-400">
                {permissions.length} total
              </span>
            </h2>
            {permissions.length === 0 ? (
              <EmptyState message="No permissions found. Run database migrations and seed." />
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pe-2">
                {Object.entries(permsByModule).map(([module, perms]) => (
                  <div key={module}>
                    <p className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider mb-2">
                      {module}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {perms.map((p) => (
                        <span
                          key={p.id}
                          className="text-xs px-2 py-1 rounded-lg bg-nude-50 text-nude-700 border border-nude-200 font-mono"
                          title={p.description ?? p.key}
                        >
                          {p.key}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Current user effective permissions */}
        <section className="card mt-8">
          <h2 className="text-lg font-semibold text-charcoal-800 mb-4">
            Your Effective Permissions
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {user.permissions.map((perm) => (
              <span
                key={perm}
                className="text-xs px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-mono"
              >
                {perm}
              </span>
            ))}
          </div>
          {user.permissions.length === 0 && (
            <EmptyState message="You have no permissions assigned yet." />
          )}
        </section>
      </main>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-charcoal-400 italic py-4 text-center">{message}</p>
  );
}
