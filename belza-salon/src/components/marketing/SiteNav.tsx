'use client';

import Link from 'next/link';
import { useState } from 'react';

export function SiteNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header role="banner">
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center"
        aria-label="Main navigation"
      >
        {/* Glassmorphism bar */}
        <div className="absolute inset-0 bg-surface/80 backdrop-blur-md border-b border-border-subtle/60" />

        <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 font-display text-xl font-bold text-text-primary rounded-sm"
            aria-label="Belza Salon — home"
          >
            <span
              className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white font-display font-bold text-base leading-none"
              aria-hidden="true"
            >
              B
            </span>
            Belza
          </Link>

          {/* Desktop links */}
          <ul className="hidden md:flex items-center gap-1" role="list">
            <li>
              <Link href="/services" className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors">
                Services
              </Link>
            </li>
            <li>
              <Link href="/#team" className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors">
                Our Team
              </Link>
            </li>
            <li>
              <Link href="/#about" className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors">
                About
              </Link>
            </li>
          </ul>

          {/* CTA group */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden md:block px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-surface-alt"
            >
              Sign In
            </Link>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary-500 text-white font-medium text-sm rounded-pill shadow-sm hover:bg-primary-600 active:bg-primary-700 transition-colors"
            >
              Book Now
            </Link>
            <button
              type="button"
              className="md:hidden p-2 -mr-2 rounded-lg text-text-secondary hover:bg-surface-alt transition-colors"
              aria-controls="mobile-menu"
              aria-expanded={mobileOpen}
              aria-label="Toggle navigation menu"
              onClick={() => setMobileOpen((o) => !o)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div
            id="mobile-menu"
            className="absolute top-16 left-0 right-0 bg-surface border-b border-border shadow-lg px-4 py-4 space-y-1"
            role="menu"
          >
            <Link role="menuitem" href="/services"  onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors">Services</Link>
            <Link role="menuitem" href="/#team"     onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors">Our Team</Link>
            <Link role="menuitem" href="/#about"    onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors">About</Link>
            <Link role="menuitem" href="/login"     onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors">Sign In</Link>
          </div>
        )}
      </nav>
    </header>
  );
}
