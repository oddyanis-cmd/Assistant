import { prisma } from '@/lib/db';
import { SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });

  const defaults = {
    salonName:       'Belza',
    timezone:        'America/New_York',
    slotIntervalMin: 15,
    leadTimeMinutes: 120,
    maxAdvanceDays:  60,
    depositPercent:  0,
    currency:        'usd',
    contactEmail:    '',
    contactPhone:    '',
    addressLine:     '',
  };

  const data = settings ? {
    salonName:       settings.salonName,
    timezone:        settings.timezone,
    slotIntervalMin: settings.slotIntervalMin,
    leadTimeMinutes: settings.leadTimeMinutes,
    maxAdvanceDays:  settings.maxAdvanceDays,
    depositPercent:  settings.depositPercent,
    currency:        settings.currency,
    contactEmail:    settings.contactEmail ?? '',
    contactPhone:    settings.contactPhone ?? '',
    addressLine:     settings.addressLine  ?? '',
  } : defaults;

  return (
    <>
      <header className="h-16 bg-surface border-b border-border flex items-center px-4 sm:px-6 shadow-[0_1px_0_0_rgba(44,34,32,0.08)] shrink-0 z-10">
        <h1 className="text-base font-semibold text-text-primary">Settings</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <SettingsForm data={data} />
        </div>
      </main>
    </>
  );
}
