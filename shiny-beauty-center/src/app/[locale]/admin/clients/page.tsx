/**
 * Client Database — /admin/clients
 * Gated on view_all_clients permission.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/supabase/types";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = { title: "Client Database — Admin" };

interface ClientsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function AdminClientsPage({
  params,
  searchParams,
}: ClientsPageProps) {
  const { locale } = await params;
  const { q: search, page: rawPage } = await searchParams;
  const page = Math.max(1, parseInt(rawPage ?? "1", 10));
  const pageSize = 25;

  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/clients`);
  }

  const t = await getTranslations("adminPortal");

  if (!can(user, PERMISSIONS.VIEW_ALL_CLIENTS)) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">◌</div>
          <p className="text-charcoal-600 text-sm">{t("access_denied_body")}</p>
        </div>
      </div>
    );
  }

  const supabase = await getSupabaseServerClient();
  let clients: Client[] = [];
  let totalCount = 0;

  if (supabase) {
    let query = supabase
      .from("clients")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (!error) {
      clients = (data ?? []) as Client[];
      totalCount = count ?? 0;
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light text-charcoal-900">{t("clients_title")}</h1>
        <p className="text-charcoal-500 text-sm mt-1">{t("clients_subtitle")}</p>
      </div>

      {!supabase && (
        <div className="rounded-xl bg-cream-50 border border-cream-200 px-4 py-3 text-xs text-charcoal-600">
          <span className="font-semibold me-1">Note:</span>
          {t("clients_stub")}
        </div>
      )}

      {/* Search */}
      <form method="GET" className="flex gap-3">
        <input
          name="q"
          type="text"
          defaultValue={search ?? ""}
          placeholder={t("search_users")}
          className="field-input max-w-xs"
        />
        <button type="submit" className="btn-primary text-sm">
          Search
        </button>
        {search && (
          <a href="?" className="btn-ghost text-sm">Clear</a>
        )}
      </form>

      {/* Table */}
      <section className="card overflow-x-auto p-0">
        <div className="px-6 py-4 border-b border-nude-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-charcoal-700">
            {search ? `Results for "${search}"` : `All Clients`}
            <span className="ms-2 text-charcoal-400 font-normal text-xs">
              ({totalCount})
            </span>
          </h2>
        </div>

        {clients.length === 0 ? (
          <p className="text-sm text-charcoal-400 italic py-8 text-center px-6">
            {supabase ? "No clients found." : "Connect Supabase to load client data."}
          </p>
        ) : (
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="border-b border-nude-100">
              <tr>
                {[
                  t("col_name"),
                  t("col_phone"),
                  t("col_email"),
                  t("col_joined"),
                ].map((col) => (
                  <th key={col} className="py-3 px-4 text-xs font-semibold text-charcoal-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-nude-50 hover:bg-rose-50/20">
                  <td className="py-3 px-4 font-medium text-charcoal-800">
                    {client.full_name}
                    {!client.is_active && (
                      <span className="ms-2 text-[10px] text-charcoal-400">(inactive)</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-charcoal-600">{client.phone ?? "—"}</td>
                  <td className="py-3 px-4 text-charcoal-600">{client.email ?? "—"}</td>
                  <td className="py-3 px-4 text-charcoal-400 text-xs">
                    {client.created_at.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-nude-100 flex items-center gap-2">
            {page > 1 && (
              <a href={`?q=${search ?? ""}&page=${page - 1}`} className="btn-secondary text-xs">
                Previous
              </a>
            )}
            <span className="text-xs text-charcoal-400">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <a href={`?q=${search ?? ""}&page=${page + 1}`} className="btn-secondary text-xs">
                Next
              </a>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
