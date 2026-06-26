"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

const HomeIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth={filled ? 0 : 1.8} className="transition-all">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const CalendarIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} className="transition-all">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"
      fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 0.15 : 0} />
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M16 2v4M8 2v4M3 10h18" />
    {filled && <path fill="currentColor" d="M8 14h2v2H8zM11 14h2v2h-2zM14 14h2v2h-2z" />}
  </svg>
);

const ScissorsIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8}>
    <circle cx="6" cy="6" r="3" fill={filled ? "currentColor" : "none"} />
    <circle cx="6" cy="18" r="3" fill={filled ? "currentColor" : "none"} />
    <path strokeLinecap="round" d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
  </svg>
);

const UserIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="8" r="4" fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 0.2 : 0} />
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

export function BottomNav() {
  const t = useTranslations();
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const navItems = [
    {
      href: "/",
      label: t("nav.home"),
      icon: <HomeIcon />,
      activeIcon: <HomeIcon filled />,
    },
    {
      href: "/services",
      label: t("nav.services"),
      icon: <ScissorsIcon />,
      activeIcon: <ScissorsIcon filled />,
    },
    {
      href: "/appointments",
      label: t("nav.my_bookings"),
      icon: <CalendarIcon />,
      activeIcon: <CalendarIcon filled />,
    },
    {
      href: "/profile",
      label: t("profile.title"),
      icon: <UserIcon />,
      activeIcon: <UserIcon filled />,
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-sm border-t border-nude-100 safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href as "/"}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors ${
                active
                  ? "text-rose-500"
                  : "text-charcoal-400 hover:text-charcoal-600"
              }`}
            >
              {active ? item.activeIcon : item.icon}
              <span className={`text-[10px] font-medium leading-none ${
                active ? "text-rose-500" : "text-charcoal-400"
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
