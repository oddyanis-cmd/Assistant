import { prisma } from '@/lib/db';
import Link from 'next/link';
import { format } from 'date-fns';

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { appointments: true } },
    },
  });

  return (
    <>
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 sm:px-6 shadow-[0_1px_0_0_rgba(44,34,32,0.08)] shrink-0 z-10">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Clients</h1>
          <p className="text-xs text-muted hidden sm:block">{clients.length} total</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
          {clients.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-semibold text-text-primary mb-1">No clients yet</p>
              <p className="text-xs text-text-secondary">Clients are created automatically when bookings are made.</p>
            </div>
          ) : (
            <table className="w-full text-sm" aria-label="Client list">
              <thead className="bg-surface-alt border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden lg:table-cell">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Bookings</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">Joined</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-surface-alt/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(client.firstName + (client.lastName ?? ''))}&backgroundColor=fbe9e4&textColor=c04535&radius=50`}
                          alt=""
                          width="32"
                          height="32"
                          className="w-8 h-8 rounded-full shrink-0"
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-text-primary">{client.firstName} {client.lastName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary hidden md:table-cell">{client.email}</td>
                    <td className="px-6 py-4 text-text-secondary hidden lg:table-cell">{client.phone ?? '—'}</td>
                    <td className="px-6 py-4 text-text-primary font-medium">{client._count.appointments}</td>
                    <td className="px-6 py-4 text-text-secondary hidden sm:table-cell">{format(client.createdAt, 'd MMM yyyy')}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-xs text-primary-600 hover:underline font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
