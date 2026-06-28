import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export const metadata: Metadata = {
  title: "Portal",
};

interface PortalPageProps {
  params: Promise<{ locale: string }>;
}

interface NavItem {
  title: string;
  description: string;
  href: string;
  icon: string;
  show: boolean;
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { locale } = await params;
  const user = await getCurrentUserWithPermissions();

  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/portal`);
  }

  const isStaff =
    can(user, PERMISSIONS.VIEW_OWN_BOOKINGS) ||
    can(user, PERMISSIONS.VIEW_ALL_BOOKINGS);

  // Staff self-service
  const myWork: NavItem[] = [
    {
      title: "My Schedule",
      description: "View and manage your daily appointments",
      href: "/staff/schedule",
      icon: "◑",
      show: isStaff,
    },
    {
      title: "My Availability",
      description: "Set working hours and request time off",
      href: "/staff/availability",
      icon: "◷",
      show: isStaff,
    },
    {
      title: "Notifications",
      description: "Your in-app inbox and updates",
      href: "/staff/notifications",
      icon: "◎",
      show: isStaff,
    },
  ];

  // Management / admin tools — each gated to match its destination page's guard
  const management: NavItem[] = [
    {
      title: "Dashboard",
      description: "Overview and key metrics",
      href: "/admin/dashboard",
      icon: "◴",
      show: can(user, PERMISSIONS.VIEW_DASHBOARD),
    },
    {
      title: "Appointments Calendar",
      description: "All-staff calendar of bookings",
      href: "/admin/calendar",
      icon: "▦",
      show: can(user, PERMISSIONS.VIEW_ALL_BOOKINGS),
    },
    {
      title: "Reports",
      description: "Sales, bookings & staff performance",
      href: "/admin/reports",
      icon: "▤",
      show:
        can(user, PERMISSIONS.VIEW_STAFF_PERFORMANCE) ||
        can(user, PERMISSIONS.VIEW_SALES_REPORTS) ||
        can(user, PERMISSIONS.VIEW_BOOKING_REPORTS) ||
        can(user, PERMISSIONS.VIEW_COMMISSION),
    },
    {
      title: "Clients",
      description: "Client directory, history & notes",
      href: "/admin/clients",
      icon: "◍",
      show: can(user, PERMISSIONS.VIEW_ALL_CLIENTS),
    },
    {
      title: "Manage Services",
      description: "Add, edit & price services",
      href: "/admin/services",
      icon: "✦",
      show:
        can(user, PERMISSIONS.CREATE_SERVICE) ||
        can(user, PERMISSIONS.EDIT_SERVICE) ||
        can(user, PERMISSIONS.DELETE_SERVICE) ||
        can(user, PERMISSIONS.MANAGE_SERVICE_CATEGORIES),
    },
    {
      title: "Reviews",
      description: "Moderate ratings & comments",
      href: "/admin/reviews",
      icon: "★",
      show: can(user, PERMISSIONS.MANAGE_REVIEWS),
    },
    {
      title: "Time-off Requests",
      description: "Approve staff leave & time off",
      href: "/admin/time-off",
      icon: "◵",
      show: can(user, PERMISSIONS.MANAGE_LEAVE_REQUESTS),
    },
    {
      title: "Users & Roles",
      description: "Manage accounts, roles, and permissions",
      href: "/admin/users",
      icon: "◈",
      show:
        can(user, PERMISSIONS.MANAGE_PERMISSIONS) ||
        can(user, PERMISSIONS.ASSIGN_ROLES),
    },
  ];

  // Available to everyone signed in
  const general: NavItem[] = [
    {
      title: "Browse Services",
      description: "See the full services menu",
      href: "/services",
      icon: "◉",
      show: true,
    },
    {
      title: "My Profile",
      description: "Update your information",
      href: "/profile",
      icon: "◐",
      show: true,
    },
  ];

  const sections = [
    { heading: "My work", items: myWork.filter((i) => i.show) },
    { heading: "Management", items: management.filter((i) => i.show) },
    { heading: "General", items: general.filter((i) => i.show) },
  ].filter((s) => s.items.length > 0);

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

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-3">
                {section.heading}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="card hover:shadow-md transition-shadow group border-rose-200"
                  >
                    <div className="text-rose-400 text-xl mb-2">{item.icon}</div>
                    <h3 className="font-semibold text-charcoal-800 group-hover:text-rose-600">
                      {item.title}
                    </h3>
                    <p className="text-sm text-charcoal-500 mt-1">{item.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
