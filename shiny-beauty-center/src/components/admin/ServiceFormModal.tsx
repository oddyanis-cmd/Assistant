/**
 * ServiceFormModal — client component for create/edit a Service.
 * Renders as an inline expandable form section (no native dialog API needed).
 */
"use client";

import { useState, useTransition } from "react";
import type { Service, ServiceCategory } from "@/lib/supabase/types";
import {
  createServiceAction,
  updateServiceAction,
  deleteServiceAction,
  type ServiceFormData,
} from "@/app/[locale]/admin/services/actions";

interface Labels {
  add_service: string;
  edit_service: string;
  delete_service: string;
  delete_confirm: string;
  saving: string;
  save: string;
  cancel: string;
  name_en: string;
  name_ar: string;
  desc_en: string;
  desc_ar: string;
  price: string;
  duration: string;
  category: string;
  active: string;
  success_created: string;
  success_updated: string;
  success_deleted: string;
  error: string;
  no_supabase: string;
}

interface Props {
  locale: string;
  categories: ServiceCategory[];
  editService?: Service | null;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  supabaseReady: boolean;
  labels: Labels;
}

const EMPTY: ServiceFormData = {
  category_id: "",
  name_en: "",
  name_ar: "",
  description_en: "",
  description_ar: "",
  price: 0,
  duration_minutes: 60,
  is_active: true,
};

