import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export const metadata: Metadata = {
  title: "Portal",
};

interface PortalPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { locale } = await params;
  const user = await getCurrentUserWithPermissions();

  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/portal`);
  }

  const isAdmin = can(user, "manage_permissions");
  const canViewDashboard = can(user, "view_dashboard");
  const canViewBookings = can(user, "view_all_bookings") || can(user, "view_own_bookings");
  const isStaff = can(user, "view_own_bookings") || can(user, "view_all_bookings");

  return (
    <div className="min-h-screen bg-brand-gradient flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full border-b border-rose-100">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <span className="text-sm text-charcoal-500">
            {user.profile?.full_name ?? user.email}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-light text-charcoal-900 mb-2">Staff Portal</h1>
          <p className="text-charcoal-500">
            Welcome back, {user.profile?.full_name ?? user.email}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <span
                key={role.id}
                className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-medium"
              >
                {role.name}
              </span>
            ))}
          </div>
        </div>

        {/* Quick navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Staff portal — live in Phase 3 */}
          {isStaff && (
            <Link href="/staff/schedule" className="card hover:shadow-md transition-shadow group border-rose-200">
              <div className="text-rose-400 text-xl mb-2">◑</div>
              <h3 className="font-semibold text-charcoal-800 group-hover:text-rose-600">
                My Schedule
              </h3>
              <p className="text-sm text-charcoal-500 mt-1">
                View and manage your daily appointments
              </p>
            </Link>
          )}
          {isStaff && (
            <Link href="/staff/availability" className="card hover:shadow-md transition-shadow group border-rose-200">
              <div className="text-rose-400 text-xl mb-2">◷</div>
              <h3 className="font-semibold text-charcoal-800 group-hover:text-rose-600">
                My Availability
              </h3>
              <p className="text-sm text-charcoal-500 mt-1">
                Set working hours and request time off
              </p>
            </Link>
          )}
          {isStaff && (
            <Link href="/staff/notifications" className="card hover:shadow-md transition-shadow group border-rose-200">
              <div className="text-rose-400 text-xl mb-2">◎</div>
              <h3 className="font-semibold text-charcoal-800 group-hover:text-rose-600">
                Notifications
              </h3>
              <p className="text-sm text-charcoal-500 mt-1">
                Your in-app inbox and updates
              </p>
            </Link>
          )}

          {canViewDashboard && (
            <PortalCard
              title="Dashboard"
              description="Overview and key metrics"
              href="#"
              comingSoon
            />
          )}
          {canViewBookings && !isStaff && (
            <PortalCard
              title="Appointments"
              description="Manage bookings and schedule"
              href="#"
              comingSoon
            />
          )}
          {isAdmin && (
            <Link href="/admin/users" className="card hover:shadow-md transition-shadow group">
              <div className="text-rose-400 text-xl mb-2">◈</div>
              <h3 className="font-semibold text-charcoal-800 group-hover:text-rose-600">
                Users &amp; Roles
              </h3>
              <p className="text-sm text-charcoal-500 mt-1">
                Manage accounts, roles, and permissions
              </p>
            </Link>
          )}
          <PortalCard
            title="Services"
            description="Browse available services"
            href="#"
            comingSoon
          />
          <PortalCard
            title="My Profile"
            description="Update your information"
            href="#"
            comingSoon
          />
        </div>
      </main>
    </div>
  );
}

function PortalCard({
  title,
  description,
  href,
  comingSoon,
}: {
  title: string;
  description: string;
  href: string;
  comingSoon?: boolean;
}) {
  return (
    <div className="card opacity-70 relative">
      {comingSoon && (
        <span className="absolute top-3 end-3 text-[10px] font-medium text-charcoal-400 bg-charcoal-100 px-2 py-0.5 rounded-full">
          Phase 2+
        </span>
      )}
      <div className="text-nude-400 text-xl mb-2">◉</div>
      <h3 className="font-semibold text-charcoal-700">{title}</h3>
      <p className="text-sm text-charcoal-400 mt-1">{description}</p>
    </div>
  );
}
