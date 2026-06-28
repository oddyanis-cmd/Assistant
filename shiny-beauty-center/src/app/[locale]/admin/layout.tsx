/**
 * Admin Portal Layout
 * Session-guarded + permission-gated on view_dashboard or manage_permissions.
 * Renders a persistent sidebar nav (desktop) and a top bar (mobile).
 */
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params;
  const user = await getCurrentUserWithPermissions();
  const t = await getTranslations("adminPortal");
  const tnav = await getTranslations("nav");

  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/dashboard`);
  }

  // At least one admin-level perm required to enter
  const hasAccess =
    can(user, PERMISSIONS.VIEW_DASHBOARD) ||
    can(user, PERMISSIONS.MANAGE_PERMISSIONS) ||
    can(user, PERMISSIONS.VIEW_ALL_BOOKINGS) ||
    can(user, PERMISSIONS.MANAGE_LEAVE_REQUESTS) ||
    can(user, PERMISSIONS.VIEW_STAFF_PERFORMANCE) ||
    can(user, PERMISSIONS.VIEW_SALES_REPORTS) ||
    can(user, PERMISSIONS.CREATE_SERVICE) ||
    can(user, PERMISSIONS.VIEW_ALL_CLIENTS) ||
    can(user, PERMISSIONS.MANAGE_REVIEWS);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-brand-gradient flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-4xl mb-4 text-rose-300">◈</div>
          <h1 className="text-xl font-semibold text-charcoal-800 mb-2">
            {t("access_denied")}
          </h1>
          <p className="text-charcoal-500 text-sm mb-6">
            {t("access_denied_body")}
          </p>
          <Link href="/portal" className="btn-primary">
            {t("back_to_portal")}
          </Link>
        </div>
      </div>
    );
  }

  // Build nav items based on effective permissions
  const navItems = [
    {
      href: "/admin/dashboard",
      label: t("nav_dashboard"),
      icon: "◑",
      show: can(user, PERMISSIONS.VIEW_DASHBOARD),
    },
    {
      href: "/admin/calendar",
      label: t("nav_calendar"),
      icon: "◷",
      show: can(user, PERMISSIONS.VIEW_ALL_BOOKINGS),
    },
    {
      href: "/admin/users",
      label: t("nav_users"),
      icon: "◈",
      show: can(user, PERMISSIONS.MANAGE_PERMISSIONS) || can(user, PERMISSIONS.ASSIGN_ROLES),
    },
    {
      href: "/admin/reports",
      label: t("nav_reports"),
      icon: "◎",
      show:
        can(user, PERMISSIONS.VIEW_SALES_REPORTS) ||
        can(user, PERMISSIONS.VIEW_STAFF_PERFORMANCE) ||
        can(user, PERMISSIONS.VIEW_BOOKING_REPORTS),
    },
    {
      href: "/admin/time-off",
      label: t("nav_time_off"),
      icon: "◐",
      show: can(user, PERMISSIONS.MANAGE_LEAVE_REQUESTS),
    },
    {
      href: "/admin/services",
      label: t("nav_services"),
      icon: "◉",
      show:
        can(user, PERMISSIONS.CREATE_SERVICE) ||
        can(user, PERMISSIONS.EDIT_SERVICE) ||
        can(user, PERMISSIONS.MANAGE_SERVICE_CATEGORIES),
    },
    {
      href: "/admin/clients",
      label: t("nav_clients"),
      icon: "◌",
      show: can(user, PERMISSIONS.VIEW_ALL_CLIENTS),
    },
    {
      href: "/admin/reviews",
      label: t("nav_reviews"),
      icon: "★",
      show: can(user, PERMISSIONS.MANAGE_REVIEWS),
    },
  ].filter((item) => item.show);

  return (
    <div className="min-h-screen bg-brand-gradient flex flex-col">
      {/* ---- Top bar ---- */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-rose-100 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="hidden sm:block text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
              {t("portal_badge")}
            </span>
          </div>

          {/* Mobile nav - horizontal scroll */}
          <nav className="flex items-center gap-1 overflow-x-auto md:hidden">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href as Parameters<typeof Link>[0]["href"]}
                className="btn-ghost text-xs whitespace-nowrap px-2.5 py-2"
              >
                <span className="me-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/portal" className="btn-ghost text-sm hidden sm:flex">
              {tnav("portal")}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full">
        {/* ---- Sidebar (desktop) ---- */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white/70 border-e border-rose-100 px-3 py-6 gap-1">
          <p className="text-[10px] font-bold text-charcoal-400 uppercase tracking-widest px-3 mb-3">
            {t("nav_heading")}
          </p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href as Parameters<typeof Link>[0]["href"]}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-charcoal-600
                         hover:bg-rose-50 hover:text-rose-700 transition-colors group"
            >
              <span className="text-base text-rose-400 group-hover:text-rose-500 w-5 text-center">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}

          <div className="mt-auto pt-6 border-t border-nude-100">
            <p className="text-xs text-charcoal-400 px-3 truncate">
              {user.profile?.full_name ?? user.email}
            </p>
            <div className="flex flex-wrap gap-1 px-3 mt-1">
              {user.roles.map((r) => (
                <span
                  key={r.id}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700"
                >
                  {r.name}
                </span>
              ))}
            </div>
          </div>
        </aside>

        {/* ---- Main content ---- */}
        <main className="flex-1 px-4 md:px-8 py-8 min-w-0">
          {children}
        </main>
      </div>

      <footer className="text-center py-3 text-xs text-charcoal-400 border-t border-nude-100 bg-white/50">
        Shiny Beauty Center — Admin Portal
      </footer>
    </div>
  );
}