export function AddServiceButton({
  locale,
  categories,
  canCreate,
  supabaseReady,
  labels,
}: Pick<Props, "locale" | "categories" | "canCreate" | "supabaseReady" | "labels">) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ServiceFormData>({ ...EMPTY });
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!canCreate) return null;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : name === "price" || name === "duration_minutes"
          ? Number(value)
          : value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createServiceAction(form, locale);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: labels.success_created });
        setForm({ ...EMPTY });
        setOpen(false);
      }
    });
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-primary text-sm"
        disabled={!supabaseReady}
        title={!supabaseReady ? labels.no_supabase : undefined}
      >
        + {labels.add_service}
      </button>

      {!supabaseReady && (
        <p className="text-xs text-charcoal-400 mt-1">{labels.no_supabase}</p>
      )}

      {open && supabaseReady && (
        <div className="mt-4 card border-rose-200">
          <h3 className="text-sm font-semibold text-charcoal-700 mb-4">{labels.add_service}</h3>
          <ServiceFormFields
            form={form}
            categories={categories}
            labels={labels}
            isPending={isPending}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={() => { setOpen(false); setMessage(null); }}
          />
          {message && (
            <p className={`text-xs mt-2 ${message.ok ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function EditServiceRow({
  service,
  locale,
  categories,
  canEdit,
  canDelete,
  supabaseReady,
  labels,
}: {
  service: Service;
  locale: string;
  categories: ServiceCategory[];
  canEdit: boolean;
  canDelete: boolean;
  supabaseReady: boolean;
  labels: Labels;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ServiceFormData>({
    category_id: service.category_id,
    name_en: service.name_en,
    name_ar: service.name_ar,
    description_en: service.description_en ?? "",
    description_ar: service.description_ar ?? "",
    price: service.price,
    duration_minutes: service.duration_minutes,
    is_active: service.is_active,
  });
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : name === "price" || name === "duration_minutes"
          ? Number(value)
          : value,
    }));
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateServiceAction(service.id, form, locale);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: labels.success_updated });
        setEditOpen(false);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(labels.delete_confirm)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteServiceAction(service.id, locale);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      }
      // Row disappears on revalidation; no need to update local state
    });
  }

  return (
    <>
      <tr className="border-b border-nude-50 hover:bg-rose-50/20">
        <td className="py-3 px-4">
          <p className="font-medium text-charcoal-800">{service.name_en}</p>
          <p className="text-[11px] text-charcoal-400">{service.name_ar}</p>
        </td>
        <td className="py-3 px-4">
          <span className="px-2 py-0.5 rounded-full bg-nude-100 text-nude-700 text-xs">
            {categories.find((c) => c.id === service.category_id)?.name_en ?? "—"}
          </span>
        </td>
        <td className="py-3 px-4 font-medium text-charcoal-700">
          {Number(service.price).toLocaleString("en-SA")}
        </td>
        <td className="py-3 px-4 text-charcoal-600">{service.duration_minutes}</td>
        <td className="py-3 px-4">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              service.is_active
                ? "bg-green-100 text-green-700"
                : "bg-charcoal-100 text-charcoal-500"
            }`}
          >
            {service.is_active ? "Active" : "Hidden"}
          </span>
        </td>
        <td className="py-3 px-4">
          <div className="flex gap-2 items-center">
            {canEdit && supabaseReady && (
              <button
                className="text-xs text-rose-600 hover:underline"
                onClick={() => setEditOpen((v) => !v)}
                disabled={isPending}
              >
                {labels.edit_service}
              </button>
            )}
            {canDelete && supabaseReady && (
              <button
                className="text-xs text-charcoal-400 hover:text-red-600"
                onClick={handleDelete}
                disabled={isPending}
              >
                {labels.delete_service}
              </button>
            )}
            {!supabaseReady && (
              <span className="text-xs text-charcoal-300 italic">No DB</span>
            )}
          </div>
          {message && (
            <p className={`text-[10px] mt-1 ${message.ok ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
        </td>
      </tr>
      {editOpen && (
        <tr>
          <td colSpan={6} className="px-4 pb-4 pt-2 bg-rose-50/30">
            <div className="rounded-xl border border-rose-100 bg-white p-4">
              <h3 className="text-sm font-semibold text-charcoal-700 mb-4">{labels.edit_service}: {service.name_en}</h3>
              <ServiceFormFields
                form={form}
                categories={categories}
                labels={labels}
                isPending={isPending}
                onChange={handleChange}
                onSubmit={handleEdit}
                onCancel={() => { setEditOpen(false); setMessage(null); }}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared field set
// ---------------------------------------------------------------------------

function ServiceFormFields({
  form,
  categories,
  labels,
  isPending,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: ServiceFormData;
  categories: ServiceCategory[];
  labels: Labels;
  isPending: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Category */}
      <div className="sm:col-span-2">
        <label className="field-label">{labels.category}</label>
        <select
          name="category_id"
          value={form.category_id}
          onChange={onChange}
          required
          className="field-input"
          disabled={isPending}
        >
          <option value="">— select —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_en} / {c.name_ar}
            </option>
          ))}
        </select>
      </div>

      {/* Names */}
      <div>
        <label className="field-label">{labels.name_en}</label>
        <input
          name="name_en"
          type="text"
          value={form.name_en}
          onChange={onChange}
          required
          className="field-input"
          disabled={isPending}
        />
      </div>
      <div>
        <label className="field-label">{labels.name_ar}</label>
        <input
          name="name_ar"
          type="text"
          value={form.name_ar}
          onChange={onChange}
          required
          dir="rtl"
          className="field-input"
          disabled={isPending}
        />
      </div>

      {/* Descriptions */}
      <div>
        <label className="field-label">{labels.desc_en}</label>
        <textarea
          name="description_en"
          value={form.description_en ?? ""}
          onChange={onChange}
          rows={2}
          className="field-input resize-none"
          disabled={isPending}
        />
      </div>
      <div>
        <label className="field-label">{labels.desc_ar}</label>
        <textarea
          name="description_ar"
          value={form.description_ar ?? ""}
          onChange={onChange}
          rows={2}
          dir="rtl"
          className="field-input resize-none"
          disabled={isPending}
        />
      </div>

      {/* Price + Duration */}
      <div>
        <label className="field-label">{labels.price}</label>
        <input
          name="price"
          type="number"
          min={0}
          step={0.01}
          value={form.price}
          onChange={onChange}
          required
          className="field-input"
          disabled={isPending}
        />
      </div>
      <div>
        <label className="field-label">{labels.duration}</label>
        <input
          name="duration_minutes"
          type="number"
          min={1}
          value={form.duration_minutes}
          onChange={onChange}
          required
          className="field-input"
          disabled={isPending}
        />
      </div>

      {/* Active */}
      <div className="sm:col-span-2 flex items-center gap-3">
        <input
          id="is_active"
          name="is_active"
          type="checkbox"
          checked={form.is_active}
          onChange={onChange}
          className="h-4 w-4 rounded border-nude-300 text-rose-500"
          disabled={isPending}
        />
        <label htmlFor="is_active" className="text-sm text-charcoal-700">
          {labels.active}
        </label>
      </div>

      {/* Buttons */}
      <div className="sm:col-span-2 flex gap-3">
        <button type="submit" disabled={isPending} className="btn-primary text-sm">
          {isPending ? labels.saving : labels.save}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost text-sm" disabled={isPending}>
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
