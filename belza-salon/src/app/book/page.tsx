import type { Metadata } from 'next';
import { SiteNav }    from '@/components/marketing/SiteNav';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { BookingStepper } from '@/components/booking/BookingStepper';

export const metadata: Metadata = {
  title:       'Book an Appointment',
  description: 'Book your next hair or beauty appointment at Belza Salon. Choose your service, pick a time, and confirm online — no phone call needed.',
};

interface BookPageProps {
  searchParams: Promise<{ serviceId?: string }>;
}

export default async function BookPage({ searchParams }: BookPageProps) {
  // Next 15: searchParams is async
  const params          = await searchParams;
  const initialServiceId = params.serviceId ?? undefined;

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      <SiteNav />

      <main id="main-content" className="pt-16 pb-20 min-h-screen">
        {/* ── PAGE HEADER ─────────────────────────── */}
        <div className="bg-surface-alt border-b border-border px-4 sm:px-6 py-10 sm:py-14">
          <div className="max-w-3xl mx-auto">
            <nav aria-label="Breadcrumb" className="mb-4">
              <ol className="flex items-center gap-1.5 text-xs text-muted" role="list">
                <li>
                  <a href="/" className="hover:text-text-secondary transition-colors">
                    Home
                  </a>
                </li>
                <li aria-hidden="true">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </li>
                <li aria-current="page" className="text-text-secondary font-medium">
                  Book an Appointment
                </li>
              </ol>
            </nav>

            <h1
              className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3"
              style={{ letterSpacing: '-0.015em', lineHeight: '1.15' }}
            >
              Book an Appointment
            </h1>
            <p className="text-text-secondary text-base max-w-xl">
              Choose your service, pick a time that works for you, and we'll take care of the rest.
            </p>
          </div>
        </div>

        {/* ── STEPPER ─────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-10">
          <BookingStepper initialServiceId={initialServiceId} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
