'use client';

import { useState, useActionState } from 'react';
import {
  createStaff,
  updateStaff,
  deleteStaff,
  setWorkingHours,
  addTimeOff,
  deleteTimeOff,
} from '@/server/actions/staff';
import type { ActionResult } from '@/server/actions/services';
import { format } from 'date-fns';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const INITIAL: ActionResult = { success: true };

interface StaffMember {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  email: string | null;
  isActive: boolean;
  sortOrder: number;
  services: { serviceId: string; service: { id: string; name: string } }[];
  workingHours: { dayOfWeek: number; startMinutes: number; endMinutes: number }[];
  timeOff: { id: string; startsAt: Date; endsAt: Date; reason: string | null }[];
}

interface Service {
  id: string;
  name: string;
}

function minutesToTime(m: number) {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const min = (m % 60).toString().padStart(2, '0');
  return `${h}:${min}`;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function WorkingHoursEditor({ staff }: { staff: StaffMember }) {
  const existing = Object.fromEntries(staff.workingHours.map((h) => [h.dayOfWeek, h]));

  // State: array of {dayOfWeek, startMinutes, endMinutes} only for enabled days
  const [schedule, setSchedule] = useState<{ dayOfWeek: number; start: string; end: string; enabled: boolean }[]>(
    Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      enabled: !!existing[i],
      start: existing[i] ? minutesToTime(existing[i].startMinutes) : '09:00',
      end:   existing[i] ? minutesToTime(existing[i].endMinutes)   : '18:00',
    })),
  );

  const [state, action] = useActionState(setWorkingHours, INITIAL);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);
    const enabled = schedule.filter((s) => s.enabled).map((s) => ({
      dayOfWeek:    s.dayOfWeek,
      startMinutes: timeToMinutes(s.start),
      endMinutes:   timeToMinutes(s.end),
    }));
    const fd = new FormData(e.currentTarget);
    fd.set('hours', JSON.stringify(enabled));
    action(fd);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="staffId" value={staff.id} />
      {(!state.success && state.error) && <p className="text-sm text-danger">{state.error}</p>}
      {localError && <p className="text-sm text-danger">{localError}</p>}
      {state.success && <p className="text-xs text-success-600">Hours saved.</p>}
      {schedule.map((day) => (
        <div key={day.dayOfWeek} className="flex items-center gap-3">
          <input
            type="checkbox"
            id={`day-${staff.id}-${day.dayOfWeek}`}
            checked={day.enabled}
            onChange={(e) => {
              const next = [...schedule];
              next[day.dayOfWeek] = { ...next[day.dayOfWeek], enabled: e.target.checked };
              setSchedule(next);
            }}
            className="w-4 h-4 rounded border-border text-primary-500"
          />
          <label htmlFor={`day-${staff.id}-${day.dayOfWeek}`} className="w-8 text-xs font-semibold text-text-secondary">
            {DAY_NAMES[day.dayOfWeek]}
          </label>
          {day.enabled && (
            <>
              <input
                type="time"
                value={day.start}
                onChange={(e) => {
                  const next = [...schedule];
                  next[day.dayOfWeek] = { ...next[day.dayOfWeek], start: e.target.value };
                  setSchedule(next);
                }}
                className="px-2 py-1 border border-border rounded-lg text-sm focus:outline-none focus:border-primary-400"
              />
              <span className="text-xs text-muted">to</span>
              <input
                type="time"
                value={day.end}
                onChange={(e) => {
                  const next = [...schedule];
                  next[day.dayOfWeek] = { ...next[day.dayOfWeek], end: e.target.value };
                  setSchedule(next);
                }}
                className="px-2 py-1 border border-border rounded-lg text-sm focus:outline-none focus:border-primary-400"
              />
            </>
          )}
        </div>
      ))}
      <button type="submit" className="px-4 py-2 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors">
        Save Hours
      </button>
    </form>
  );
}

function DeleteTimeOffButton({ id }: { id: string }) {
  const [, action] = useActionState(deleteTimeOff, INITIAL);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-danger hover:underline">Remove</button>
    </form>
  );
}

