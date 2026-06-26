/**
 * Staff Portal Layout
 * Session-guarded: redirects unauthenticated users and non-staff to sign-in.
 * Staff = has view_own_bookings OR view_all_bookings permission.
 */
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

interface StaffLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function StaffLayout({ children, params }: StaffLayoutProps) {
  const { locale } = await params;
  const user = await getCurrentUserWithPermissions();
  const t = await getTranslations("staff");
  const tnav = await getTranslations("nav");

  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/staff`);
  }

  // Gate: must have at least view_own_bookings
  const isStaff =
    can(user, PERMISSIONS.VIEW_OWN_BOOKINGS) ||
    can(user, PERMISSIONS.VIEW_ALL_BOOKINGS);

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-brand-gradient flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-4xl mb-4 text-rose-400">◈</div>
          <h1 className="text-xl font-semibold text-charcoal-800 mb-2">Access Denied</h1>
          <p className="text-charcoal-500 text-sm mb-6">
            The staff portal is reserved for Shiny Beauty Center team members.
          </p>
          <Link href="/" className="btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const hasNotifications = can(user, PERMISSIONS.VIEW_OWN_BOOKINGS);
  const canManageAvailability =
    can(user, PERMISSIONS.MANAGE_STAFF_AVAILABILITY) ||
    can(user, PERMISSIONS.EDIT_STAFF_SCHEDULE);

  return (
    <div className="min-h-screen bg-brand-gradient flex flex-col">
      {/* Staff nav header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-rose-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <span className="hidden sm:block text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              {t("portal_title")}
            </span>
          </div>

          <nav className="flex items-center gap-1">
            <Link
              href="/staff/schedule"
              className="btn-ghost text-sm px-3 py-2"
            >
              {t("schedule_title")}
            </Link>
            {canManageAvailability && (
              <Link
                href="/staff/availability"
                className="btn-ghost text-sm px-3 py-2"
              >
                {t("availability_title")}
              </Link>
            )}
            {hasNotifications && (
              <Link
                href="/staff/notifications"
                className="btn-ghost text-sm px-3 py-2"
              >
                {t("notifications_title")}
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/portal" className="btn-ghost text-sm hidden sm:flex">
              {tnav("portal")}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      <footer className="text-center py-4 text-xs text-charcoal-400 border-t border-nude-100">
        <p>Shiny Beauty Center — Staff Portal · {user.profile?.full_name ?? user.email}</p>
      </footer>
    </div>
  );
}
