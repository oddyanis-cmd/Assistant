import { auth } from '@/lib/auth';
import { getDashboardKPIs, getTodayAppointments } from '@/server/queries/metrics';
import { formatCents } from '@/lib/time';
import Link from 'next/link';
import { format } from 'date-fns';

function statusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':       return 'bg-success-100 text-success-700';
    case 'CONFIRMED':       return 'bg-primary-100 text-primary-700';
    case 'NO_SHOW':         return 'bg-danger-100 text-danger-700';
    case 'PENDING_PAYMENT': return 'bg-warning-100 text-warning-700';
    default:                return 'bg-surface-alt text-muted';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'COMPLETED':       return 'Done';
    case 'CONFIRMED':       return 'Confirmed';
    case 'NO_SHOW':         return 'No-show';
    case 'PENDING_PAYMENT': return 'Pending Payment';
    default:                return status;
  }
}

function statusBarColor(status: string) {
  switch (status) {
    case 'COMPLETED':       return 'bg-success-500';
    case 'CONFIRMED':       return 'bg-primary-500';
    case 'NO_SHOW':         return 'bg-danger-500';
    case 'PENDING_PAYMENT': return 'bg-warning-500';
    default:                return 'bg-muted';
  }
}

export default async function AdminDashboard() {
  const session = await auth();
  const adminName = session?.user?.name?.split(' ')[0] ?? 'Admin';

  const [kpis, todayAppts] = await Promise.all([
    getDashboardKPIs('today'),
    getTodayAppointments(),
  ]);

  const todayStr = format(new Date(), 'EEEE, d MMMM yyyy');

  return (
    <>
      {/* Top bar */}
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 sm:px-6 shadow-[0_1px_0_0_rgba(44,34,32,0.08)] shrink-0 z-10">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Dashboard</h1>
          <p className="text-xs text-muted hidden sm:block">{todayStr}</p>
        </div>
        <Link
          href="/admin/appointments/new"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-pill hover:bg-primary-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New Appointment
        </Link>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

        {/* Welcome + range (static today for now) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-widest mb-1">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}</p>
            <h2 className="text-2xl font-semibold text-text-primary font-display">{adminName}</h2>
          </div>
          <div className="flex items-center gap-1 bg-surface-alt p-1 rounded-xl border border-border">
            <span className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-surface text-text-primary shadow-sm">Today</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <article className="bg-surface rounded-card border border-border shadow-card p-5" aria-label={`Revenue today: ${formatCents(kpis.revenueCents, 'usd')}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600" aria-hidden="true">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Revenue</p>
            <p className="text-2xl font-semibold text-text-primary font-display">{formatCents(kpis.revenueCents, 'usd')}</p>
          </article>

          <article className="bg-surface rounded-card border border-border shadow-card p-5" aria-label={`Appointments today: ${kpis.appointmentCount}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center text-accent-600" aria-hidden="true">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <span className="text-xs text-muted">Today</span>
            </div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Appointments</p>
            <p className="text-2xl font-semibold text-text-primary font-display">{kpis.appointmentCount}</p>
            <p className="text-xs text-text-secondary mt-1">{kpis.completedCount} done · {kpis.upcomingCount} upcoming</p>
          </article>

          <article className="bg-surface rounded-card border border-border shadow-card p-5" aria-label={`New clients today: ${kpis.newClientCount}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-success-100 flex items-center justify-center text-success-600" aria-hidden="true">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>
              <span className="px-2 py-0.5 text-xs font-semibold text-success-600 bg-success-100 rounded-pill">New</span>
            </div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">New Clients</p>
            <p className="text-2xl font-semibold text-text-primary font-display">{kpis.newClientCount}</p>
          </article>

          <article className="bg-surface rounded-card border border-border shadow-card p-5" aria-label={`Average service value today: ${formatCents(kpis.avgServiceCents, 'usd')}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600" aria-hidden="true">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
            </div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Avg. Value</p>
            <p className="text-2xl font-semibold text-text-primary font-display">{formatCents(kpis.avgServiceCents, 'usd')}</p>
          </article>
        </div>

        {/* Today's appointments table */}
        <section aria-labelledby="todays-appts-title" className="bg-surface rounded-card border border-border shadow-card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 id="todays-appts-title" className="text-base font-semibold text-text-primary">Today&apos;s Appointments</h2>
            <Link href="/admin/appointments" className="text-xs text-primary-600 hover:underline font-medium">View all</Link>
          </div>

          {todayAppts.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-semibold text-text-primary mb-1">No appointments today</p>
              <p className="text-xs text-text-secondary">Enjoy the peace, or <Link href="/admin/appointments/new" className="text-primary-600 hover:underline">add a walk-in</Link>.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border" role="list" aria-label="Today's appointments">
              {todayAppts.map((appt) => {
                const timeStr = format(appt.startsAt, 'h:mm');
                const ampm    = format(appt.startsAt, 'a');
                return (
                  <li key={appt.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-alt/50 transition-colors">
                    <div className="shrink-0 text-center w-12">
                      <time dateTime={appt.startsAt.toISOString()} className="text-xs font-semibold text-muted block">{timeStr}</time>
                      <span className="text-xs text-muted">{ampm}</span>
                    </div>
                    <div className={`w-1 h-10 rounded-full shrink-0 ${statusBarColor(appt.status)}`} aria-hidden="true" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(appt.client.firstName + (appt.client.lastName ?? ''))}&backgroundColor=fbe9e4&textColor=c04535&radius=50`}
                      alt=""
                      width="36"
                      height="36"
                      className="w-9 h-9 rounded-full shrink-0"
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{appt.client.firstName} {appt.client.lastName}</p>
                      <p className="text-xs text-text-secondary truncate">{appt.service.name} · {appt.staff.name}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-pill text-xs font-semibold ${statusBadge(appt.status)}`} role="status">
                      {statusLabel(appt.status)}
                    </span>
                    <Link
                      href={`/admin/appointments/${appt.id}`}
                      className="shrink-0 p-1.5 rounded-lg text-muted hover:text-text-primary hover:bg-surface-alt transition-colors"
                      aria-label={`View ${appt.client.firstName}'s appointment`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </main>
    </>
  );
}
