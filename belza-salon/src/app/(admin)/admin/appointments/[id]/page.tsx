import { prisma } from '@/lib/db';
import { formatCents, formatDuration } from '@/lib/time';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { AppointmentActions } from './AppointmentActions';

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const appt = await prisma.appointment.findUnique({
    where:   { id },
    include: {
      client:  true,
      service: true,
      staff:   true,
      payment: true,
    },
  });

  if (!appt) notFound();

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  const tz       = settings?.timezone ?? 'America/New_York';

  function statusBadge(status: string) {
    switch (status) {
      case 'COMPLETED':       return 'bg-success-100 text-success-700';
      case 'CONFIRMED':       return 'bg-primary-100 text-primary-700';
      case 'NO_SHOW':         return 'bg-danger-100 text-danger-700';
      case 'CANCELLED':       return 'bg-surface-alt text-muted';
      case 'PENDING_PAYMENT': return 'bg-warning-100 text-warning-700';
      default:                return 'bg-surface-alt text-muted';
    }
  }

  return (
    <>
      <header className="h-16 bg-surface border-b border-border flex items-center px-4 sm:px-6 shadow-[0_1px_0_0_rgba(44,34,32,0.08)] shrink-0 z-10 gap-3">
        <Link href="/admin/appointments" className="p-2 rounded-lg text-text-secondary hover:bg-surface-alt transition-colors" aria-label="Back to appointments">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div>
          <h1 className="text-base font-semibold text-text-primary">Appointment</h1>
          <p className="text-xs text-muted hidden sm:block">{appt.client.firstName} {appt.client.lastName}</p>
        </div>
        <span className={`ml-auto px-2.5 py-0.5 rounded-pill text-xs font-semibold ${statusBadge(appt.status)}`}>
          {appt.status.replace('_', ' ')}
        </span>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Core details */}
          <div className="bg-surface rounded-card border border-border shadow-card p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Appointment Details</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Service</dt>
                <dd className="text-text-primary font-medium">{appt.service.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Duration</dt>
                <dd className="text-text-primary font-medium">{formatDuration(appt.service.durationMinutes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Date</dt>
                <dd className="text-text-primary font-medium">{format(appt.startsAt, 'EEEE, d MMMM yyyy')}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Time</dt>
                <dd className="text-text-primary font-medium">
                  {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).format(appt.startsAt)}
                  {' – '}
                  {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).format(appt.endsAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Stylist</dt>
                <dd className="text-text-primary font-medium">{appt.staff.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Price</dt>
                <dd className="text-text-primary font-medium">{formatCents(appt.priceCents, appt.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Source</dt>
                <dd className="text-text-primary font-medium capitalize">{appt.source}</dd>
              </div>
              {appt.notes && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Notes</dt>
                  <dd className="text-text-primary">{appt.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Client */}
          <div className="bg-surface rounded-card border border-border shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">Client</h2>
              <Link href={`/admin/clients/${appt.clientId}`} className="text-xs text-primary-600 hover:underline">View profile</Link>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Name</dt>
                <dd className="text-text-primary font-medium">{appt.client.firstName} {appt.client.lastName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Email</dt>
                <dd className="text-text-primary">{appt.client.email}</dd>
              </div>
              {appt.client.phone && (
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Phone</dt>
                  <dd className="text-text-primary">{appt.client.phone}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Payment */}
          {appt.payment && (
            <div className="bg-surface rounded-card border border-border shadow-card p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Payment</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Amount</dt>
                  <dd className="text-text-primary font-medium">{formatCents(appt.payment.amountCents, appt.payment.currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Status</dt>
                  <dd className="text-text-primary font-medium">{appt.payment.status}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Stripe ID</dt>
                  <dd className="text-text-primary text-xs font-mono">{appt.payment.stripePaymentIntentId}</dd>
                </div>
              </dl>
            </div>
          )}

          {/* Actions */}
          <AppointmentActions appointmentId={appt.id} status={appt.status} />

        </div>
      </main>
    </>
  );
}
