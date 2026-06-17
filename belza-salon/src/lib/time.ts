/**
 * Time helpers for Belza Salon.
 *
 * All DateTime values stored in DB are UTC.
 * StaffWorkingHours uses minutes-from-midnight in the salon's IANA timezone.
 *
 * Uses @date-fns/tz v1 (TZDate API) for DST-safe conversions:
 *   - new TZDate(utcDate, tz)                  — like toZonedTime()
 *   - new TZDate(y, m-1, d, h, mm, 0, 0, tz)  — like fromZonedTime()
 *
 * Plain date-fns functions (format, addMinutes, …) work on TZDate correctly
 * because TZDate extends Date and overrides getHours/getDay/etc. to return
 * values in the target timezone.
 */

import { TZDate } from '@date-fns/tz';
import { format, addMinutes } from 'date-fns';

// ── Core conversions ──────────────────────────────────────────────────

/**
 * Given a UTC Date, return a TZDate whose wall-clock accessors (.getHours(),
 * .getDay(), etc.) reflect the given IANA timezone.  Equivalent to the old
 * toZonedTime() from @date-fns/tz v0.
 */
export function utcToZoned(date: Date, tz: string): TZDate {
  return new TZDate(date, tz);
}

/**
 * Given a YYYY-MM-DD string and minutes-from-midnight (both expressed in the
 * salon's IANA timezone), return the equivalent UTC Date instant.
 *
 * Example: '2026-06-20', 540, 'America/New_York'
 *   → 9 : 00 EDT = 13 : 00 UTC
 *
 * Equivalent to the old fromZonedTime() + startOfDay().
 */
export function localMinutesToUtc(
  dateStr: string,  // YYYY-MM-DD in salon timezone
  minutes: number,  // minutes from midnight in salon timezone
  tz: string,
): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  // TZDate constructor: month is 0-indexed, tz in last position
  const local = new TZDate(year, month - 1, day, h, m, 0, 0, tz);
  // Convert to a plain UTC Date by using .getTime()
  return new Date(local.getTime());
}

/**
 * Return the day-of-week (0=Sun..6=Sat) for a YYYY-MM-DD date in a given
 * timezone.  Uses noon to avoid midnight-edge-case DST issues.
 */
export function dayOfWeekInTz(dateStr: string, tz: string): number {
  // Build a UTC instant for noon on the given date in the target tz
  const [year, month, day] = dateStr.split('-').map(Number);
  const noonLocal = new TZDate(year, month - 1, day, 12, 0, 0, 0, tz);
  // TZDate.getDay() returns the day-of-week in the target tz
  return noonLocal.getDay();
}

/**
 * Format a UTC Date as a human-readable time string in the salon timezone.
 * e.g.  "10:30 AM"
 */
export function formatTimeInTz(date: Date, tz: string): string {
  return format(new TZDate(date, tz), 'h:mm a');
}

/**
 * Format a UTC Date as a human-readable date string in the salon timezone.
 * e.g.  "Thursday, 25 June 2026"
 */
export function formatDateInTz(date: Date, tz: string): string {
  return format(new TZDate(date, tz), 'EEEE, d MMMM yyyy');
}

/**
 * Format a UTC Date as YYYY-MM-DD in the salon timezone.
 */
export function toDateStringInTz(date: Date, tz: string): string {
  return format(new TZDate(date, tz), 'yyyy-MM-dd');
}

/**
 * Minutes from midnight for a given UTC Date in a timezone.
 */
export function minutesFromMidnightInTz(date: Date, tz: string): number {
  const zoned = new TZDate(date, tz);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

// ── Formatting helpers ────────────────────────────────────────────────

/**
 * Format price in cents to a human-readable currency string.
 */
export function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Format duration in minutes to "Xh Ymin" or "Ymin".
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

// Re-export addMinutes for consumers that need to compute endsAt
export { addMinutes };
