import Link from 'next/link';
import { prisma } from '@/lib/db';
import { SiteNav } from '@/components/marketing/SiteNav';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { formatCents, formatDuration } from '@/lib/time';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Explore Belza Salon\'s full menu of hair and beauty services. From cuts to colour to treatments. Book online.',
};

export const dynamic = 'force-dynamic';

async function getServicesData() {
  return prisma.serviceCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      services: {
        where:   { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 6v6l4 2" />
    </svg>
  );
}

export default async function ServicesPage() {
  const categories = await getServicesData();
  const totalCount = categories.reduce((acc, cat) => acc + cat.services.length, 0);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      <SiteNav />

      <main id="main-content" className="pt-16 pb-20">
        {/* ── PAGE HEADER ─────────────────────────────────────── */}
        <div className="bg-surface-alt border-b border-border px-4 sm:px-6 py-10 sm:py-14">
          <div className="max-w-6xl mx-auto">
            <nav aria-label="Breadcrumb" className="mb-4">
              <ol className="flex items-center gap-1.5 text-xs text-muted" role="list">
                <li><Link href="/" className="hover:text-text-secondary transition-colors">Home</Link></li>
                <li aria-hidden="true">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </li>
                <li aria-current="page" className="text-text-secondary font-medium">Services</li>
              </ol>
            </nav>
            <h1
              className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3"
              style={{ letterSpacing: '-0.015em', lineHeight: '1.15' }}
            >
              Our Services
            </h1>
            <p className="text-text-secondary text-base max-w-xl">
              Every treatment is delivered by certified stylists using premium products.
              Browse and book online — no phone calls needed.
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
          {/* Service count */}
          <p className="text-sm text-muted mb-8" aria-live="polite">
            Showing <strong className="text-text-primary">{totalCount}</strong> services
          </p>

          {/* ── CATEGORIES ────────────────────────────────────── */}
          {categories.length === 0 ? (
            <div className="bg-surface rounded-card border border-border-subtle p-10 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-surface-alt flex items-center justify-center text-muted" aria-hidden="true">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <p className="text-base font-semibold text-text-primary">No services available</p>
              <p className="text-sm text-text-secondary">Please run the database seed to populate services.</p>
            </div>
          ) : (
            categories.map((category) => (
              <section key={category.id} aria-labelledby={`cat-${category.id}`} className="mb-14">
                <h2
                  id={`cat-${category.id}`}
                  className="text-xl font-semibold text-text-primary mb-1 flex items-center gap-2"
                >
                  {category.name}
                  <span className="text-sm font-normal text-muted">({category.services.length})</span>
                </h2>
                {category.description && (
                  <p className="text-sm text-text-secondary mb-6">{category.description}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {category.services.map((service) => (
                    <article
                      key={service.id}
                      className="bg-surface rounded-card shadow-card hover:shadow-card-hover border border-border-subtle overflow-hidden transition-shadow duration-300 group flex flex-col"
                    >
                      {/* Image placeholder */}
                      <div
                        className="relative aspect-[4/3] bg-gradient-to-br from-primary-100 to-primary-300 overflow-hidden flex items-center justify-center"
                        aria-hidden="true"
                      >
                        <svg className="w-12 h-12 text-primary-400/60" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        <span className="absolute top-3 left-3 px-2.5 py-1 bg-surface/90 backdrop-blur-sm rounded-pill text-xs font-semibold text-text-secondary border border-border-subtle">
                          {category.name}
                        </span>
                      </div>

                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-sm font-semibold text-text-primary mb-0.5">{service.name}</h3>
                        {service.description && (
                          <p className="text-xs text-text-secondary mb-3 line-clamp-2 flex-1">{service.description}</p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-text-secondary mb-3">
                          <span className="flex items-center gap-1">
                            <ClockIcon />
                            {formatDuration(service.durationMinutes)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-base font-semibold text-text-primary">
                            {formatCents(service.priceCents, service.currency)}
                          </span>
                          <Link
                            href={`/book?serviceId=${service.id}`}
                            className="px-4 py-1.5 bg-primary-500 text-white text-xs font-semibold rounded-pill hover:bg-primary-600 active:bg-primary-700 transition-colors"
                            aria-label={`Book ${service.name} — ${formatDuration(service.durationMinutes)} — ${formatCents(service.priceCents, service.currency)}`}
                          >
                            Book
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        {/* Mobile sticky CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface border-t border-border shadow-lg md:hidden z-40" role="complementary" aria-label="Quick book">
          <Link
            href="/book"
            className="block w-full text-center py-3.5 bg-primary-500 text-white font-semibold text-sm rounded-pill hover:bg-primary-600 transition-colors"
          >
            Book an Appointment
          </Link>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
