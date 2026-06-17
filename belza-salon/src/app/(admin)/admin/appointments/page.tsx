import { prisma } from '@/lib/db';
import { formatCents } from '@/lib/time';
import Link from 'next/link';
import { format, startOfWeek, addDays } from 'date-fns';

const CALENDAR_START = 8;  // 8 AM
const CALENDAR_ROWS  = 22; // 08:00–19:00, 30min each
const ROW_PX         = 48;

function eventColors(status: string) {
  switch (status) {
    case 'COMPLETED':       return { bg: 'bg-success-100', border: '#22c55e', text: 'text-success-700', sub: 'text-success-600' };
    case 'NO_SHOW':         return { bg: 'bg-danger-50',   border: '#ef4444', text: 'text-danger-600',  sub: 'text-danger-500' };
    case 'PENDING_PAYMENT': return { bg: 'bg-warning-100', border: '#fbbf24', text: 'text-warning-700', sub: 'text-warning-600' };
    default:                return { bg: 'bg-primary-100', border: '#d4614f', text: 'text-primary-700', sub: 'text-primary-600' };
  }
}

export default async function AppointmentsCalendarPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  const tz = settings?.timezone ?? 'America/New_York';

  const today    = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const weekEnd   = addDays(weekStart, 7);

  const appointments = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: weekStart, lt: weekEnd },
      status:   { not: 'CANCELLED' },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      client:  { select: { firstName: true, lastName: true } },
      service: { select: { name: true, durationMinutes: true, bufferAfterMin: true } },
      staff:   { select: { id: true, name: true } },
    },
  });

  const staff = await prisma.staff.findMany({
    where:   { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)); // Mon-Sat
  const todayStr = format(today, 'yyyy-MM-dd');

  // Place appointments in the right day column
  const byDay = new Map<string, typeof appointments>();
  for (const d of days) {
    byDay.set(format(d, 'yyyy-MM-dd'), []);
  }
  for (const a of appointments) {
    const dk = format(a.startsAt, 'yyyy-MM-dd');
    if (byDay.has(dk)) byDay.get(dk)!.push(a);
  }

  // Helper: px from 08:00 for a Date in UTC mapped to local display
  const topPx = (d: Date) => {
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const minFrom8 = (h - CALENDAR_START) * 60 + m;
    return (minFrom8 / 30) * ROW_PX;
  };
  const heightPx = (minutes: number) => (minutes / 30) * ROW_PX;

  return (
    <>
      {/* Top bar */}
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 sm:px-6 shadow-[0_1px_0_0_rgba(44,34,32,0.08)] shrink-0 z-10">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Appointments</h1>
          <p className="text-xs text-muted hidden sm:block">
            Week of {format(weekStart, 'd MMM')}–{format(addDays(weekStart, 5), 'd MMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href="/admin/appointments/new"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-pill hover:bg-primary-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New
          </Link>
        </div>
      </header>

      {/* Staff filter row */}
      <div className="bg-surface border-b border-border px-4 sm:px-6 py-2.5 flex items-center gap-3 shrink-0 overflow-x-auto" role="group" aria-label="Filter by stylist">
        <span className="text-xs font-semibold text-muted whitespace-nowrap">Stylist:</span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold bg-primary-500 text-white whitespace-nowrap">All</span>
        {staff.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-medium bg-surface border border-border text-text-secondary whitespace-nowrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(s.name)}&backgroundColor=d4614f&textColor=fff&radius=50`} alt="" width="16" height="16" className="w-4 h-4 rounded-full" aria-hidden="true" />
            {s.name.split(' ')[0]} {s.name.split(' ')[1]?.[0]}.
          </span>
        ))}
      </div>

      {/* Calendar area */}
      <main className="flex-1 overflow-auto" aria-label="Weekly calendar view">
        <div className="min-w-[640px]">

          {/* Day headers */}
          <div className="sticky top-0 z-30 bg-surface border-b border-border flex" aria-label="Week days">
            <div className="w-[52px] shrink-0 border-r border-border" />
            <div className="flex-1 grid grid-cols-6">
              {days.map((d) => {
                const ds   = format(d, 'yyyy-MM-dd');
                const isToday = ds === todayStr;
                return (
                  <div key={ds} className={`py-3 px-2 text-center border-r border-border last:border-r-0 ${isToday ? 'bg-primary-50' : ''}`}>
                    <p className={`text-xs font-medium ${isToday ? 'text-primary-600 font-semibold' : 'text-muted'}`}>{format(d, 'EEE')}</p>
                    {isToday ? (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-500 text-white text-lg font-semibold mt-0.5 leading-none">{format(d, 'd')}</span>
                    ) : (
                      <p className="text-lg font-semibold text-text-primary mt-0.5 leading-none">{format(d, 'd')}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time grid */}
          <div className="flex">
            {/* Time labels */}
            <div className="w-[52px] shrink-0 border-r border-border">
              {Array.from({ length: CALENDAR_ROWS }, (_, i) => {
                const hour  = CALENDAR_START + Math.floor(i / 2);
                const isHr  = i % 2 === 0;
                const label = isHr ? (hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`) : '';
                return (
                  <div key={i} className="h-12 flex items-start justify-end pr-2 pt-1">
                    <span className="text-xs text-muted">{label}</span>
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            <div className="flex-1 grid grid-cols-6">
              {days.map((d) => {
                const ds      = format(d, 'yyyy-MM-dd');
                const isToday = ds === todayStr;
                const dayAppts = byDay.get(ds) ?? [];

                return (
                  <div key={ds} className={`relative border-r border-border last:border-r-0 ${isToday ? 'bg-primary-50/30' : ''}`} style={{ height: CALENDAR_ROWS * ROW_PX }}>
                    {/* Background slot lines */}
                    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                      {Array.from({ length: CALENDAR_ROWS }, (_, i) => (
                        <div key={i} className={`h-12 ${i % 2 === 0 ? 'border-t border-border' : 'border-t border-dashed border-border'}`} />
                      ))}
                    </div>

                    {/* Events */}
                    {dayAppts.map((appt) => {
                      const top    = topPx(appt.startsAt);
                      const h      = heightPx(appt.service.durationMinutes + appt.service.bufferAfterMin);
                      const colors = eventColors(appt.status);
                      const timeStr = format(appt.startsAt, 'h:mm a');
                      return (
                        <Link
                          key={appt.id}
                          href={`/admin/appointments/${appt.id}`}
                          className={`absolute left-1 right-1 rounded-lg px-2 py-1.5 overflow-hidden cursor-pointer shadow-sm hover:shadow-md hover:translate-x-px transition-all border-l-4 focus-visible:outline-2 focus-visible:outline-primary-500 ${colors.bg}`}
                          style={{ top, height: Math.max(h, 28), borderLeftColor: colors.border }}
                          aria-label={`${timeStr} — ${appt.client.firstName} ${appt.client.lastName ?? ''} — ${appt.service.name}`}
                        >
                          <p className={`text-xs font-semibold truncate ${colors.text}`}>{timeStr}</p>
                          <p className={`text-xs font-medium truncate ${colors.text}`}>{appt.client.firstName} {appt.client.lastName}</p>
                          <p className={`text-xs truncate ${colors.sub}`}>{appt.service.name}</p>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
