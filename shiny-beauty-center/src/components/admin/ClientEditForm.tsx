/**
 * ClientEditForm — client component for editing a client profile.
 * Gated on edit_client permission (prop-passed from server).
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { updateClientAction } from "@/app/[locale]/admin/clients/[id]/actions";

interface ClientFormData {
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  notes: string;
  is_active: boolean;
}

interface Labels {
  edit_title: string;
  save: string;
  saving: string;
  saved: string;
  cancel: string;
  col_name: string;
  col_phone: string;
  col_email: string;
  dob: string;
  notes_field: string;
  active: string;
  error: string;
}

interface Props {
  clientId: string;
  locale: string;
  initial: ClientFormData;
  labels: Labels;
}

export function ClientEditForm({ clientId, locale, initial, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClientFormData>(initial);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateClientAction(clientId, form, locale);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: labels.saved });
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => { setOpen((v) => !v); setMessage(null); }}
        className="btn-ghost text-sm"
      >
        {open ? "− Close" : labels.edit_title}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">{labels.col_name}</label>
            <input name="full_name" type="text" value={form.full_name} onChange={handleChange} required className="field-input" disabled={isPending} />
          </div>
          <div>
            <label className="field-label">{labels.col_phone}</label>
            <input name="phone" type="tel" value={form.phone} onChange={handleChange} className="field-input" disabled={isPending} />
          </div>
          <div>
            <label className="field-label">{labels.col_email}</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} className="field-input" disabled={isPending} />
          </div>
          <div>
            <label className="field-label">{labels.dob}</label>
            <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} className="field-input" disabled={isPending} />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">{labels.notes_field}</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className="field-input resize-none" disabled={isPending} />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <input id="is_active_client" name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} className="h-4 w-4 rounded border-nude-300 text-rose-500" disabled={isPending} />
            <label htmlFor="is_active_client" className="text-sm text-charcoal-700">{labels.active}</label>
          </div>
          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" disabled={isPending} className="btn-primary text-sm">
              {isPending ? labels.saving : labels.save}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-sm" disabled={isPending}>
              {labels.cancel}
            </button>
          </div>
          {message && (
            <p className={`sm:col-span-2 text-xs ${message.ok ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
