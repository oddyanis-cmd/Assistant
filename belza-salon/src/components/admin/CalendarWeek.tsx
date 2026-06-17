'use client';

import { useRouter } from 'next/navigation';
import { format, addDays, subDays } from 'date-fns';

// ── Constants ──────────────────────────────────────────────────────────────────
const HOUR_START  = 8;   // 8 AM
const HOUR_END    = 19;  // 7 PM (last line)
const TOTAL_HOURS = HOUR_END - HOUR_START; // 11 hours displayed
const PX_PER_MIN  = 1.5; // 90px per hour, 1.5px per minute

// ── Types ──────────────────────────────────────────────────────────────────────
export interface CalendarAppointment {
  id:         string;
  startsAt:   string; // ISO string (UTC)
  endsAt:     string; // ISO string (UTC)
  status:     string;
  clientName: string;
  staffName:  string;
  serviceName: string;
  durationMinutes: number;
}

interface Props {
  weekStartIso: string;  // YYYY-MM-DD (Monday)
  appointments: CalendarAppointment[];
  todayIso:     string;  // YYYY-MM-DD
  timezone:     string;  // IANA tz string e.g. "America/New_York"
}

// ── Status colour palette ──────────────────────────────────────────────────────
function eventStyle(status: string): {
  bg: string; border: string; text: string; sub: string;
} {
  switch (status) {
    case 'COMPLETED':
      return { bg: '#f0fdf4', border: '#16a34a', text: '#15803d', sub: '#16a34a' };
    case 'PENDING_PAYMENT':
      return { bg: '#fffbeb', border: '#d97706', text: '#92400e', sub: '#d97706' };
    case 'CANCELLED':
      return { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c', sub: '#dc2626' };
    default: // CONFIRMED
      return { bg: '#fdf5f3', border: '#d4614f', text: '#a0372a', sub: '#c04535' };
  }
}

// ── Hour labels ────────────────────────────────────────────────────────────────
function hourLabel(hour: number): string {
  if (hour === 12) return '12 PM';
  if (hour < 12)   return `${hour} AM`;
  return `${hour - 12} PM`;
}

// ── Compute pixel position from a UTC ISO string ───────────────────────────────
function minutesFromStartInTz(isoUtc: string, tz: string): number {
  const date = new Date(isoUtc);
  const local = new Intl.DateTimeFormat('en-US', {
    hour:     'numeric',
    minute:   '2-digit',
    hour12:   false,
    timeZone: tz,
  }).format(date);
  // "HH:MM" — Intl uses "24" for midnight in some locales; handle "24:xx"
  const [hStr, mStr] = local.replace('24:', '0:').split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  return (h - HOUR_START) * 60 + m;
}

function topPx(isoUtc: string, tz: string): number {
  return minutesFromStartInTz(isoUtc, tz) * PX_PER_MIN;
}

function heightPx(durationMin: number): number {
  return Math.max(durationMin * PX_PER_MIN, 24);
}

// ── Format time for display ────────────────────────────────────────────────────
function fmtTime(isoUtc: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour:     'numeric',
    minute:   '2-digit',
    hour12:   true,
    timeZone: tz,
  }).format(new Date(isoUtc));
}

