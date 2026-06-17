import { prisma } from '@/lib/db';
import { TeamManager } from './TeamManager';

export default async function TeamPage() {
  const [staff, services] = await Promise.all([
    prisma.staff.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        services:     { include: { service: true } },
        workingHours: { orderBy: { dayOfWeek: 'asc' } },
        timeOff:      { orderBy: { startsAt: 'asc' } },
      },
    }),
    prisma.service.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  return (
    <>
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 sm:px-6 shadow-[0_1px_0_0_rgba(44,34,32,0.08)] shrink-0 z-10">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Team</h1>
          <p className="text-xs text-muted hidden sm:block">{staff.length} team members</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <TeamManager staff={staff as Parameters<typeof TeamManager>[0]['staff']} services={services} />
      </main>
    </>
  );
}
