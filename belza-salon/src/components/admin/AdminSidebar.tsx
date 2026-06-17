'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useSession } from 'next-auth/react';

const NAV_ITEMS = [
  {
    href:  '/admin',
    label: 'Dashboard',
    icon:  (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    exact: true,
  },
  {
    href:  '/admin/appointments',
    label: 'Appointments',
    icon:  (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href:  '/admin/calendar',
    label: 'Calendar',
    icon:  (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href:  '/admin/clients',
    label: 'Clients',
    icon:  (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href:  '/admin/services',
    label: 'Services',
    icon:  (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href:  '/admin/team',
    label: 'Team',
    icon:  (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const BOTTOM_ITEMS = [
  {
    href:  '/admin/settings',
    label: 'Settings',
    icon:  (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="hidden lg:flex flex-col bg-surface border-r border-border shadow-[4px_0_16px_0_rgba(44,34,32,0.06)] shrink-0 overflow-y-auto"
      style={{ width: 256 }}
      aria-label="Admin navigation sidebar"
      role="navigation"
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-border shrink-0">
        <span className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white font-display font-bold text-base shrink-0" aria-hidden="true">B</span>
        <div>
          <p className="text-sm font-semibold text-text-primary font-display">Belza</p>
          <p className="text-xs text-muted">Admin Panel</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-1" aria-label="Primary navigation">
        {NAV_ITEMS.map(({ href, label, icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 ${
                active
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
              }`}
            >
              <span className={active ? 'text-primary-500' : ''}>{icon}</span>
              {label}
            </Link>
          );
        })}

        <div className="my-2 border-t border-border" aria-hidden="true" />

        {BOTTOM_ITEMS.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 ${
                active
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
              }`}
            >
              <span className={active ? 'text-primary-500' : ''}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User profile */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(session?.user?.name ?? 'Admin')}&backgroundColor=d4614f&textColor=fff&radius=50`}
            alt=""
            width="32"
            height="32"
            className="w-8 h-8 rounded-full shrink-0"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{session?.user?.name ?? 'Admin'}</p>
            <p className="text-xs text-muted truncate">{session?.user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full mt-1 flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
