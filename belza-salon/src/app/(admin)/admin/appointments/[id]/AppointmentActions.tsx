'use client';

import { useActionState } from 'react';
import { cancelAppointment, markCompleted, markNoShow } from '@/server/actions/appointments';
import type { ActionResult } from '@/server/actions/services';

const INITIAL: ActionResult = { success: true };

export function AppointmentActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  const [cancelState,   cancelAction]    = useActionState(cancelAppointment, INITIAL);
  const [completeState, completeAction]  = useActionState(markCompleted,     INITIAL);
  const [noShowState,   noShowAction]    = useActionState(markNoShow,        INITIAL);

  const isDone = ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(status);
  if (isDone) {
    return (
      <div className="bg-surface rounded-card border border-border shadow-card p-6 text-center text-sm text-muted">
        This appointment is {status.toLowerCase().replace('_', ' ')} — no further actions available.
      </div>
    );
  }

  const error = (!cancelState.success && cancelState.error) ||
                (!completeState.success && completeState.error) ||
                (!noShowState.success && noShowState.error);

  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">Actions</h2>
      {error && (
        <p className="text-sm text-danger bg-danger-50 border border-danger-100 rounded-xl px-4 py-3">{error}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <form action={completeAction}>
          <input type="hidden" name="id" value={appointmentId} />
          <button type="submit" className="px-4 py-2 bg-success-600 text-white text-sm font-semibold rounded-xl hover:bg-success-700 transition-colors">
            Mark Completed
          </button>
        </form>
        <form action={noShowAction}>
          <input type="hidden" name="id" value={appointmentId} />
          <button type="submit" className="px-4 py-2 bg-warning-600 text-white text-sm font-semibold rounded-xl hover:bg-warning-700 transition-colors">
            Mark No-Show
          </button>
        </form>
        <form action={cancelAction}>
          <input type="hidden" name="id" value={appointmentId} />
          <button type="submit" className="px-4 py-2 bg-danger-600 text-white text-sm font-semibold rounded-xl hover:bg-danger-700 transition-colors">
            Cancel Appointment
          </button>
        </form>
      </div>
    </div>
  );
}
