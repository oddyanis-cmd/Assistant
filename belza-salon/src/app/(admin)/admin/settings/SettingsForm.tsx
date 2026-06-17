'use client';

import { useActionState } from 'react';
import { updateSettings } from '@/server/actions/settings';
import type { SettingsFormState } from '@/server/actions/settings';

const INITIAL: SettingsFormState = { success: true };

interface SettingsData {
  salonName: string;
  timezone: string;
  slotIntervalMin: number;
  leadTimeMinutes: number;
  maxAdvanceDays: number;
  depositPercent: number;
  currency: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
}

export function SettingsForm({ data }: { data: SettingsData }) {
  const [state, action] = useActionState(updateSettings, INITIAL);

  return (
    <form action={action} className="space-y-6">
      {!state.success && (
        <div className="p-4 bg-danger-50 border border-danger-100 rounded-xl">
          <p className="text-sm text-danger">{state.error}</p>
        </div>
      )}
      {state.success && (
        <div className="p-4 bg-success-50 border border-success-100 rounded-xl">
          <p className="text-sm text-success-700">Settings saved successfully.</p>
        </div>
      )}

      {/* Salon info */}
      <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Salon Information</h2>
        <div>
          <label htmlFor="salonName" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Salon Name</label>
          <input id="salonName" name="salonName" defaultValue={data.salonName} required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label htmlFor="contactEmail" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Contact Email</label>
          <input id="contactEmail" name="contactEmail" type="email" defaultValue={data.contactEmail} className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label htmlFor="contactPhone" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Contact Phone</label>
          <input id="contactPhone" name="contactPhone" defaultValue={data.contactPhone} className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label htmlFor="addressLine" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Address</label>
          <input id="addressLine" name="addressLine" defaultValue={data.addressLine} className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
      </div>

      {/* Booking config */}
      <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Booking Configuration</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="timezone" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Timezone (IANA)</label>
            <input id="timezone" name="timezone" defaultValue={data.timezone} required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" placeholder="America/New_York" />
          </div>
          <div>
            <label htmlFor="currency" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Currency (ISO)</label>
            <input id="currency" name="currency" defaultValue={data.currency} maxLength={3} required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" placeholder="usd" />
          </div>
          <div>
            <label htmlFor="slotIntervalMin" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Slot Interval (min)</label>
            <input id="slotIntervalMin" name="slotIntervalMin" type="number" min="5" max="60" defaultValue={data.slotIntervalMin} required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label htmlFor="leadTimeMinutes" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Lead Time (min)</label>
            <input id="leadTimeMinutes" name="leadTimeMinutes" type="number" min="0" defaultValue={data.leadTimeMinutes} required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label htmlFor="maxAdvanceDays" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Max Advance Days</label>
            <input id="maxAdvanceDays" name="maxAdvanceDays" type="number" min="1" max="365" defaultValue={data.maxAdvanceDays} required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
          </div>
        </div>
      </div>

      {/* Payments */}
      <div className="bg-surface rounded-card border border-border shadow-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Payments (Stripe)</h2>
        <p className="text-xs text-text-secondary">
          Enable payments by setting <code className="font-mono bg-surface-alt px-1 py-0.5 rounded">PAYMENTS_ENABLED=true</code> and your Stripe keys in environment variables.
        </p>
        <div>
          <label htmlFor="depositPercent" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Deposit Percent (0 = no deposit)</label>
          <input id="depositPercent" name="depositPercent" type="number" min="0" max="100" defaultValue={data.depositPercent} required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
      </div>

      <button
        type="submit"
        className="w-full py-3 bg-primary-500 text-white font-semibold text-sm rounded-xl hover:bg-primary-600 transition-colors shadow-sm"
      >
        Save Settings
      </button>
    </form>
  );
}
