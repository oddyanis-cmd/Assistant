'use client';

/**
 * Login page — stub for Milestone 1.
 *
 * Admin auth (NextAuth + credential provider + JWT sessions) is wired up in
 * Milestone 2.  This page exists so the "Sign In" nav link resolves without a
 * 404 and the form shell is already in place for the next sprint.
 */
import { SiteNav }    from '@/components/marketing/SiteNav';
import { SiteFooter } from '@/components/marketing/SiteFooter';

export default function LoginPage() {
  return (
    <>
      <SiteNav />

      <main className="pt-16 min-h-screen bg-surface-alt flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-sm">
          <div className="bg-surface rounded-card border border-border-subtle shadow-card p-8">

            {/* Logo mark */}
            <div className="flex justify-center mb-6">
              <span
                className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center text-white font-display font-bold text-2xl"
                aria-hidden="true"
              >
                B
              </span>
            </div>

            <h1 className="font-display text-2xl font-bold text-text-primary text-center mb-1">
              Welcome back
            </h1>
            <p className="text-text-secondary text-sm text-center mb-8">
              Sign in to the Belza Salon admin panel
            </p>

            {/* Placeholder form — wired in Milestone 2 */}
            <form
              className="space-y-5"
              onSubmit={(e) => e.preventDefault()}
              aria-label="Sign in form"
            >
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-text-primary mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-colors"
                  placeholder="admin@belzasalon.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-text-primary mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-colors"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled
                className="w-full py-3 px-6 bg-primary-500 text-white font-semibold text-sm rounded-pill hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign In
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-muted">
              Admin authentication is configured in the next milestone.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
