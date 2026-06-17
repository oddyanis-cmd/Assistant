'use client';

import { useState }     from 'react';
import { useRouter }    from 'next/navigation';
import Link             from 'next/link';
import { SiteNav }      from '@/components/marketing/SiteNav';
import { SiteFooter }   from '@/components/marketing/SiteFooter';

interface CancelPageProps {
  params: Promise<{ token: string }>;
}

export default function CancelPage({ params }: CancelPageProps) {
  const router  = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  async function handleCancel() {
    setState('loading');
    setErrMsg('');

    // Resolve params (Next 15 async params in client components via use() is not yet stable,
    // so we unwrap via a one-time effect alternative: read from the URL)
    const token = window.location.pathname.split('/').at(-2) ?? '';

    try {
      const res = await fetch(`/api/bookings/${token}/cancel`, { method: 'POST' });
      if (res.ok) {
        router.push(`/book/confirmation/${token}?cancelled=1`);
        return;
      }
      const body = await res.json().catch(() => ({}));
      setErrMsg(body.error ?? `Unexpected response (${res.status})`);
      setState('error');
    } catch {
      setErrMsg('Network error — please try again.');
      setState('error');
    }
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      <SiteNav />

      <main
        id="main-content"
        className="pt-16 min-h-screen bg-surface-alt flex items-center justify-center px-4 py-20"
      >
        <div className="w-full max-w-md">
          <div className="bg-surface rounded-card border border-border-subtle shadow-card p-8 text-center">

            {/* Warning icon */}
            <div
              className="w-16 h-16 rounded-full bg-amber-50 border-4 border-amber-400 flex items-center justify-center mx-auto mb-6"
              role="img"
              aria-label="Warning"
            >
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>

            <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
              Cancel this booking?
            </h1>
            <p className="text-text-secondary text-sm mb-8">
              This action cannot be undone. You can re-book at any time — subject to availability.
            </p>

            {errMsg && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6 text-left"
              >
                {errMsg}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={state === 'loading'}
                className="w-full py-3 px-6 bg-red-600 text-white font-semibold text-sm rounded-pill hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {state === 'loading' ? 'Cancelling…' : 'Yes, cancel my booking'}
              </button>

              <Link
                href=".."
                className="block w-full text-center py-3 px-6 border border-border text-sm font-medium text-text-secondary rounded-pill hover:bg-surface-alt hover:border-border-strong transition-colors"
              >
                Keep my booking
              </Link>
            </div>

          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
