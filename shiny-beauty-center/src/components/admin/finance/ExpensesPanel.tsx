/**
 * ExpensesPanel — the expenses ledger: list + add + inline edit + delete.
 * Read-only (list + total) for users who only hold view_financial_reports;
 * the add/edit/delete controls only render when canManage (manage_expenses).
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import type { Expense } from "@/lib/supabase/types";
import {
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
  type ExpenseFormData,
} from "@/app/[locale]/admin/finance/actions";

interface Props {
  locale: string;
  expenses: Expense[];
  canManage: boolean;
  currency: string;
}

type FieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): ExpenseFormData {
  return { category: "", description: "", amount: 0, incurred_on: today(), vendor: "" };
}

function applyChange(prev: ExpenseFormData, e: FieldChangeEvent): ExpenseFormData {
  const { name, value } = e.target;
  return { ...prev, [name]: name === "amount" ? Number(value) : value };
}

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", {
    timeZone: "UTC",
  });
}

export function ExpensesPanel({ locale, expenses, canManage, currency }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<ExpenseFormData>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ExpenseFormData>(emptyForm());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  function fmt(n: number): string {
    return `${n.toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createExpenseAction(addForm, locale);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: "Expense added." });
        setAddForm(emptyForm());
        setAddOpen(false);
        router.refresh();
      }
    });
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setEditForm({
      category: expense.category,
      description: expense.description ?? "",
      amount: Number(expense.amount),
      incurred_on: expense.incurred_on,
      vendor: expense.vendor ?? "",
    });
    setMessage(null);
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await updateExpenseAction(editingId, editForm, locale);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: "Expense updated." });
        setEditingId(null);
        router.refresh();
      }
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this expense? This cannot be undone.")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteExpenseAction(id, locale);
      if (result.error) setMessage({ ok: false, text: result.error });
      else router.refresh();
    });
  }

  return (
    <section className="card overflow-x-auto p-0">
      <div className="px-6 py-4 border-b border-nude-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-charcoal-700">Expenses</h2>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Total: {fmt(total)} · {expenses.length} {expenses.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => {
              setAddOpen((v) => !v);
              setMessage(null);
            }}
          >
            + Add expense
          </button>
        )}
      </div>

      {addOpen && canManage && (
        <div className="px-6 py-5 border-b border-nude-100 bg-rose-50/20">
          <h3 className="text-sm font-semibold text-charcoal-700 mb-4">Add expense</h3>
          <ExpenseFormFields
            form={addForm}
            isPending={isPending}
            onChange={(e) => setAddForm((prev) => applyChange(prev, e))}
            onSubmit={submitAdd}
            onCancel={() => {
              setAddOpen(false);
              setMessage(null);
            }}
            submitLabel="Add expense"
          />
        </div>
      )}

      {message && (
        <p className={`text-xs px-6 pt-3 ${message.ok ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      {expenses.length === 0 ? (
        <p className="text-sm text-charcoal-400 italic py-8 text-center">No expenses logged yet.</p>
      ) : (
        <table className="w-full text-sm text-left rtl:text-right">
          <thead className="border-b border-nude-100">
            <tr>
              {["Date", "Category", "Vendor", "Description", "Amount", ""].map((col) => (
                <th
                  key={col}
                  className="py-3 px-4 text-xs font-semibold text-charcoal-500 uppercase tracking-wide"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <ExpenseTableRow
                key={expense.id}
                expense={expense}
                locale={locale}
                editing={editingId === expense.id}
                editForm={editForm}
                canManage={canManage}
                isPending={isPending}
                fmt={fmt}
                onEditChange={(e) => setEditForm((prev) => applyChange(prev, e))}
                onStartEdit={() => startEdit(expense)}
                onCancelEdit={() => {
                  setEditingId(null);
                  setMessage(null);
                }}
                onSubmitEdit={submitEdit}
                onDelete={() => handleDelete(expense.id)}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Row (+ inline edit form)
// ---------------------------------------------------------------------------

function ExpenseTableRow({
  expense,
  locale,
  editing,
  editForm,
  canManage,
  isPending,
  fmt,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onDelete,
}: {
  expense: Expense;
  locale: string;
  editing: boolean;
  editForm: ExpenseFormData;
  canManage: boolean;
  isPending: boolean;
  fmt: (n: number) => string;
  onEditChange: (e: FieldChangeEvent) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (e: React.FormEvent) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr className="border-b border-nude-50 hover:bg-rose-50/20">
        <td className="py-3 px-4 text-charcoal-600 whitespace-nowrap">
          {formatDate(expense.incurred_on, locale)}
        </td>
        <td className="py-3 px-4 font-medium text-charcoal-800">{expense.category}</td>
        <td className="py-3 px-4 text-charcoal-500">{expense.vendor ?? "—"}</td>
        <td className="py-3 px-4 text-charcoal-500 max-w-xs truncate">
          {expense.description ?? "—"}
        </td>
        <td className="py-3 px-4 font-medium text-charcoal-800 whitespace-nowrap">
          {fmt(Number(expense.amount))}
        </td>
        <td className="py-3 px-4">
          {canManage && (
            <div className="flex gap-2 items-center">
              <button
                type="button"
                className="text-xs text-rose-600 hover:underline"
                onClick={onStartEdit}
                disabled={isPending}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-xs text-charcoal-400 hover:text-red-600"
                onClick={onDelete}
                disabled={isPending}
              >
                Delete
              </button>
            </div>
          )}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} className="px-4 pb-4 pt-2 bg-rose-50/30">
            <div className="rounded-xl border border-rose-100 bg-white p-4">
              <h3 className="text-sm font-semibold text-charcoal-700 mb-4">Edit expense</h3>
              <ExpenseFormFields
                form={editForm}
                isPending={isPending}
                onChange={onEditChange}
                onSubmit={onSubmitEdit}
                onCancel={onCancelEdit}
                submitLabel="Save changes"
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared field set (add + edit)
// ---------------------------------------------------------------------------

function ExpenseFormFields({
  form,
  isPending,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  form: ExpenseFormData;
  isPending: boolean;
  onChange: (e: FieldChangeEvent) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="field-label">Category</label>
        <input
          name="category"
          type="text"
          value={form.category}
          onChange={onChange}
          required
          placeholder="Rent, Supplies, Utilities…"
          className="field-input"
          disabled={isPending}
        />
      </div>
      <div>
        <label className="field-label">Vendor (optional)</label>
        <input
          name="vendor"
          type="text"
          value={form.vendor ?? ""}
          onChange={onChange}
          className="field-input"
          disabled={isPending}
        />
      </div>
      <div>
        <label className="field-label">Amount</label>
        <input
          name="amount"
          type="number"
          min={0}
          step={0.01}
          value={form.amount}
          onChange={onChange}
          required
          className="field-input"
          disabled={isPending}
        />
      </div>
      <div>
        <label className="field-label">Date incurred</label>
        <input
          name="incurred_on"
          type="date"
          value={form.incurred_on}
          onChange={onChange}
          required
          className="field-input"
          disabled={isPending}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label">Description (optional)</label>
        <textarea
          name="description"
          value={form.description ?? ""}
          onChange={onChange}
          rows={2}
          className="field-input resize-none"
          disabled={isPending}
        />
      </div>
      <div className="sm:col-span-2 flex gap-3">
        <button type="submit" disabled={isPending} className="btn-primary text-sm">
          {isPending ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost text-sm" disabled={isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
