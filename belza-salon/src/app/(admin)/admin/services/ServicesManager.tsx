'use client';

import { useState, useActionState } from 'react';
import { createService, updateService, deleteService } from '@/server/actions/services';
import { formatCents, formatDuration } from '@/lib/time';
import type { ActionResult } from '@/server/actions/services';

interface Category {
  id: string;
  name: string;
  services: Service[];
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  bufferAfterMin: number;
  isActive: boolean;
  sortOrder: number;
  categoryId: string;
}

const INITIAL: ActionResult = { success: true };

function ServiceForm({
  categories,
  service,
  onDone,
}: {
  categories: Category[];
  service?: Service;
  onDone: () => void;
}) {
  const action = service ? updateService : createService;
  const [state, formAction] = useActionState(action, INITIAL);

  if (state.success && 'id' in state) {
    // freshly created — parent can close
  }

  return (
    <form action={formAction} className="space-y-4">
      {service && <input type="hidden" name="id" value={service.id} />}

      {!state.success && (
        <p className="text-sm text-danger bg-danger-50 border border-danger-100 rounded-xl px-4 py-3">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Name</label>
          <input name="name" defaultValue={service?.name} required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Description</label>
          <textarea name="description" defaultValue={service?.description ?? ''} rows={2} className="w-full px-4 py-2.5 border border-border rounded-xl text-sm resize-none focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Duration (min)</label>
          <input name="durationMinutes" type="number" min="5" defaultValue={service?.durationMinutes ?? 60} required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Price (cents)</label>
          <input name="priceCents" type="number" min="0" defaultValue={service?.priceCents ?? 0} required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Buffer (min)</label>
          <input name="bufferAfterMin" type="number" min="0" defaultValue={service?.bufferAfterMin ?? 0} className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Sort Order</label>
          <input name="sortOrder" type="number" min="0" defaultValue={service?.sortOrder ?? 0} className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Category</label>
          <select name="categoryId" defaultValue={service?.categoryId ?? categories[0]?.id} required className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input name="isActive" type="checkbox" id="isActive" defaultChecked={service?.isActive ?? true} value="true" className="w-4 h-4 rounded border-border text-primary-500" />
          <label htmlFor="isActive" className="text-sm text-text-secondary">Active (visible to customers)</label>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" className="px-4 py-2 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors">
          {service ? 'Save Changes' : 'Create Service'}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2 border border-border text-text-secondary text-sm font-medium rounded-xl hover:bg-surface-alt transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteServiceButton({ serviceId }: { serviceId: string }) {
  const [state, action] = useActionState(deleteService, INITIAL);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={serviceId} />
      {!state.success && <p className="text-xs text-danger mt-1">{state.error}</p>}
      <button type="submit" className="text-xs text-danger hover:underline">Delete</button>
    </form>
  );
}

export function ServicesManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<string | null>(null); // serviceId or "new"

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-pill hover:bg-primary-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New Service
        </button>
      </div>

      {editing === 'new' && (
        <div className="bg-surface rounded-card border border-primary-200 shadow-card p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">New Service</h3>
          <ServiceForm categories={categories} onDone={() => setEditing(null)} />
        </div>
      )}

      {categories.map((cat) => (
        <section key={cat.id} aria-labelledby={`cat-${cat.id}`} className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-alt">
            <h2 id={`cat-${cat.id}`} className="text-sm font-semibold text-text-primary">{cat.name}</h2>
            <span className="text-xs text-muted">{cat.services.length} services</span>
          </div>

          {cat.services.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted">No services yet.</p>
          ) : (
            <ul className="divide-y divide-border" role="list">
              {cat.services.map((svc) => (
                <li key={svc.id} className="px-6 py-4">
                  {editing === svc.id ? (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-text-primary">Edit Service</h3>
                      <ServiceForm categories={categories} service={svc} onDone={() => setEditing(null)} />
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-text-primary">{svc.name}</p>
                          {!svc.isActive && (
                            <span className="px-1.5 py-0.5 text-xs bg-surface-alt text-muted rounded-pill">Inactive</span>
                          )}
                        </div>
                        {svc.description && (
                          <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{svc.description}</p>
                        )}
                        <p className="text-xs text-muted mt-1">
                          {formatDuration(svc.durationMinutes)}
                          {svc.bufferAfterMin > 0 ? ` + ${svc.bufferAfterMin}min buffer` : ''} · {formatCents(svc.priceCents, svc.currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditing(svc.id)}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          Edit
                        </button>
                        <DeleteServiceButton serviceId={svc.id} />
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
