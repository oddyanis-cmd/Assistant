/**
 * Slot generation engine — §4.1 of the blueprint.
 *
 * Inputs: serviceId, staffId (or "any"), date (YYYY-MM-DD salon tz)
 * Output: Array of { startsAt: Date (UTC), staffId: string }
 */

import { addMinutes, isAfter } from 'date-fns';
import { prisma } from './db';
import { localMinutesToUtc, dayOfWeekInTz } from './time';

export interface Slot {
  startsAt: Date;  // UTC
  staffId:  string;
  staffName: string;
}

export async function getAvailableSlots(
  serviceId: string,
  staffIdParam: string,
  dateStr: string,  // YYYY-MM-DD in salon tz
): Promise<Slot[]> {
  // ── 1. Load settings ────────────────────────────────────────────
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: 'singleton' } });
  const tz              = settings.timezone;
  const slotIntervalMin = settings.slotIntervalMin;
  const leadTimeMin     = settings.leadTimeMinutes;
  const maxAdvanceDays  = settings.maxAdvanceDays;

  // ── 1b. Validate date range ─────────────────────────────────────
  const now      = new Date();
  const todayStr = toDateString(now, tz);
  const maxDate  = addDays(todayStr, maxAdvanceDays);

  if (dateStr < todayStr || dateStr > maxDate) {
    return [];
  }

  // ── 2. Load service ─────────────────────────────────────────────
  const service = await prisma.service.findUnique({ where: { id: serviceId, isActive: true } });
  if (!service) return [];
  const blockMin = service.durationMinutes + service.bufferAfterMin;

  // ── 3. Resolve candidate staff ──────────────────────────────────
  const isAny = staffIdParam === 'any';
  const candidateStaff = await prisma.staff.findMany({
    where: {
      isActive: true,
      ...(isAny ? {} : { id: staffIdParam }),
      services: { some: { serviceId } },
    },
    include: { workingHours: true, timeOff: true },
  });

  // ── 4. Day of week in salon tz ──────────────────────────────────
  const dow = dayOfWeekInTz(dateStr, tz);

  // ── 5. Load existing appointments for this date (UTC window) ────
  // Window: start of date 00:00 → end of date 23:59:59 in salon tz
  const windowStart = localMinutesToUtc(dateStr, 0, tz);
  const windowEnd   = localMinutesToUtc(dateStr, 1439, tz);

  const staffIds = candidateStaff.map((s) => s.id);

  const existingAppts = await prisma.appointment.findMany({
    where: {
      staffId: { in: staffIds },
      status:  { in: ['CONFIRMED', 'PENDING_PAYMENT', 'COMPLETED'] },
      startsAt: { lt: addMinutes(windowEnd, blockMin) },
      endsAt:   { gt: windowStart },
    },
    select: { staffId: true, startsAt: true, endsAt: true },
  });

  // ── 6. Generate slots per staff member ──────────────────────────
  const leadCutoff = addMinutes(now, leadTimeMin);
  const slotMap    = new Map<string, { staffId: string; staffName: string }[]>();

  for (const staff of candidateStaff) {
    const hoursForDay = staff.workingHours.filter((wh) => wh.dayOfWeek === dow);
    if (hoursForDay.length === 0) continue;

    const staffAppts = existingAppts.filter((a) => a.staffId === staff.id);

    for (const window of hoursForDay) {
      const winStart = localMinutesToUtc(dateStr, window.startMinutes, tz);
      const winEnd   = localMinutesToUtc(dateStr, window.endMinutes, tz);

      let cursor = winStart;
      while (isAfter(addMinutes(cursor, blockMin), cursor)) {
        const candEnd = addMinutes(cursor, blockMin);

        // Must fit in the working window
        if (candEnd > winEnd) break;

        // Must be after lead-time cutoff
        if (cursor <= leadCutoff) {
          cursor = addMinutes(cursor, slotIntervalMin);
          continue;
        }

        // Must not overlap existing appointments
        const overlaps = staffAppts.some(
          (a) => a.startsAt < candEnd && a.endsAt > cursor,
        );

        // Must not overlap time-off
        const timeOffBlock = staff.timeOff.some(
          (to) => to.startsAt < candEnd && to.endsAt > cursor,
        );

        if (!overlaps && !timeOffBlock) {
          const key = cursor.toISOString();
          if (!slotMap.has(key)) slotMap.set(key, []);
          slotMap.get(key)!.push({ staffId: staff.id, staffName: staff.name });
        }

        cursor = addMinutes(cursor, slotIntervalMin);
      }
    }
  }

  // ── 7. Flatten and sort ─────────────────────────────────────────
  const slots: Slot[] = [];
  for (const [isoKey, staffOptions] of Array.from(slotMap.entries())) {
    // For "any": emit one slot per startsAt (pick first available staff at render)
    // For specific staff: emit just that staff's slot
    if (isAny) {
      // Emit all available staff per slot so the UI can display "Any available"
      slots.push({
        startsAt:  new Date(isoKey),
        staffId:   staffOptions[0].staffId,
        staffName: staffOptions[0].staffName,
      });
    } else {
      if (staffOptions.length > 0) {
        slots.push({
          startsAt:  new Date(isoKey),
          staffId:   staffOptions[0].staffId,
          staffName: staffOptions[0].staffName,
        });
      }
    }
  }

  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return slots;
}

// ── Helpers ───────────────────────────────────────────────────────────

function toDateString(date: Date, tz: string): string {
  // Produce YYYY-MM-DD in the target timezone
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
  }).format(date);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
