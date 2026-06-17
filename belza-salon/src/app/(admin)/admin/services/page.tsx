import { prisma } from '@/lib/db';
import { formatCents, formatDuration } from '@/lib/time';
import { ServicesManager } from './ServicesManager';

export default async function ServicesPage() {
  const [categories, allServices] = await Promise.all([
    prisma.serviceCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { services: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.service.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  return (
    <>
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 sm:px-6 shadow-[0_1px_0_0_rgba(44,34,32,0.08)] shrink-0 z-10">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Services</h1>
          <p className="text-xs text-muted hidden sm:block">{allServices.length} services across {categories.length} categories</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <ServicesManager categories={categories} />
      </main>
    </>
  );
}