function TimeOffForm({ staffId }: { staffId: string }) {
  const [state, action] = useActionState(addTimeOff, INITIAL);
  return (
    <form action={action} className="flex flex-wrap gap-3 items-end">
      <input type="hidden" name="staffId" value={staffId} />
      {!state.success && <p className="w-full text-xs text-danger">{state.error}</p>}
      <div>
        <label className="block text-xs text-muted mb-1">From</label>
        <input type="datetime-local" name="startsAt" required className="px-2 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:border-primary-400" />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">To</label>
        <input type="datetime-local" name="endsAt" required className="px-2 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:border-primary-400" />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Reason</label>
        <input type="text" name="reason" placeholder="Holiday, sick leave..." className="px-2 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:border-primary-400" />
      </div>
      <button type="submit" className="px-3 py-1.5 bg-primary-500 text-white text-xs font-semibold rounded-lg hover:bg-primary-600 transition-colors">
        Add
      </button>
    </form>
  );
}

export function TeamManager({ staff, services }: { staff: StaffMember[]; services: Service[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [createState, createAction] = useActionState(createStaff, INITIAL);
  const [showNew, setShowNew]       = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowNew((s) => !s)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-pill hover:bg-primary-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New Staff Member
        </button>
      </div>

      {showNew && (
        <div className="bg-surface rounded-card border border-primary-200 shadow-card p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">New Staff Member</h3>
          {!createState.success && <p className="text-sm text-danger mb-3">{createState.error}</p>}
          <form action={createAction} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Name</label>
              <input name="name" required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Title</label>
              <input name="title" className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Email</label>
              <input name="email" type="email" className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Bio</label>
              <textarea name="bio" rows={2} className="w-full px-4 py-2.5 border border-border rounded-xl text-sm resize-none focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" className="px-4 py-2 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors">Create</button>
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 border border-border text-text-secondary text-sm font-medium rounded-xl hover:bg-surface-alt transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {staff.map((s) => (
        <div key={s.id} className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
          {/* Staff header */}
          <button
            type="button"
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-surface-alt/50 transition-colors text-left"
            onClick={() => setExpanded((e) => e === s.id ? null : s.id)}
            aria-expanded={expanded === s.id}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(s.name)}&backgroundColor=d4614f&textColor=fff&radius=50`}
              alt=""
              width="40"
              height="40"
              className="w-10 h-10 rounded-full shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">{s.name}</p>
              <p className="text-xs text-text-secondary">{s.title ?? 'Stylist'}</p>
            </div>
            <span className={`px-2 py-0.5 rounded-pill text-xs font-semibold ${s.isActive ? 'bg-success-100 text-success-700' : 'bg-surface-alt text-muted'}`}>
              {s.isActive ? 'Active' : 'Inactive'}
            </span>
            <svg className={`w-4 h-4 text-muted transition-transform ${expanded === s.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded === s.id && (
            <div className="border-t border-border px-6 py-5 space-y-6">

              {/* Services */}
              <div>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Services Offered</h3>
                <div className="flex flex-wrap gap-2">
                  {services.map((svc) => {
                    const linked = s.services.some((ss) => ss.serviceId === svc.id);
                    return (
                      <span
                        key={svc.id}
                        className={`px-3 py-1 rounded-pill text-xs font-medium ${linked ? 'bg-primary-100 text-primary-700' : 'bg-surface-alt text-muted'}`}
                      >
                        {svc.name}
                      </span>
                    );
                  })}
                </div>
                <p className="text-xs text-muted mt-2">Use the service form to link/unlink. (Bulk editor coming soon.)</p>
              </div>

              {/* Working hours */}
              <div>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Working Hours</h3>
                <WorkingHoursEditor staff={s} />
              </div>

              {/* Time off */}
              <div>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Time Off</h3>
                {s.timeOff.length > 0 && (
                  <ul className="space-y-1.5 mb-3" role="list">
                    {s.timeOff.map((to) => (
                      <li key={to.id} className="flex items-center gap-3 text-xs text-text-secondary">
                        <span>{format(to.startsAt, 'd MMM yyyy HH:mm')} – {format(to.endsAt, 'd MMM yyyy HH:mm')}</span>
                        {to.reason && <span className="text-muted">({to.reason})</span>}
                        <DeleteTimeOffButton id={to.id} />
                      </li>
                    ))}
                  </ul>
                )}
                <TimeOffForm staffId={s.id} />
              </div>

            </div>
          )}
        </div>
      ))}
    </div>
  );
}
