'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatCents, formatDuration } from '@/lib/time';

// Payments toggle — injected as a prop from the server component so the
// Stripe SDK never loads in the browser when payments are off.
const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

// ── Types ─────────────────────────────────────────────────────────────
interface ServiceCategory {
  id:          string;
  name:        string;
  description: string | null;
  services:    Service[];
}

interface Service {
  id:              string;
  name:            string;
  description:     string | null;
  durationMinutes: number;
  priceCents:      number;
  currency:        string;
  categoryId:      string;
}

interface StaffMember {
  id:       string;
  name:     string;
  title:    string | null;
  bio:      string | null;
  imageUrl: string | null;
}

interface Slot {
  startsAt:  string;  // ISO UTC
  staffId:   string;
  staffName: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

interface BookingState {
  service:     Service | null;
  staffId:     string;             // cuid or "any"
  staffName:   string;
  startsAt:    string | null;      // ISO UTC
  firstName:   string;
  lastName:    string;
  email:       string;
  phone:       string;
  notes:       string;
  marketingOptIn: boolean;
}

const INITIAL_STATE: BookingState = {
  service:     null,
  staffId:     'any',
  staffName:   'Any available',
  startsAt:    null,
  firstName:   '',
  lastName:    '',
  email:       '',
  phone:       '',
  notes:       '',
  marketingOptIn: false,
};

// ── Stepper indicator ─────────────────────────────────────────────────
const STEPS = PAYMENTS_ENABLED
  ? ['Service', 'Date & Time', 'Details', 'Confirm', 'Payment']
  : ['Service', 'Date & Time', 'Details', 'Confirm'];

function StepperNav({ current }: { current: Step }) {
  return (
    <nav aria-label="Booking progress" className="mb-8">
      <ol className="flex items-center max-w-lg mx-auto" role="list">
        {STEPS.map((label, idx) => {
          const step = (idx + 1) as Step;
          const done    = step < current;
          const active  = step === current;
          const last    = idx === STEPS.length - 1;

          return (
            <li
              key={label}
              className={`flex items-center ${last ? '' : 'flex-1'}`}
              aria-current={active ? 'step' : undefined}
            >
              <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 shrink-0">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    done
                      ? 'bg-primary-500 text-white'
                      : active
                      ? 'bg-primary-500 text-white ring-4 ring-primary-100'
                      : 'bg-surface border-2 border-border text-muted'
                  }`}
                  aria-label={`Step ${step}: ${label} ${done ? '(completed)' : active ? '(current)' : '(upcoming)'}`}
                >
                  {done ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step
                  )}
                </span>
                <span className={`text-xs font-medium hidden sm:block whitespace-nowrap ${done || active ? 'text-primary-600' : 'text-muted'} ${active ? 'font-semibold' : ''}`}>
                  {label}
                </span>
              </div>
              {!last && (
                <div
                  className={`flex-1 h-px mx-2 sm:mx-3 ${done ? 'bg-primary-300' : 'bg-border'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Booking summary sidebar ───────────────────────────────────────────
function BookingSummary({ booking, onChangeService }: { booking: BookingState; onChangeService?: () => void }) {
  const settings = useSalonSettings();

  const formatTime = (isoStr: string) => {
    if (!settings) return '';
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat('en-US', {
      hour:     'numeric',
      minute:   '2-digit',
      hour12:   true,
      timeZone: settings.timezone,
    }).format(d);
  };

  const formatDateLong = (isoStr: string) => {
    if (!settings) return '';
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat('en-US', {
      weekday:  'short',
      month:    'long',
      day:      'numeric',
      year:     'numeric',
      timeZone: settings.timezone,
    }).format(d);
  };

  const endTime = (isoStr: string) => {
    if (!booking.service || !settings) return '';
    const d = new Date(isoStr);
    const end = new Date(d.getTime() + (booking.service.durationMinutes + 0) * 60000);
    return new Intl.DateTimeFormat('en-US', {
      hour:     'numeric',
      minute:   '2-digit',
      hour12:   true,
      timeZone: settings.timezone,
    }).format(end);
  };

  return (
    <div className="bg-surface rounded-card border border-border-subtle p-5 sticky top-20">
      <h2 className="text-sm font-semibold text-text-primary mb-4">Your Booking</h2>

      {/* Service */}
      <div className="flex items-start gap-3 pb-4 border-b border-border-subtle">
        <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-500 shrink-0" aria-hidden="true">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">{booking.service?.name ?? '—'}</p>
          {booking.service && (
            <p className="text-xs text-text-secondary mt-0.5">{formatDuration(booking.service.durationMinutes)}</p>
          )}
        </div>
        {onChangeService && (
          <button
            type="button"
            onClick={onChangeService}
            className="text-xs text-primary-600 hover:underline shrink-0"
          >
            Change
          </button>
        )}
      </div>

      {/* Details */}
      <dl className="space-y-2.5 mt-4 text-sm">
        {booking.startsAt && (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-text-secondary">Date</dt>
              <dd className="text-text-primary font-medium text-right">{formatDateLong(booking.startsAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-secondary">Time</dt>
              <dd className="text-text-primary font-medium">{formatTime(booking.startsAt)} – {endTime(booking.startsAt)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-text-secondary">Stylist</dt>
          <dd className="text-text-primary font-medium">{booking.staffName}</dd>
        </div>
      </dl>

      {booking.service && (
        <div className="mt-4 pt-4 border-t border-border-subtle flex justify-between items-center">
          <span className="text-sm text-text-secondary">Total</span>
          <span className="text-lg font-semibold text-text-primary">
            {formatCents(booking.service.priceCents, booking.service.currency)}
          </span>
        </div>
      )}

      <p className="text-xs text-muted text-center mt-3">No payment required now. Cancel up to 24h before.</p>
    </div>
  );
}

// ── Salon settings hook ───────────────────────────────────────────────
function useSalonSettings() {
  const [settings, setSettings] = useState<{ timezone: string } | null>(null);

  useEffect(() => {
    // Fetch timezone from settings endpoint or default
    setSettings({ timezone: 'America/New_York' });
  }, []);

  return settings;
}

// ── STEP 1: Service Selection ─────────────────────────────────────────
function Step1Service({
  initialServiceId,
  onSelect,
}: {
  initialServiceId?: string;
  onSelect: (service: Service) => void;
}) {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/services')
      .then((r) => r.json())
      .then((data) => {
        setCategories(data.categories ?? []);
        // If a serviceId was pre-selected via URL param, auto-advance
        if (initialServiceId) {
          const svc = data.categories
            ?.flatMap((c: ServiceCategory) => c.services)
            .find((s: Service) => s.id === initialServiceId);
          if (svc) onSelect(svc);
        }
      })
      .finally(() => setLoading(false));
  }, [initialServiceId, onSelect]);

  const displayed = activeCategory
    ? categories.filter((c) => c.id === activeCategory)
    : categories;

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary" style={{ letterSpacing: '-0.01em' }}>
          Choose a service
        </h1>
        <p className="text-text-secondary text-sm mt-2">Select the service you'd like to book.</p>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap mb-8" role="group" aria-label="Filter by category">
        <button
          type="button"
          aria-pressed={activeCategory === null}
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-2 rounded-pill text-sm font-medium transition-colors ${
            activeCategory === null
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-surface border border-border text-text-secondary hover:bg-surface-alt'
          }`}
        >
          All Services
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={activeCategory === c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`px-4 py-2 rounded-pill text-sm font-medium transition-colors ${
              activeCategory === c.id
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-surface border border-border text-text-secondary hover:bg-surface-alt'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-surface rounded-card shadow-card border border-border-subtle overflow-hidden" aria-hidden="true">
              <div className="aspect-[4/3] skeleton" />
              <div className="p-4 space-y-3">
                <div className="skeleton h-4 w-3/4 rounded" />
                <div className="skeleton h-3 w-full rounded" />
                <div className="flex items-center justify-between mt-4">
                  <div className="skeleton h-5 w-12 rounded" />
                  <div className="skeleton h-8 w-16 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        displayed.map((category) => (
          <section key={category.id} aria-labelledby={`svc-cat-${category.id}`} className="mb-12">
            <h2 id={`svc-cat-${category.id}`} className="text-lg font-semibold text-text-primary mb-1 flex items-center gap-2">
              {category.name}
              <span className="text-sm font-normal text-muted">({category.services.length})</span>
            </h2>
            {category.description && (
              <p className="text-sm text-text-secondary mb-5">{category.description}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {category.services.map((service) => (
                <article
                  key={service.id}
                  className="bg-surface rounded-card shadow-card hover:shadow-card-hover border border-border-subtle overflow-hidden transition-shadow duration-300 group flex flex-col"
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-primary-100 to-primary-300 flex items-center justify-center" aria-hidden="true">
                    <svg className="w-12 h-12 text-primary-400/60" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-sm font-semibold text-text-primary mb-0.5">{service.name}</h3>
                    {service.description && (
                      <p className="text-xs text-text-secondary mb-3 line-clamp-2 flex-1">{service.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-text-secondary mb-3">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
                        </svg>
                        {formatDuration(service.durationMinutes)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-base font-semibold text-text-primary">{formatCents(service.priceCents, service.currency)}</span>
                      <button
                        type="button"
                        onClick={() => onSelect(service)}
                        className="px-4 py-1.5 bg-primary-500 text-white text-xs font-semibold rounded-pill hover:bg-primary-600 active:bg-primary-700 transition-colors"
                        aria-label={`Book ${service.name} — ${formatDuration(service.durationMinutes)} — ${formatCents(service.priceCents, service.currency)}`}
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

// ── STEP 2: Staff + Date + Time ───────────────────────────────────────
function Step2DateTime({
  booking,
  onUpdate,
  onNext,
  onBack,
}: {
  booking:  BookingState;
  onUpdate: (patch: Partial<BookingState>) => void;
  onNext:   () => void;
  onBack:   () => void;
}) {
  const [staffList, setStaffList]       = useState<StaffMember[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');  // YYYY-MM-DD
  const [slots, setSlots]               = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const timezone = 'America/New_York';

  // Fetch staff for this service
  useEffect(() => {
    if (!booking.service) return;
    fetch(`/api/staff?serviceId=${booking.service.id}`)
      .then((r) => r.json())
      .then((data) => setStaffList(data.staff ?? []));
  }, [booking.service]);

  // Fetch slots when date or staff changes
  useEffect(() => {
    if (!booking.service || !selectedDate) { setSlots([]); return; }
    setLoadingSlots(true);
    fetch(`/api/availability?serviceId=${booking.service.id}&staffId=${booking.staffId}&date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .finally(() => setLoadingSlots(false));
  }, [booking.service, booking.staffId, selectedDate]);

  // ── Calendar helpers ────────────────────────────────────────────
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0=Sun

  const { year, month } = calendarMonth;
  const totalDays  = daysInMonth(year, month);
  const firstDay   = firstDayOfMonth(year, month);

  const monthStr = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const makeDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isPast = (d: number) => makeDateStr(d) < todayStr;
  const isSunday = (d: number) => new Date(year, month, d).getDay() === 0;

  // Prev/Next month
  const prevMonth = () => setCalendarMonth(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 });
  const nextMonth = () => setCalendarMonth(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 });

  // Format slot time
  const formatSlotTime = (isoStr: string) =>
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }).format(new Date(isoStr));

  const canContinue = !!booking.startsAt;

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary" style={{ letterSpacing: '-0.01em' }}>
          Choose your date &amp; time
        </h1>
        <p className="text-text-secondary text-sm mt-2">Select a date, then a time that works for you.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-6">
          {/* Staff selector */}
          <div className="bg-surface rounded-card border border-border-subtle p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Select Stylist</h2>
            <div className="flex gap-3 flex-wrap" role="radiogroup" aria-label="Select your preferred stylist">
              {/* Any */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="stylist"
                  value="any"
                  className="sr-only"
                  checked={booking.staffId === 'any'}
                  onChange={() => onUpdate({ staffId: 'any', staffName: 'Any available', startsAt: null })}
                />
                <span className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 text-sm font-medium cursor-pointer transition-colors ${
                  booking.staffId === 'any'
                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                    : 'border-border bg-surface text-text-secondary hover:border-primary-300 hover:bg-primary-50'
                }`}>
                  <span className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-500" aria-hidden="true">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  Any stylist
                </span>
              </label>

              {staffList.map((staff) => (
                <label key={staff.id} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="stylist"
                    value={staff.id}
                    className="sr-only"
                    checked={booking.staffId === staff.id}
                    onChange={() => onUpdate({ staffId: staff.id, staffName: staff.name, startsAt: null })}
                  />
                  <span className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 text-sm font-medium cursor-pointer transition-colors ${
                    booking.staffId === staff.id
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-border bg-surface text-text-secondary hover:border-primary-300 hover:bg-primary-50'
                  }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(staff.name)}&backgroundColor=d4614f&textColor=fff&radius=50`}
                      alt=""
                      width="28"
                      height="28"
                      className="w-7 h-7 rounded-full"
                      aria-hidden="true"
                    />
                    {staff.name.split(' ')[0]} {staff.name.split(' ')[1]?.[0]}.
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-surface rounded-card border border-border-subtle p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-text-primary" id="calendar-label">
                <span aria-live="polite">{monthStr}</span>
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Go to previous month"
                  onClick={prevMonth}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Go to next month"
                  onClick={nextMonth}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div role="grid" aria-labelledby="calendar-label" className="w-full">
              {/* Day headers (Mon-first) */}
              <div role="row" className="grid grid-cols-7 mb-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i} role="columnheader" className={`text-center text-xs font-semibold py-1 ${i === 6 ? 'text-danger/60' : 'text-muted'}`}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              {(() => {
                const cells: (number | null)[] = [];
                // Offset: CSS grid starts Monday (index 0), but firstDay is 0=Sun
                const offset = (firstDay + 6) % 7; // convert Sun-first to Mon-first
                for (let i = 0; i < offset; i++) cells.push(null);
                for (let d = 1; d <= totalDays; d++) cells.push(d);
                // Pad to multiple of 7
                while (cells.length % 7 !== 0) cells.push(null);

                const rows = [];
                for (let r = 0; r < cells.length / 7; r++) {
                  rows.push(cells.slice(r * 7, r * 7 + 7));
                }

                return rows.map((row, ri) => (
                  <div key={ri} role="row" className="grid grid-cols-7 gap-y-1">
                    {row.map((day, ci) => {
                      if (!day) {
                        return <div key={ci} role="gridcell" />;
                      }
                      const dStr    = makeDateStr(day);
                      const past    = isPast(day) && dStr !== todayStr;
                      const sun     = isSunday(day);
                      const disable = past || sun;
                      const isSelected = dStr === selectedDate;
                      const isToday    = dStr === todayStr;

                      return (
                        <div key={ci} role="gridcell" className="flex justify-center">
                          <button
                            type="button"
                            disabled={disable}
                            aria-disabled={disable}
                            aria-label={`${day} ${monthStr}${isToday ? ' — today' : ''}${isSelected ? ' — selected' : ''}${disable ? ' — unavailable' : ''}`}
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedDate(dStr);
                              onUpdate({ startsAt: null });
                            }}
                            className={`
                              min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-sm transition-colors
                              ${disable
                                ? 'text-muted-subtle cursor-not-allowed'
                                : isSelected
                                ? 'bg-primary-500 text-white font-semibold'
                                : isToday
                                ? 'border-[1.5px] border-primary-500 text-primary-600 font-semibold hover:bg-primary-50'
                                : 'hover:bg-primary-100 hover:text-primary-600 text-text-primary'}
                            `}
                          >
                            {day}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border-subtle">
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-4 h-4 rounded-full border-2 border-primary-500 inline-block" aria-hidden="true" />
                Today
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-4 h-4 rounded-full bg-primary-500 inline-block" aria-hidden="true" />
                Selected
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="w-4 h-4 rounded-full bg-surface-alt inline-block" aria-hidden="true" />
                Unavailable
              </span>
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="bg-surface rounded-card border border-border-subtle p-5">
              <h2 className="text-sm font-semibold text-text-primary mb-1">
                Available times
                <span className="font-normal text-muted ml-1">
                  — {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
              </h2>
              {booking.service && (
                <p className="text-xs text-text-secondary mb-5">
                  All times shown in New York time. Each slot = {formatDuration(booking.service.durationMinutes)} for {booking.service.name}.
                </p>
              )}

              {loadingSlots ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="skeleton h-10 rounded-xl" aria-hidden="true" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-semibold text-text-primary mb-1">No availability</p>
                  <p className="text-xs text-text-secondary">No slots available for this date. Please try another day.</p>
                </div>
              ) : (
                <div
                  role="radiogroup"
                  aria-label={`Available appointment times for ${selectedDate}`}
                  className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2"
                >
                  {slots.map((slot) => {
                    const selected = booking.startsAt === slot.startsAt;
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onUpdate({ startsAt: slot.startsAt, staffId: slot.staffId, staffName: slot.staffName })}
                        className={`py-2.5 px-3 rounded-xl text-xs font-medium text-center transition-colors ${
                          selected
                            ? 'border-2 border-primary-500 bg-primary-500 text-white font-semibold'
                            : 'border border-border text-text-secondary hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700'
                        }`}
                      >
                        {formatSlotTime(slot.startsAt)}
                      </button>
                    );
                  })}
                </div>
              )}

              {booking.startsAt && (
                <p className="text-xs text-muted mt-4">
                  <span className="font-medium text-text-secondary">Selected:</span>{' '}
                  {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })} · {formatSlotTime(booking.startsAt)} · {booking.staffName}
                </p>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-border-strong text-text-primary font-medium text-sm rounded-pill hover:bg-surface-alt transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              type="button"
              disabled={!canContinue}
              onClick={onNext}
              className="flex-1 py-3 bg-primary-500 text-white font-semibold text-sm rounded-pill hover:bg-primary-600 active:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              Continue to Details
              <svg className="w-4 h-4 inline-block ml-1.5 -mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <aside aria-label="Booking summary" className="hidden lg:block">
          <BookingSummary booking={booking} onChangeService={onBack} />
        </aside>
      </div>

      {/* Mobile bottom bar */}
      {canContinue && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface border-t border-border shadow-lg lg:hidden z-40">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone }).format(new Date(booking.startsAt!))} · {formatSlotTime(booking.startsAt!)}
              </p>
              <p className="text-xs text-text-secondary">{booking.service?.name} · {booking.service ? formatCents(booking.service.priceCents, booking.service.currency) : ''}</p>
            </div>
            <button type="button" onClick={onNext} className="px-6 py-2.5 bg-primary-500 text-white font-semibold text-sm rounded-pill hover:bg-primary-600 transition-colors">
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── STEP 3: Contact Details ───────────────────────────────────────────
function Step3Details({
  booking,
  onUpdate,
  onNext,
  onBack,
}: {
  booking:  BookingState;
  onUpdate: (patch: Partial<BookingState>) => void;
  onNext:   () => void;
  onBack:   () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!booking.firstName.trim()) errs.firstName = 'First name is required';
    if (!booking.email.trim() || !/\S+@\S+\.\S+/.test(booking.email)) errs.email = 'Valid email is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validate()) onNext();
  };

  const inputClass = (field: string) =>
    `w-full px-4 py-2.5 bg-surface border rounded-xl text-sm text-text-primary placeholder-muted hover:border-border-strong focus:outline-none focus:ring-2 transition-all duration-200 ${
      errors[field]
        ? 'border-danger-600 bg-danger-50 focus:ring-danger/30'
        : 'border-border focus:border-primary-400 focus:ring-primary-100'
    }`;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary" style={{ letterSpacing: '-0.01em' }}>
          Your details
        </h1>
        <p className="text-text-secondary text-sm mt-2">We'll send your confirmation here.</p>
      </div>

      <div className="bg-surface rounded-card border border-border-subtle p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* First name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="firstName" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              First Name <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              placeholder="Sofia"
              value={booking.firstName}
              onChange={(e) => onUpdate({ firstName: e.target.value })}
              className={inputClass('firstName')}
              aria-required="true"
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? 'firstName-error' : undefined}
            />
            {errors.firstName && (
              <p id="firstName-error" role="alert" className="text-xs text-danger flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.firstName}
              </p>
            )}
          </div>

          {/* Last name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lastName" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              placeholder="Andersen"
              value={booking.lastName}
              onChange={(e) => onUpdate({ lastName: e.target.value })}
              className={inputClass('lastName')}
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="email" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Email Address <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </span>
              <input
                id="email"
                type="email"
                placeholder="sofia@example.com"
                value={booking.email}
                onChange={(e) => onUpdate({ email: e.target.value })}
                className={`${inputClass('email')} pl-10`}
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
            </div>
            {errors.email && (
              <p id="email-error" role="alert" className="text-xs text-danger flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.email}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="phone" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Phone Number <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="+1 (212) 555-0100"
              value={booking.phone}
              onChange={(e) => onUpdate({ phone: e.target.value })}
              className={inputClass('phone')}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="notes" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Special Requests <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              rows={3}
              placeholder="Any allergies, preferences, or notes for your stylist…"
              value={booking.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder-muted resize-none hover:border-border-strong focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all duration-200"
            />
          </div>

          {/* Marketing opt-in */}
          <div className="flex items-start gap-3 sm:col-span-2">
            <input
              id="marketingOptIn"
              type="checkbox"
              checked={booking.marketingOptIn}
              onChange={(e) => onUpdate({ marketingOptIn: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded border-border text-primary-500 focus:ring-primary-400"
            />
            <label htmlFor="marketingOptIn" className="text-xs text-text-secondary leading-relaxed">
              I'd like to receive occasional tips, offers, and updates from Belza Salon. You can unsubscribe at any time.
            </label>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border-subtle">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-border-strong text-text-primary font-medium text-sm rounded-pill hover:bg-surface-alt transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 py-3 bg-primary-500 text-white font-semibold text-sm rounded-pill hover:bg-primary-600 active:bg-primary-700 transition-colors shadow-sm"
          >
            Review Booking
            <svg className="w-4 h-4 inline-block ml-1.5 -mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── STEP 4: Confirm ───────────────────────────────────────────────────
function Step4Confirm({
  booking,
  onBack,
  onSuccess,
}: {
  booking:   BookingState;
  onBack:    () => void;
  onSuccess: (cancelToken: string, clientSecret?: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const timezone = 'America/New_York';

  const formatTime = (isoStr: string) =>
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }).format(new Date(isoStr));

  const formatDateLong = (isoStr: string) =>
    new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone }).format(new Date(isoStr));

  const handleConfirm = async () => {
    if (!booking.service || !booking.startsAt) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/bookings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId:      booking.service.id,
          staffId:        booking.staffId,
          startsAt:       booking.startsAt,
          firstName:      booking.firstName,
          lastName:       booking.lastName || undefined,
          email:          booking.email,
          phone:          booking.phone || undefined,
          notes:          booking.notes || undefined,
          marketingOptIn: booking.marketingOptIn,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError('This time slot was just taken. Please go back and choose another time.');
        return;
      }

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      onSuccess(data.cancelToken, data.clientSecret ?? undefined);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary" style={{ letterSpacing: '-0.01em' }}>
          Review &amp; confirm
        </h1>
        <p className="text-text-secondary text-sm mt-2">Everything look right? Confirm to lock in your appointment.</p>
      </div>

      <div className="bg-surface rounded-card border border-border-subtle p-6 space-y-5">
        {/* Service + time */}
        <div className="flex items-start gap-3 pb-5 border-b border-border-subtle">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-500 shrink-0" aria-hidden="true">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">{booking.service?.name}</p>
            {booking.service && (
              <p className="text-xs text-text-secondary mt-0.5">{formatDuration(booking.service.durationMinutes)}</p>
            )}
          </div>
          {booking.service && (
            <span className="text-lg font-semibold text-text-primary">
              {formatCents(booking.service.priceCents, booking.service.currency)}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          {booking.startsAt && (
            <>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Date</dt>
                <dd className="text-text-primary font-medium">{formatDateLong(booking.startsAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Time</dt>
                <dd className="text-text-primary font-medium">{formatTime(booking.startsAt)}</dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Stylist</dt>
            <dd className="text-text-primary font-medium">{booking.staffName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Client</dt>
            <dd className="text-text-primary font-medium">{booking.firstName} {booking.lastName}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Email</dt>
            <dd className="text-text-primary font-medium">{booking.email}</dd>
          </div>
          {booking.phone && (
            <div>
              <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Phone</dt>
              <dd className="text-text-primary font-medium">{booking.phone}</dd>
            </div>
          )}
          {booking.notes && (
            <div className="col-span-2">
              <dt className="text-xs text-muted uppercase tracking-wide font-semibold mb-0.5">Notes</dt>
              <dd className="text-text-primary">{booking.notes}</dd>
            </div>
          )}
        </dl>

        {/* Error */}
        {error && (
          <div className="p-4 bg-danger-50 border border-danger-100 rounded-xl">
            <p className="text-sm text-danger font-medium">{error}</p>
          </div>
        )}

        <p className="text-xs text-muted text-center">
          No payment required now. Free cancellation up to 24 hours before your appointment.
        </p>

        {/* Navigation */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-border-strong text-text-primary font-medium text-sm rounded-pill hover:bg-surface-alt transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            aria-busy={loading}
            className="flex-1 py-3 bg-primary-500 text-white font-semibold text-sm rounded-pill hover:bg-primary-600 active:bg-primary-700 transition-colors disabled:opacity-70 shadow-sm inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Booking…
              </>
            ) : (
              'Confirm Booking'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── STEP 5: Deposit Payment (only when PAYMENTS_ENABLED + clientSecret) ──
function Step5Deposit({
  booking,
  clientSecret,
  cancelToken,
}: {
  booking:       BookingState;
  clientSecret:  string;
  cancelToken:   string;
}) {
  // When PAYMENTS_ENABLED, we show a simple redirect to Stripe-hosted page
  // or embed Elements. For MVP simplicity, we show the key and direct the
  // user to complete payment. A full Stripe Elements integration requires
  // @stripe/react-stripe-js — add it when you have the publishable key set.
  useEffect(() => {
    // Auto-redirect to confirmation so the webhook can update status
    // In production: mount Stripe Elements here with the clientSecret
    const timer = setTimeout(() => {
      window.location.href = `/book/confirmation/${cancelToken}?pending=1`;
    }, 200);
    return () => clearTimeout(timer);
  }, [cancelToken]);

  return (
    <div className="animate-fade-in max-w-2xl mx-auto text-center py-16">
      <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6" aria-hidden="true">
        <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
      <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Redirecting to payment…</h1>
      <p className="text-text-secondary text-sm">Setting up your secure payment for the deposit.</p>
      <p className="text-xs text-muted mt-4">
        Booking is held for 15 minutes while you complete payment.
      </p>
    </div>
  );
}

// ── Main Stepper ──────────────────────────────────────────────────────
export function BookingStepper({ initialServiceId }: { initialServiceId?: string }) {
  const [step, setStep]             = useState<Step>(1);
  const [booking, setBooking]       = useState<BookingState>(INITIAL_STATE);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  const update = useCallback((patch: Partial<BookingState>) => {
    setBooking((prev) => ({ ...prev, ...patch }));
  }, []);

  if (step === 1) {
    return (
      <>
        <StepperNav current={1} />
        <Step1Service
          initialServiceId={initialServiceId}
          onSelect={(service) => {
            update({ service });
            setStep(2);
          }}
        />
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <StepperNav current={2} />
        <Step2DateTime
          booking={booking}
          onUpdate={update}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      </>
    );
  }

  if (step === 3) {
    return (
      <>
        <StepperNav current={3} />
        <Step3Details
          booking={booking}
          onUpdate={update}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      </>
    );
  }

  // Step 5: deposit payment (only reached when payments enabled + clientSecret)
  if (step === 5 && clientSecret && pendingToken) {
    return (
      <>
        <StepperNav current={5} />
        <Step5Deposit booking={booking} clientSecret={clientSecret} cancelToken={pendingToken} />
      </>
    );
  }

  // Step 4
  return (
    <>
      <StepperNav current={4} />
      <Step4Confirm
        booking={booking}
        onBack={() => setStep(3)}
        onSuccess={(cancelToken, secret) => {
          if (secret) {
            // Payments enabled: go to deposit step
            setClientSecret(secret);
            setPendingToken(cancelToken);
            setStep(5);
          } else {
            // No payment needed: redirect to confirmation
            window.location.href = `/book/confirmation/${cancelToken}`;
          }
        }}
      />
    </>
  );
}
