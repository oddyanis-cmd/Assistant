/**
 * KPI + dashboard queries — called from Server Components only.
 * All heavy reads live here; admin mutations go in server/actions/.
 */

import { prisma } from '@/lib/db';
import { TZDate } from '@date-fns/tz';
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';

export type Range = 'today' | 'week' | 'month';

function getRangeUTC(range: Range, timezone: string) {
  // Build a TZDate for "now" in the salon timezone — its wall-clock methods
  // return values in the target timezone, so date-fns helpers work correctly.
  const nowLocal = new TZDate(new Date(), timezone);

  let fromLocal: Date;
  let toLocal:   Date;

  if (range === 'today') {
    fromLocal = startOfDay(nowLocal);
    toLocal   = endOfDay(nowLocal);
  } else if (range === 'week') {
    fromLocal = startOfWeek(nowLocal, { weekStartsOn: 1 });
    toLocal   = endOfWeek(nowLocal,   { weekStartsOn: 1 });
  } else {
    // month
    fromLocal = new TZDate(nowLocal.getFullYear(), nowLocal.getMonth(), 1, 0, 0, 0, 0, timezone);
    toLocal   = new TZDate(nowLocal.getFullYear(), nowLocal.getMonth() + 1, 0, 23, 59, 59, 999, timezone);
  }

  // getTime() gives us UTC epoch ms — correct for DB queries
  return {
    fromUTC: new Date(fromLocal.getTime()),
    toUTC:   new Date(toLocal.getTime()),
  };
}

export async function getDashboardKPIs(range: Range = 'today') {
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  const tz = settings?.timezone ?? 'America/New_York';
  const { fromUTC, toUTC } = getRangeUTC(range, tz);

  const [appointments, newClients] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startsAt: { gte: fromUTC, lte: toUTC },
        status:   { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW', 'PENDING_PAYMENT'] },
      },
      select: { id: true, status: true, priceCents: true },
    }),
    prisma.client.count({
      where: { createdAt: { gte: fromUTC, lte: toUTC } },
    }),
  ]);

  const completed   = appointments.filter((a) => a.status === 'COMPLETED');
  const revenueCents = completed.reduce((sum, a) => sum + a.priceCents, 0);
  const avgCents    = completed.length > 0 ? Math.round(revenueCents / completed.length) : 0;
  const upcoming    = appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'PENDING_PAYMENT').length;
  const doneCount   = completed.length;

  return {
    revenueCents,
    appointmentCount:  appointments.length,
    completedCount:    doneCount,
    upcomingCount:     upcoming,
    newClientCount:    newClients,
    avgServiceCents:   avgCents,
  };
}

export async function getTodayAppointments() {
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  const tz = settings?.timezone ?? 'America/New_York';
  const { fromUTC, toUTC } = getRangeUTC('today', tz);

  return prisma.appointment.findMany({
    where: {
      startsAt: { gte: fromUTC, lte: toUTC },
      status:   { not: 'CANCELLED' },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      client:  { select: { firstName: true, lastName: true, email: true } },
      service: { select: { name: true, durationMinutes: true } },
      staff:   { select: { id: true, name: true } },
    },
  });
}

export async function getWeekCalendarAppointments(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return prisma.appointment.findMany({
    where: {
      startsAt: { gte: weekStart, lt: weekEnd },
      status:   { not: 'CANCELLED' },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      client:  { select: { firstName: true, lastName: true } },
      service: { select: { name: true, durationMinutes: true } },
      staff:   { select: { id: true, name: true } },
    },
  });
}

export async function getWeeklyRevenue(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const rows = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: weekStart, lt: weekEnd },
      status:   'COMPLETED',
    },
    select: { startsAt: true, priceCents: true },
  });

  // Group by day-of-week (0=Mon..6=Sun for display)
  const byDay: number[] = Array(7).fill(0);
  for (const row of rows) {
    const day = (row.startsAt.getDay() + 6) % 7; // JS 0=Sun → Mon=1 → shift to Mon=0
    byDay[day] += row.priceCents;
  }
  return byDay;
}
