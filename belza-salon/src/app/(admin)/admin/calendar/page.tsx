import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { format, startOfWeek, addDays } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { CalendarWeek, type CalendarAppointment } from '@/components/admin/CalendarWeek';
import Link from 'next/link';

export const metadata = { title: 'Calendar — Belza Admin' };

interface PageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user) redirect('/login');

  // ── Settings ───────────────────────────────────────────────────────────────
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  const tz       = settings?.timezone ?? 'America/New_York';

  // ── Resolve week start from ?week=YYYY-MM-DD or current week ──────────────
  const params      = await searchParams;
  const weekParam   = params?.week;

  // Build "today" in the salon timezone
  const nowLocal  = new TZDate(new Date(), tz);
  const todayIso  = format(nowLocal, 'yyyy-MM-dd');

  let weekStartDate: Date;
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    // Parse the given date and find that week's Monday
    const parsed = new Date(weekParam + 'T12:00:00Z');
    weekStartDate = startOfWeek(parsed, { weekStartsOn: 1 });
  } else {
    weekStartDate = startOfWeek(nowLocal, { weekStartsOn: 1 });
  }

  const weekStartIso = format(weekStartDate, 'yyyy-MM-dd');
  const weekEnd      = addDays(weekStartDate, 7);

  // ── Query appointments for the week ───────────────────────────────────────
  const rows = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: weekStartDate, lt: weekEnd },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      client:  { select: { firstName: true, lastName: true } },
      service: { select: { name: true, durationMinutes: true } },
      staff:   { select: { name: true } },
    },
  });

  const appointments: CalendarAppointment[] = rows.map((a) => ({
    id:              a.id,
    startsAt:        a.startsAt.toISOString(),
    endsAt:          a.endsAt.toISOString(),
    status:          a.status,
    clientName:      `${a.client.firstName} ${a.client.lastName ?? ''}`.trim(),
    staffName:       a.staff.name,
    serviceName:     a.service.name,
    durationMinutes: a.service.durationMinutes,
  }));

  const weekStartDisplay  = format(weekStartDate, 'd MMM');
  const weekEndDisplay    = format(addDays(weekStartDate, 5), 'd MMM yyyy');

  return (
    <>
      {/* ── Top bar ── */}
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 sm:px-6 shadow-[0_1px_0_0_rgba(44,34,32,0.08)] shrink-0 z-10">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Calendar</h1>
          <p className="text-xs text-muted hidden sm:block">
            Week of {weekStartDisplay}–{weekEndDisplay}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/appointments"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 border border-border text-sm font-medium rounded-pill text-text-secondary hover:bg-surface-alt transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            List view
          </Link>
          <Link
            href="/admin/appointments/new"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-pill hover:bg-primary-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New
          </Link>
        </div>
      </header>

      {/* ── Calendar client component ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <CalendarWeek
          weekStartIso={weekStartIso}
          appointments={appointments}
          todayIso={todayIso}
          timezone={tz}
        />
      </div>
    </>
  );
}
