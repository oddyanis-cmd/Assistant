import { notFound } from 'next/navigation';
import Link         from 'next/link';
import type { Metadata } from 'next';
import { SiteNav }    from '@/components/marketing/SiteNav';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { formatCents, formatDateInTz, formatTimeInTz } from '@/lib/time';
import { prisma }     from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const appointment = await prisma.appointment.findUnique({
    where:  { cancelToken: token },
    select: { service: { select: { name: true } } },
  });

  return {
    title:       appointment ? `Booking Confirmed — ${appointment.service.name}` : 'Booking Confirmation',
    description: 'Your appointment at Belza Salon is confirmed. View your details and manage your booking.',
  };
}

interface PageProps {
  params:      Promise<{ token: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}

export default async function ConfirmationPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp        = await searchParams;
  const showCancelledUi = sp.cancelled === '1';

  const [appointment, settings] = await Promise.all([
    prisma.appointment.findUnique({
      where:   { cancelToken: token },
      include: {
        service: { select: { name: true, durationMinutes: true } },
        staff:   { select: { name: true, title: true } },
        client:  { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.settings.findFirst({
      select: { timezone: true, addressLine: true, salonName: true },
    }),
  ]);

  if (!appointment) return notFound();

  const tz        = settings?.timezone  ?? 'America/New_York';
  const address   = settings?.addressLine ?? null;
  const salonName = settings?.salonName   ?? 'Belza Salon';

  const startsAt = new Date(appointment.startsAt);
  const endsAt   = new Date(appointment.endsAt);

  const dateLabel  = formatDateInTz(startsAt, tz);
  const startLabel = formatTimeInTz(startsAt, tz);
  const endLabel   = formatTimeInTz(endsAt,   tz);
  const timeRange  = `${startLabel} – ${endLabel}`;

  const isCancelled = appointment.status === 'CANCELLED' || showCancelledUi;

  // Short reference: last 8 chars of ID uppercased
  const ref = appointment.id.slice(-8).toUpperCase();

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
        <div className="w-full max-w-lg">

          {isCancelled ? (
            /* ── CANCELLED STATE ─────────────────────────────────────── */
            <div className="bg-surface rounded-card border border-border-subtle shadow-card p-8 text-center">
              <div
                className="w-20 h-20 rounded-full bg-surface-alt border-4 border-border flex items-center justify-center mx-auto mb-6"
                role="img"
                aria-label="Booking cancelled"
              >
                <svg className="w-10 h-10 text-muted" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>

              <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
                Booking Cancelled
              </h1>
              <p className="text-text-secondary text-sm mb-6">
                Your appointment for{' '}
                <strong className="text-text-primary">{appointment.service.name}</strong>{' '}
                has been cancelled. We hope to see you again soon.
              </p>

              {/* Cancelled appointment for reference */}
              <div className="bg-surface-alt rounded-xl border border-border p-5 text-left mb-6 opacity-60">
                <p className="text-xs text-muted uppercase tracking-wide font-semibold mb-2">
                  Cancelled appointment
                </p>
                <p className="text-sm font-semibold text-text-primary mb-0.5">
                  {appointment.service.name}
                </p>
                <p className="text-xs text-text-secondary">
                  {dateLabel} at {startLabel}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href="/book"
                  className="block w-full text-center py-3 px-6 bg-primary-500 text-white font-semibold text-sm rounded-pill hover:bg-primary-600 active:bg-primary-700 transition-colors"
                >
                  Book a New Appointment
                </Link>
                <Link
                  href="/"
                  className="block text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  &larr; Back to Belza Salon
                </Link>
              </div>
            </div>

          ) : (
            /* ── CONFIRMED STATE ─────────────────────────────────────── */
            <div className="bg-surface rounded-card border border-border-subtle shadow-card p-8 text-center">

              {/* Animated checkmark ring */}
              <div
                className="w-20 h-20 rounded-full bg-success-100 border-4 border-success-500 flex items-center justify-center mx-auto mb-6"
                role="img"
                aria-label="Booking confirmed"
              >
                <svg className="w-10 h-10 text-success-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
                You&apos;re all booked!
              </h1>
              <p className="text-text-secondary text-sm mb-6">
                We&apos;ve sent a confirmation to{' '}
                <strong className="text-text-primary">{appointment.client.email}</strong>.{' '}
                We look forward to seeing you!
              </p>

              {/* Appointment details card */}
              <div className="bg-surface-alt rounded-xl border border-border p-5 text-left mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-500 shrink-0"
                    aria-hidden="true"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{appointment.service.name}</p>
                    <p className="text-xs text-text-secondary">Reference: BLZ-{ref}</p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Date</dt>
                    <dd className="text-text-primary font-medium">{dateLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Time</dt>
                    <dd className="text-text-primary font-medium">{timeRange}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Stylist</dt>
                    <dd className="text-text-primary font-medium">{appointment.staff.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Price</dt>
                    <dd className="text-text-primary font-medium">
                      {formatCents(appointment.priceCents, appointment.currency)}
                    </dd>
                  </div>
                  {address && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Location</dt>
                      <dd className="text-text-primary font-medium">
                        {salonName} &middot; {address}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Cancellation policy */}
              <CancelSection token={token} startsAt={startsAt} />

              {/* Back to home */}
              <div className="mt-6 pt-6 border-t border-border-subtle">
                <Link
                  href="/"
                  className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  &larr; Back to Belza Salon
                </Link>
              </div>
            </div>
          )}

        </div>
      </main>

      <SiteFooter />
    </>
  );
}

// ── Cancel section: server-rendered, policy check ─────────────────────────
function CancelSection({ token, startsAt }: { token: string; startsAt: Date }) {
  const hoursUntil = (startsAt.getTime() - Date.now()) / 1000 / 3600;
  const canCancel  = hoursUntil > 24;

  return (
    <p className="text-xs text-muted">
      {canCancel ? (
        <>
          Need to cancel?{' '}
          <Link
            href={`/book/confirmation/${token}/cancel`}
            className="text-primary-600 hover:underline font-medium"
          >
            Cancel this booking
          </Link>
          {' — '}free cancellation up to 24 hours before your appointment.
        </>
      ) : (
        <>
          Cancellations must be made more than 24 hours in advance. Contact us directly to make changes.
        </>
      )}
    </p>
  );
}
