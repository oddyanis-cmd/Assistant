import Link from 'next/link';
import { SiteNav } from '@/components/marketing/SiteNav';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Belza Salon — Where Beauty Meets Craft',
  description:
    'Premium hair and beauty studio. Expert colour, precision cuts, and transformative treatments. Book your appointment online in under 2 minutes.',
};

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white focus:rounded-lg focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>

      <SiteNav />

      <main id="main-content">
        {/* ── HERO ──────────────────────────────────────────────── */}
        <section
          className="relative pt-16 bg-[#2c2220] overflow-hidden"
          style={{ minHeight: '680px' }}
          aria-labelledby="hero-heading"
        >
          {/* Decorative gradient background */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#2c1a18] via-[#3d2520] to-[#4a2e26]"
            aria-hidden="true"
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 50%, rgba(212,97,79,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(217,136,24,0.2) 0%, transparent 40%), radial-gradient(circle at 60% 80%, rgba(212,97,79,0.2) 0%, transparent 40%)',
              }}
              aria-hidden="true"
            />
          </div>
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#2c1a18]/80 via-[#2c1a18]/50 to-transparent"
            aria-hidden="true"
          />

          {/* Content */}
          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 flex flex-col justify-center h-full min-h-[640px] lg:min-h-[680px]">
            <div className="max-w-xl">
              {/* Eyebrow */}
              <p className="inline-flex items-center gap-2 text-accent-300 text-xs font-semibold uppercase tracking-widest mb-4" aria-hidden="true">
                <span className="w-6 h-px bg-accent-300" />
                Premium Hair &amp; Beauty Studio
              </p>

              {/* Headline */}
              <h1
                id="hero-heading"
                className="font-display text-white font-bold leading-tight mb-5"
                style={{ fontSize: 'clamp(2.25rem, 5vw, 3.75rem)', lineHeight: '1.1', letterSpacing: '-0.02em' }}
              >
                Where Beauty<br />
                <em className="not-italic text-primary-300">Meets Craft</em>
              </h1>

              {/* Sub-headline */}
              <p className="text-white/75 text-base sm:text-lg leading-relaxed mb-8 max-w-md">
                Expert colour, precision cuts, and transformative treatments — all in a calm, curated space designed around you.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary-500 text-white font-semibold text-sm rounded-pill shadow-lg hover:bg-primary-600 active:bg-primary-700 transition-colors"
                >
                  Book an Appointment
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 backdrop-blur-sm text-white font-medium text-sm rounded-pill border border-white/20 hover:bg-white/20 transition-colors"
                >
                  Explore Services
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 mt-10">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5" aria-label="Rating: 4.9 out of 5 stars">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <StarIcon key={i} className="w-4 h-4 text-accent-300 fill-current" />
                    ))}
                  </div>
                  <span className="text-white/80 text-sm font-medium">4.9 · 340+ reviews</span>
                </div>
                <div className="w-px h-4 bg-white/20" aria-hidden="true" />
                <p className="text-white/70 text-sm">Est. 2014 · New York</p>
              </div>
            </div>
          </div>

          {/* Scroll cue */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/40" aria-hidden="true">
            <span className="text-xs tracking-widest uppercase">Scroll</span>
            <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </section>

        {/* ── SOCIAL PROOF STRIP ──────────────────────────────── */}
        <section className="bg-surface-alt border-y border-border py-5 px-4 sm:px-6" aria-label="Our accolades">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-center">
            {[
              { value: '8+',    label: 'Years of Excellence' },
              { value: '3',     label: 'Expert Stylists' },
              { value: '5,000+', label: 'Happy Clients' },
              { value: '8+',    label: 'Services Available' },
            ].map((stat, i, arr) => (
              <div key={stat.label} className="flex items-center gap-6 sm:gap-12">
                <div>
                  <p className="text-2xl font-semibold font-display text-text-primary">{stat.value}</p>
                  <p className="text-xs text-muted uppercase tracking-wide mt-0.5">{stat.label}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="w-px h-8 bg-border hidden sm:block" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURED SERVICES ─────────────────────────────── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 bg-background" aria-labelledby="featured-services-title">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-lg mx-auto mb-12">
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-widest mb-3" aria-hidden="true">Our Services</p>
              <h2
                id="featured-services-title"
                className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-4"
                style={{ lineHeight: '1.15', letterSpacing: '-0.015em' }}
              >
                Crafted for Every Look
              </h2>
              <p className="text-text-secondary text-base sm:text-body-lg leading-relaxed">
                From everyday cuts to complete colour transformations — your vision, realised.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  title:       'Hair Colour',
                  description: 'Highlights, balayage, ombré & full colour.',
                  from:        'From $85',
                  href:        '/services',
                  gradient:    'from-primary-200 to-primary-400',
                  iconColor:   'text-primary-600/30',
                },
                {
                  title:       'Cuts & Styling',
                  description: 'Precision cuts tailored to face shape and lifestyle.',
                  from:        'From $55',
                  href:        '/services',
                  gradient:    'from-accent-100 to-accent-300',
                  iconColor:   'text-accent-600/30',
                },
                {
                  title:       'Treatments',
                  description: 'Keratin, deep conditioning, scalp therapy & more.',
                  from:        'From $55',
                  href:        '/services',
                  gradient:    'from-[#f3e9e6] to-[#e8d5cf]',
                  iconColor:   'text-primary-400/40',
                },
              ].map((service) => (
                <Link
                  key={service.title}
                  href={service.href}
                  className="group bg-surface rounded-card shadow-card hover:shadow-card-hover border border-border-subtle overflow-hidden transition-shadow duration-300 block"
                >
                  <div className={`aspect-[4/3] bg-gradient-to-br ${service.gradient} relative overflow-hidden flex items-center justify-center`} aria-hidden="true">
                    <svg className={`w-16 h-16 ${service.iconColor}`} fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-text-primary mb-1 group-hover:text-primary-600 transition-colors">{service.title}</h3>
                    <p className="text-sm text-text-secondary">{service.description}</p>
                    <p className="text-sm font-semibold text-text-primary mt-3">{service.from}</p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link
                href="/services"
                className="inline-flex items-center gap-2 px-8 py-3 bg-surface border border-border-strong text-text-primary font-medium text-sm rounded-pill hover:bg-surface-alt hover:border-border transition-colors shadow-xs"
              >
                View all services
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ──────────────────────────────────── */}
        <section className="py-16 bg-surface border-y border-border" aria-labelledby="testimonials-title">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 id="testimonials-title" className="sr-only">What our clients say</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  quote:  '"Elena completely transformed my hair. The colour is exactly what I had in mind — I\'ve never felt so confident walking out of a salon."',
                  name:   'Laura M.',
                  seed:   'LM',
                  colors: 'backgroundColor=fbe9e4&textColor=c04535',
                },
                {
                  quote:  '"The booking process was seamless and the salon itself is absolutely beautiful. The keratin treatment has been a game-changer for me."',
                  name:   'Sara B.',
                  seed:   'SB',
                  colors: 'backgroundColor=faedd0&textColor=c16a12',
                },
                {
                  quote:  '"Consistent quality every single visit. The team genuinely listens and remembers what you like. My go-to salon for 4 years now."',
                  name:   'Nina K.',
                  seed:   'NK',
                  colors: 'backgroundColor=f3ede9&textColor=6b5e59',
                },
              ].map((t) => (
                <figure key={t.name} className="bg-background rounded-card p-6 border border-border-subtle">
                  <blockquote>
                    <p className="text-text-secondary text-sm leading-relaxed">{t.quote}</p>
                  </blockquote>
                  <figcaption className="flex items-center gap-3 mt-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${t.seed}&${t.colors}&radius=50`}
                      alt=""
                      width="36"
                      height="36"
                      className="w-9 h-9 rounded-full"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                      <div className="flex gap-0.5 mt-0.5" aria-label="5 stars">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <StarIcon key={i} className="w-3 h-3 text-accent-500 fill-current" />
                        ))}
                      </div>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── BOOKING CTA BAND ──────────────────────────────── */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 bg-primary-600" aria-labelledby="cta-title">
          <div className="max-w-2xl mx-auto text-center">
            <h2
              id="cta-title"
              className="font-display text-3xl sm:text-4xl font-bold text-white mb-4"
              style={{ lineHeight: '1.15' }}
            >
              Ready for your transformation?
            </h2>
            <p className="text-primary-100 text-base sm:text-body-lg mb-8">
              Book online in under 2 minutes. We&apos;re open Mon–Sat, 9am–6pm.
            </p>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 px-10 py-4 bg-white text-primary-600 font-semibold text-sm rounded-pill shadow-lg hover:bg-primary-50 active:bg-primary-100 transition-colors"
            >
              Book Your Appointment
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
