'use client';

import { useActionState, useState } from 'react';
import { updateClient } from '@/server/actions/clients';
import type { ActionResult } from '@/server/actions/services';

const INITIAL: ActionResult = { success: true };

export function ClientNotesForm({ clientId, initialNotes }: { clientId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [state, action]   = useActionState(updateClient, INITIAL);

  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-6">
      <h2 className="text-sm font-semibold text-text-primary mb-3">Admin Notes</h2>
      {!state.success && (
        <p className="text-sm text-danger mb-3">{state.error}</p>
      )}
      {state.success && initialNotes !== notes && (
        <p className="text-xs text-success-600 mb-3">Notes saved.</p>
      )}
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={clientId} />
        {/* Required fields to satisfy schema */}
        <input type="hidden" name="firstName" value="placeholder" />
        <input type="hidden" name="marketingOptIn" value="false" />
        <textarea
          name="notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes about this client (not visible to them)..."
          className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-muted resize-none focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors"
        >
          Save Notes
        </button>
      </form>
    </div>
  );
}
