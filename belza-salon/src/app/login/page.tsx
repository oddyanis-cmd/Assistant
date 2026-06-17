'use client';

/**
 * Admin Login page — matches Dana's admin-login.html design.
 * Signs in via NextAuth Credentials provider + bcrypt password check.
 */

import { useState, useTransition } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get('callbackUrl') ?? '/admin';

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError('Incorrect email or password. Please try again.');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:flex-col lg:justify-between lg:w-[44%] xl:w-[40%] relative overflow-hidden p-10 shrink-0" style={{ backgroundColor: '#2c1a18' }}>
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #2c1a18 0%, #3d2520 50%, #4a2e26 100%)' }} />
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 15% 30%, rgba(212,97,79,0.5) 0%, transparent 50%), radial-gradient(circle at 85% 70%, rgba(217,136,24,0.3) 0%, transparent 45%)' }} />
        </div>

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 w-fit" aria-label="Belza Salon — home">
            <span className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center text-white font-display font-bold text-lg" aria-hidden="true">B</span>
            <span className="font-display text-xl font-bold text-white">Belza</span>
          </Link>
        </div>

        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#ecbd5e' }}>Admin Panel</p>
          <h1 className="font-display font-bold mb-4 leading-tight text-white" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', letterSpacing: '-0.02em' }}>
            Manage your salon.<br />
            <em className="not-italic" style={{ color: '#efafa3' }}>Effortlessly.</em>
          </h1>
          <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Appointments, client records, team schedules, and business analytics — all in one place.
          </p>
          <ul className="space-y-3 mt-8" role="list">
            {[
              'Real-time appointment calendar',
              'Client history and preferences',
              'Revenue and analytics dashboards',
              'Automated booking confirmations',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(212,97,79,0.3)', border: '1px solid rgba(212,97,79,0.4)' }} aria-hidden="true">
                  <svg className="w-3 h-3" style={{ color: '#efafa3' }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>&copy; {new Date().getFullYear()} Belza Salon. All rights reserved.</p>
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-12 bg-background">

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Belza Salon — home">
            <span className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center text-white font-display font-bold text-lg" aria-hidden="true">B</span>
            <span className="font-display text-xl font-bold text-text-primary">Belza</span>
          </Link>
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary mb-2" style={{ letterSpacing: '-0.01em' }}>
              Welcome back
            </h2>
            <p className="text-text-secondary text-sm">Sign in to your Belza admin account.</p>
          </div>

          {/* Error alert */}
          {error && (
            <div role="alert" aria-live="polite" className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-danger-50 border border-danger-100">
              <svg className="w-5 h-5 shrink-0 mt-0.5 text-danger-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-danger">{error}</p>
                <p className="text-xs mt-0.5 text-danger">Please check your credentials and try again.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate aria-label="Admin login form" className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username email"
                required
                aria-required="true"
                placeholder="you@belzasalon.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-muted hover:border-border-strong focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all duration-200 disabled:opacity-60"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isPending}
                  className="w-full px-4 py-3 pr-12 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-muted hover:border-border-strong focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all duration-200 disabled:opacity-60"
                />
                <button
                  type="button"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  aria-controls="login-password"
                  aria-pressed={showPass}
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-text-secondary transition-colors p-1"
                >
                  {showPass ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="w-full py-3.5 bg-primary-500 text-white font-semibold text-sm rounded-xl hover:bg-primary-600 active:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 transition-colors duration-200 shadow-sm disabled:opacity-70 inline-flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign In to Admin Panel'
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <p className="text-center text-xs text-muted">
            Not an admin?{' '}
            <Link href="/" className="text-primary-600 hover:underline font-medium">Visit the salon website</Link>
          </p>

          <div className="flex items-center gap-2 justify-center mt-6">
            <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-muted">Secured with 256-bit TLS encryption</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
