/**
 * Service Catalog CRUD — /admin/services
 * Gated on create_service | edit_service | manage_service_categories.
 * Full CRUD: create/edit/delete services; create/edit categories.
 * Mutations write through Supabase server client (guarded when unconfigured).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { getServices, getServiceCategories } from "@/lib/catalog";
import { isSupabaseConfigured } from "@/lib/config";
import { getTranslations } from "next-intl/server";
import { AddServiceButton, EditServiceRow } from "@/components/admin/ServiceFormModal";
import { CategoryFormPanel } from "@/components/admin/CategoryFormPanel";

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

  const canCreate    = can(user, PERMISSIONS.CREATE_SERVICE);
  const canEdit      = can(user, PERMISSIONS.EDIT_SERVICE);
  const canDelete    = can(user, PERMISSIONS.DELETE_SERVICE);
  const canManageCat = can(user, PERMISSIONS.MANAGE_SERVICE_CATEGORIES);

  if (!canCreate && !canEdit && !canDelete && !canManageCat) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">◉</div>
          <p className="text-charcoal-600 text-sm">{t("access_denied_body")}</p>
        </div>
      </div>
    );
  }

  const supabaseReady = isSupabaseConfigured();

  const [services, categories] = await Promise.all([
    getServices(),
    getServiceCategories(),
  ]);

  // Labels object passed to client components (avoids calling t() in client)
  const svcLabels = {
    add_service:      t("svc_add_service"),
    edit_service:     t("svc_edit_service"),
    delete_service:   t("svc_delete_service"),
    delete_confirm:   t("svc_delete_confirm"),
    saving:           t("svc_saving"),
    save:             t("svc_save"),
    cancel:           t("svc_cancel"),
    name_en:          t("svc_name_en"),
    name_ar:          t("svc_name_ar"),
    desc_en:          t("svc_desc_en"),
    desc_ar:          t("svc_desc_ar"),
    price:            t("svc_price"),
    duration:         t("svc_duration"),
    category:         t("svc_category"),
    active:           t("svc_active"),
    cat_name_en:      t("svc_cat_name_en"),
    cat_name_ar:      t("svc_cat_name_ar"),
    cat_sort:         t("svc_cat_sort"),
    success_created:  t("svc_success_created"),
    success_updated:  t("svc_success_updated"),
    success_deleted:  t("svc_success_deleted"),
    success_cat_created: t("svc_success_cat_created"),
    success_cat_updated: t("svc_success_cat_updated"),
    error:            t("svc_error"),
    no_supabase:      t("svc_no_supabase"),
    add_category:     t("svc_add_category"),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light text-charcoal-900">{t("services_title")}</h1>
          <p className="text-charcoal-500 text-sm mt-1">{t("services_subtitle")}</p>
        </div>
        <AddServiceButton
          locale={locale}
          categories={categories}
          canCreate={canCreate}
          supabaseReady={supabaseReady}
          labels={svcLabels}
        />
      </div>

      {/* No-Supabase notice */}
      {!supabaseReady && (
        <div className="rounded-xl bg-cream-50 border border-cream-200 px-4 py-3 text-xs text-charcoal-600">
          <span className="font-semibold me-1">Note:</span>
          {t("svc_no_supabase")}
        </div>
      )}

      {/* Categories section */}
      {canManageCat && (
        <CategoryFormPanel
          locale={locale}
          categories={categories}
          canManage={canManageCat}
          supabaseReady={supabaseReady}
          labels={svcLabels}
        />
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
            {supabaseReady ? "No services found." : "Connect Supabase to load services."}
          </p>
        ) : (
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="border-b border-nude-100">
              <tr>
                {["Service", "Category", "Price (SAR)", "Duration (min)", "Active", "Actions"].map(
                  (col) => (
                    <th
                      key={col}
                      className="py-3 px-4 text-xs font-semibold text-charcoal-500 uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <EditServiceRow
                  key={svc.id}
                  service={svc}
                  locale={locale}
                  categories={categories}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  supabaseReady={supabaseReady}
                  labels={svcLabels}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