// ── Current time indicator ─────────────────────────────────────────────────────
function CurrentTimeLine({ tz }: { tz: string }) {
  const now       = new Date();
  const mins      = minutesFromStartInTz(now.toISOString(), tz);
  const totalMins = TOTAL_HOURS * 60;
  if (mins < 0 || mins > totalMins) return null;

  const top = mins * PX_PER_MIN;

  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-20"
      style={{ top }}
      aria-hidden="true"
    >
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-danger-500 shrink-0 -ml-1" />
        <div className="flex-1 h-px bg-danger-500" />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function CalendarWeek({ weekStartIso, appointments, todayIso, timezone }: Props) {
  const router = useRouter();

  const weekStart = new Date(weekStartIso + 'T12:00:00Z'); // noon to avoid TZ edge
  const days      = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });

  // Group appointments by YYYY-MM-DD in the salon timezone
  const byDay = new Map<string, CalendarAppointment[]>();
  for (const d of days) {
    const ds = format(d, 'yyyy-MM-dd'); // date-fns works on UTC midnight here; matches weekStartIso
    byDay.set(ds, []);
  }
  for (const appt of appointments) {
    // Convert startsAt to the salon's local date
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(appt.startsAt));
    if (byDay.has(localDate)) byDay.get(localDate)!.push(appt);
  }

  const GRID_HEIGHT = TOTAL_HOURS * 60 * PX_PER_MIN; // total height in px

  // Navigation
  const prevWeekIso = format(subDays(new Date(weekStartIso + 'T12:00:00Z'), 7), 'yyyy-MM-dd');
  const nextWeekIso = format(addDays(new Date(weekStartIso + 'T12:00:00Z'), 7), 'yyyy-MM-dd');

  const weekEndDay  = days[5]; // Saturday
  const weekLabel   = `${format(days[0], 'd MMM')} – ${format(weekEndDay, 'd MMM yyyy')}`;

  return (
    <div className="flex flex-col h-full">

      {/* ── Sub-header: week nav ── */}
      <div className="bg-surface border-b border-border px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`/admin/calendar?week=${prevWeekIso}`)}
            className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-text-primary min-w-[180px] text-center">{weekLabel}</span>
          <button
            type="button"
            onClick={() => router.push(`/admin/calendar?week=${nextWeekIso}`)}
            className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors"
            aria-label="Next week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={() => router.push('/admin/calendar')}
          className="text-xs font-medium text-primary-600 hover:underline"
        >
          Today
        </button>
      </div>

      {/* ── Calendar grid ── */}
      <div className="flex-1 overflow-auto" aria-label="Weekly calendar">
        <div className="min-w-[640px]">

          {/* Day headers */}
          <div className="sticky top-0 z-30 bg-surface border-b border-border flex" aria-label="Week days">
            {/* Gutter placeholder */}
            <div className="w-14 shrink-0 border-r border-border" />
            <div className="flex-1 grid grid-cols-6">
              {days.map((d) => {
                const ds      = format(d, 'yyyy-MM-dd');
                const isToday = ds === todayIso;
                return (
                  <div
                    key={ds}
                    className={`py-3 px-2 text-center border-r border-border last:border-r-0 ${isToday ? 'bg-primary-50' : ''}`}
                  >
                    <p className={`text-xs font-medium uppercase tracking-wide ${isToday ? 'text-primary-600 font-semibold' : 'text-muted'}`}>
                      {format(d, 'EEE')}
                    </p>
                    {isToday ? (
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-500 text-white text-lg font-semibold mt-0.5 leading-none">
                        {format(d, 'd')}
                      </span>
                    ) : (
                      <p className="text-lg font-semibold text-text-primary mt-0.5 leading-none">{format(d, 'd')}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time gutter + day columns */}
          <div className="flex">
            {/* Time labels */}
            <div className="w-14 shrink-0 border-r border-border" style={{ height: GRID_HEIGHT }}>
              {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                const hour = HOUR_START + i;
                return (
                  <div
                    key={hour}
                    className="flex items-start justify-end pr-2"
                    style={{
                      position:  'absolute',
                      top:       i * 60 * PX_PER_MIN - 8,
                      width:     56,
                    }}
                  >
                    <span className="text-[10px] text-muted tabular-nums leading-none">
                      {hour < HOUR_END ? hourLabel(hour) : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            <div className="flex-1 grid grid-cols-6" style={{ height: GRID_HEIGHT }}>
              {days.map((d) => {
                const ds        = format(d, 'yyyy-MM-dd');
                const isToday   = ds === todayIso;
                const dayAppts  = byDay.get(ds) ?? [];

                return (
                  <div
                    key={ds}
                    className={`relative border-r border-border last:border-r-0 ${isToday ? 'bg-primary-50/20' : ''}`}
                    style={{ height: GRID_HEIGHT }}
                  >
                    {/* Hour grid lines */}
                    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                        <div key={i} style={{ position: 'absolute', top: i * 60 * PX_PER_MIN, left: 0, right: 0 }}>
                          {/* Hour line */}
                          <div className="border-t border-border" />
                          {/* Half-hour dashed line */}
                          <div
                            className="border-t border-dashed border-border/60"
                            style={{ marginTop: 30 * PX_PER_MIN - 1 }}
                          />
                        </div>
                      ))}
                      {/* Final hour line at bottom */}
                      <div
                        className="border-t border-border absolute left-0 right-0"
                        style={{ top: TOTAL_HOURS * 60 * PX_PER_MIN }}
                      />
                    </div>

                    {/* Current time indicator (only on today) */}
                    {isToday && <CurrentTimeLine tz={timezone} />}

                    {/* Appointment events */}
                    {dayAppts.map((appt) => {
                      const top    = topPx(appt.startsAt, timezone);
                      const height = heightPx(appt.durationMinutes);
                      const style  = eventStyle(appt.status);
                      const timeStr = fmtTime(appt.startsAt, timezone);

                      return (
                        <button
                          key={appt.id}
                          type="button"
                          onClick={() => router.push(`/admin/appointments/${appt.id}`)}
                          className="absolute left-1 right-1 overflow-hidden cursor-pointer rounded-lg shadow-sm hover:shadow-md transition-all text-left focus-visible:outline-2 focus-visible:outline-offset-1"
                          style={{
                            top,
                            height:          Math.max(height, 28),
                            backgroundColor: style.bg,
                            borderLeft:      `3px solid ${style.border}`,
                            paddingLeft:     6,
                            paddingRight:    4,
                            paddingTop:      3,
                            paddingBottom:   3,
                          }}
                          aria-label={`${timeStr} — ${appt.clientName} — ${appt.serviceName} with ${appt.staffName}`}
                        >
                          <p className="text-[10px] font-semibold truncate leading-tight" style={{ color: style.text }}>
                            {timeStr}
                          </p>
                          <p className="text-[11px] font-semibold truncate leading-tight mt-0.5" style={{ color: style.text }}>
                            {appt.clientName}
                          </p>
                          {height >= 44 && (
                            <p className="text-[10px] truncate leading-tight mt-0.5" style={{ color: style.sub }}>
                              {appt.serviceName}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
