import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatCents } from '@/lib/time';
import { ClientNotesForm } from './ClientNotesForm';

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where:   { id },
    include: {
      appointments: {
        orderBy: { startsAt: 'desc' },
        take:    20,
        include: {
          service: { select: { name: true } },
          staff:   { select: { name: true } },
        },
      },
    },
  });
  if (!client) notFound();

  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  const tz       = settings?.timezone ?? 'America/New_York';

  const totalSpent = client.appointments
    .filter((a) => a.status === 'COMPLETED')
    .reduce((sum, a) => sum + a.priceCents, 0);

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
        <Link href="/admin/clients" className="p-2 rounded-lg text-text-secondary hover:bg-surface-alt transition-colors" aria-label="Back to clients">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-base font-semibold text-text-primary">{client.firstName} {client.lastName}</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Profile */}
          <div className="bg-surface rounded-card border border-border shadow-card p-6">
            <div className="flex items-start gap-4 mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(client.firstName + (client.lastName ?? ''))}&backgroundColor=fbe9e4&textColor=c04535&radius=50`}
                alt=""
                width="56"
                height="56"
                className="w-14 h-14 rounded-full shrink-0"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{client.firstName} {client.lastName}</h2>
                <p className="text-sm text-text-secondary">{client.email}</p>
                {client.phone && <p className="text-sm text-text-secondary">{client.phone}</p>}
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-4 text-sm border-t border-border pt-4">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Appointments</dt>
                <dd className="text-xl font-semibold text-text-primary">{client.appointments.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Total Spent</dt>
                <dd className="text-xl font-semibold text-text-primary">{formatCents(totalSpent, 'usd')}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Member Since</dt>
                <dd className="text-sm font-medium text-text-primary">{format(client.createdAt, 'd MMM yyyy')}</dd>
              </div>
            </dl>
          </div>

          {/* Admin notes */}
          <ClientNotesForm clientId={client.id} initialNotes={client.notes ?? ''} />

          {/* Appointment history */}
          <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Appointment History</h2>
            </div>
            {client.appointments.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted">No appointments yet.</div>
            ) : (
              <ul className="divide-y divide-border" role="list">
                {client.appointments.map((appt) => (
                  <li key={appt.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-alt/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{appt.service.name}</p>
                      <p className="text-xs text-text-secondary">
                        {new Intl.DateTimeFormat('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
                        }).format(appt.startsAt)} · {appt.staff.name}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-text-primary shrink-0">{formatCents(appt.priceCents, appt.currency)}</span>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-pill text-xs font-semibold ${statusBadge(appt.status)}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                    <Link
                      href={`/admin/appointments/${appt.id}`}
                      className="shrink-0 text-xs text-primary-600 hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </main>
    </>
  );
}
