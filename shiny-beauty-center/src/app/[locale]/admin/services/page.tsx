/**
 * Service Catalog CRUD — /admin/services
 * Gated on create_service | edit_service | manage_service_categories
 * Phase 4: Full list + edit stubs. Form UI wired to read data; write actions
 * are behind a clean seam (ServiceEditModal) — connect Supabase to activate.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getServices, getServiceCategories } from "@/lib/catalog";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = { title: "Service Catalog — Admin" };

interface ServicesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminServicesPage({ params }: ServicesPageProps) {
  const { locale } = await params;
  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/services`);
  }

  const t = await getTranslations("adminPortal");

  const canCreate  = can(user, PERMISSIONS.CREATE_SERVICE);
  const canEdit    = can(user, PERMISSIONS.EDIT_SERVICE);
  const canDelete  = can(user, PERMISSIONS.DELETE_SERVICE);
  const canManageCat = can(user, PERMISSIONS.MANAGE_SERVICE_CATEGORIES);

  if (!canCreate && !canEdit && !canManageCat) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">◉</div>
          <p className="text-charcoal-600 text-sm">{t("access_denied_body")}</p>
        </div>
      </div>
    );
  }

  const [services, categories] = await Promise.all([
    getServices(),
    getServiceCategories(),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light text-charcoal-900">{t("services_title")}</h1>
          <p className="text-charcoal-500 text-sm mt-1">{t("services_subtitle")}</p>
        </div>
        {canCreate && (
          <button className="btn-primary text-sm opacity-70 cursor-not-allowed" disabled>
            + Add Service
          </button>
        )}
      </div>

      {/* Stub notice */}
      <div className="rounded-xl bg-cream-50 border border-cream-200 px-4 py-3 text-xs text-charcoal-600">
        <span className="font-semibold me-1">Note:</span>
        {t("services_stub")}
      </div>

      {/* Categories */}
      {canManageCat && (
        <section className="card">
          <h2 className="text-sm font-semibold text-charcoal-700 mb-3">
            Categories ({categories.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat.id}
                className="px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium"
              >
                {cat.name_en} / {cat.name_ar}
              </span>
            ))}
            {categories.length === 0 && (
              <span className="text-xs text-charcoal-400 italic">No categories. Run migrations.</span>
            )}
          </div>
        </section>
      )}

      {/* Services table */}
      <section className="card overflow-x-auto p-0">
        <div className="px-6 py-4 border-b border-nude-100">
          <h2 className="text-sm font-semibold text-charcoal-700">
            Services ({services.length})
          </h2>
        </div>
        {services.length === 0 ? (
          <p className="text-sm text-charcoal-400 italic py-8 text-center px-6">
            No services found.
          </p>
        ) : (
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="border-b border-nude-100">
              <tr>
                {["Service", "Category", "Price (SAR)", "Duration (min)", "Active", "Actions"].map((col) => (
                  <th key={col} className="py-3 px-4 text-xs font-semibold text-charcoal-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.id} className="border-b border-nude-50 hover:bg-rose-50/20">
                  <td className="py-3 px-4">
                    <p className="font-medium text-charcoal-800">{svc.name_en}</p>
                    <p className="text-[11px] text-charcoal-400">{svc.name_ar}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-nude-100 text-nude-700 text-xs">
                      {catMap.get(svc.category_id)?.name_en ?? "—"}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-charcoal-700">
                    {Number(svc.price).toLocaleString("en-SA")}
                  </td>
                  <td className="py-3 px-4 text-charcoal-600">{svc.duration_minutes}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      svc.is_active ? "bg-green-100 text-green-700" : "bg-charcoal-100 text-charcoal-500"
                    }`}>
                      {svc.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      {canEdit && (
                        <button
                          className="text-xs text-rose-600 hover:underline disabled:opacity-40"
                          disabled
                          title="Edit form — connect Supabase to activate"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="text-xs text-charcoal-400 hover:text-red-600 disabled:opacity-40"
                          disabled
                          title="Delete — connect Supabase to activate"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
