/**
 * CategoryFormPanel — client component for create/update service categories.
 */
"use client";

import { useState, useTransition } from "react";
import type { ServiceCategory } from "@/lib/supabase/types";
import {
  createCategoryAction,
  updateCategoryAction,
  type CategoryFormData,
} from "@/app/[locale]/admin/services/actions";

interface Labels {
  add_category: string;
  cat_name_en: string;
  cat_name_ar: string;
  cat_sort: string;
  active: string;
  save: string;
  saving: string;
  cancel: string;
  success_cat_created: string;
  success_cat_updated: string;
  error: string;
  no_supabase: string;
}

interface Props {
  locale: string;
  categories: ServiceCategory[];
  canManage: boolean;
  supabaseReady: boolean;
  labels: Labels;
}

export function CategoryFormPanel({ locale, categories, canManage, supabaseReady, labels }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [addForm, setAddForm] = useState<CategoryFormData>({
    name_en: "",
    name_ar: "",
    sort_order: 0,
    is_active: true,
  });

  function handleAddChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setAddForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name === "sort_order" ? Number(value) : value,
    }));
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createCategoryAction(addForm, locale);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: labels.success_cat_created });
        setAddForm({ name_en: "", name_ar: "", sort_order: 0, is_active: true });
        setShowAdd(false);
      }
    });
  }

  if (!canManage) return null;

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-charcoal-700">
          Categories ({categories.length})
        </h2>
        {supabaseReady && (
          <button
            onClick={() => { setShowAdd((v) => !v); setMessage(null); }}
            className="btn-ghost text-xs"
          >
            {showAdd ? "−" : "+"} {labels.add_category}
          </button>
        )}
      </div>

      {!supabaseReady && (
        <p className="text-xs text-charcoal-400 mb-3">{labels.no_supabase}</p>
      )}

      {/* Existing categories */}
      <div className="flex flex-wrap gap-2 mb-3">
        {categories.map((cat) => (
          <CategoryChip
            key={cat.id}
            cat={cat}
            locale={locale}
            supabaseReady={supabaseReady}
            editId={editId}
            setEditId={setEditId}
            isPending={isPending}
            startTransition={startTransition}
            setMessage={setMessage}
            labels={labels}
          />
        ))}
        {categories.length === 0 && (
          <span className="text-xs text-charcoal-400 italic">No categories. Run migrations.</span>
        )}
      </div>

      {/* Add form */}
      {showAdd && supabaseReady && (
        <form onSubmit={handleAddSubmit} className="border-t border-nude-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">{labels.cat_name_en}</label>
            <input name="name_en" type="text" value={addForm.name_en} onChange={handleAddChange} required className="field-input" disabled={isPending} />
          </div>
          <div>
            <label className="field-label">{labels.cat_name_ar}</label>
            <input name="name_ar" type="text" value={addForm.name_ar} onChange={handleAddChange} required dir="rtl" className="field-input" disabled={isPending} />
          </div>
          <div>
            <label className="field-label">{labels.cat_sort}</label>
            <input name="sort_order" type="number" value={addForm.sort_order ?? 0} onChange={handleAddChange} className="field-input" disabled={isPending} />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-charcoal-700 cursor-pointer">
              <input name="is_active" type="checkbox" checked={addForm.is_active ?? true} onChange={handleAddChange} className="h-4 w-4 rounded border-nude-300 text-rose-500" disabled={isPending} />
              {labels.active}
            </label>
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={isPending} className="btn-primary text-sm">
              {isPending ? labels.saving : labels.save}
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setMessage(null); }} className="btn-ghost text-sm" disabled={isPending}>
              {labels.cancel}
            </button>
          </div>
        </form>
      )}

      {message && (
        <p className={`text-xs mt-2 ${message.ok ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}

// Individual chip that can be expanded to edit
function CategoryChip({
  cat,
  locale,
  supabaseReady,
  editId,
  setEditId,
  isPending,
  startTransition,
  setMessage,
  labels,
}: {
  cat: ServiceCategory;
  locale: string;
  supabaseReady: boolean;
  editId: string | null;
  setEditId: (id: string | null) => void;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  setMessage: (m: { ok: boolean; text: string } | null) => void;
  labels: Labels;
}) {
  const isEditing = editId === cat.id;
  const [editForm, setEditForm] = useState<CategoryFormData>({
    name_en: cat.name_en,
    name_ar: cat.name_ar,
    sort_order: cat.sort_order,
    is_active: cat.is_active,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name === "sort_order" ? Number(value) : value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateCategoryAction(cat.id, editForm, locale);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: labels.success_cat_updated });
        setEditId(null);
      }
    });
  }

  if (isEditing) {
    return (
      <div className="w-full border border-rose-200 rounded-xl p-3 bg-rose-50/30">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">{labels.cat_name_en}</label>
            <input name="name_en" type="text" value={editForm.name_en} onChange={handleChange} required className="field-input" disabled={isPending} />
          </div>
          <div>
            <label className="field-label">{labels.cat_name_ar}</label>
            <input name="name_ar" type="text" value={editForm.name_ar} onChange={handleChange} required dir="rtl" className="field-input" disabled={isPending} />
          </div>
          <div>
            <label className="field-label">{labels.cat_sort}</label>
            <input name="sort_order" type="number" value={editForm.sort_order ?? 0} onChange={handleChange} className="field-input" disabled={isPending} />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-charcoal-700 cursor-pointer">
              <input name="is_active" type="checkbox" checked={editForm.is_active ?? true} onChange={handleChange} className="h-4 w-4 rounded border-nude-300 text-rose-500" disabled={isPending} />
              {labels.active}
            </label>
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={isPending} className="btn-primary text-xs">
              {isPending ? labels.saving : labels.save}
            </button>
            <button type="button" onClick={() => setEditId(null)} className="btn-ghost text-xs" disabled={isPending}>
              {labels.cancel}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => supabaseReady ? setEditId(cat.id) : undefined}
      disabled={!supabaseReady || isPending}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
        supabaseReady
          ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 cursor-pointer"
          : "bg-rose-50 border-rose-200 text-rose-700 cursor-default"
      }`}
      title={supabaseReady ? "Click to edit" : labels.no_supabase}
    >
      {cat.name_en} / {cat.name_ar}
    </button>
  );
}
