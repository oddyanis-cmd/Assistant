/**
 * Finance data-fetchers — server-only.
 * Powers /admin/finance: recent payments, recent invoices, and the expenses
 * ledger. All functions guard against a null Supabase client (unconfigured
 * env) and return safe empty defaults — RLS further scopes what each caller
 * can actually see (see migrations 002_rls_and_has_permission.sql and
 * 008_phase7.sql).
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Expense, PaymentStatus } from "@/lib/supabase/types";

// ---- Types ------------------------------------------------------------

export interface PaymentRow {
  id: string;
  appointmentId: string | null;
  invoiceId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string | null;
  providerRef: string | null;
  createdAt: string;
  /** Resolved via the linked invoice's client_id (payments have no direct FK to clients). */
  clientName: string | null;
}

export interface InvoiceRow {
  id: string;
  clientId: string;
  clientName: string | null;
  appointmentId: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: PaymentStatus;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
}

// ---- Data fetchers ------------------------------------------------------

/**
 * Most recent payments, newest first, with the paying client's name resolved
 * through the linked invoice (when one exists).
 */
export async function getRecentPayments(limit = 25): Promise<PaymentRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("payments")
    .select("id, appointment_id, invoice_id, amount, currency, status, provider, provider_ref, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[finance] getRecentPayments:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];

  const invoiceIds = Array.from(
    new Set(rows.map((r) => r.invoice_id).filter((v): v is string => Boolean(v)))
  );
  const clientNameByInvoice = await resolveClientNamesByInvoice(invoiceIds);

  return rows.map((p) => ({
    id: String(p.id),
    appointmentId: p.appointment_id ?? null,
    invoiceId: p.invoice_id ?? null,
    amount: Number(p.amount),
    currency: String(p.currency),
    status: p.status as PaymentStatus,
    provider: p.provider ?? null,
    providerRef: p.provider_ref ?? null,
    createdAt: String(p.created_at),
    clientName: p.invoice_id ? clientNameByInvoice.get(p.invoice_id) ?? null : null,
  }));
}

/**
 * Most recent invoices, newest first, with the billed client's name.
 */
export async function getRecentInvoices(limit = 25): Promise<InvoiceRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("invoices")
    .select("id, client_id, appointment_id, subtotal, discount, tax, total, status, issued_at, due_at, paid_at")
    .order("issued_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[finance] getRecentInvoices:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const clientIds = Array.from(new Set(rows.map((r) => r.client_id).filter(Boolean)));
  const nameByClient = await resolveClientNames(clientIds);

  return rows.map((inv) => ({
    id: String(inv.id),
    clientId: String(inv.client_id),
    clientName: nameByClient.get(inv.client_id) ?? null,
    appointmentId: inv.appointment_id ?? null,
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount),
    tax: Number(inv.tax),
    total: Number(inv.total),
    status: inv.status as PaymentStatus,
    issuedAt: String(inv.issued_at),
    dueAt: inv.due_at ?? null,
    paidAt: inv.paid_at ?? null,
  }));
}

/**
 * Expenses ledger, most recently incurred first.
 */
export async function getExpenses(limit = 200): Promise<Expense[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("incurred_on", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[finance] getExpenses:", error.message);
    return [];
  }

  return (data ?? []) as Expense[];
}

// ---- Internal helpers -----------------------------------------------------

async function resolveClientNames(clientIds: string[]): Promise<Map<string, string>> {
  const nameByClient = new Map<string, string>();
  if (clientIds.length === 0) return nameByClient;

  const supabase = await getSupabaseServerClient();
  if (!supabase) return nameByClient;

  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name")
    .in("id", clientIds);

  if (error) {
    console.error("[finance] resolveClientNames:", error.message);
    return nameByClient;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (data ?? []) as any[]) {
    nameByClient.set(String(c.id), String(c.full_name));
  }
  return nameByClient;
}

async function resolveClientNamesByInvoice(invoiceIds: string[]): Promise<Map<string, string>> {
  const nameByInvoice = new Map<string, string>();
  if (invoiceIds.length === 0) return nameByInvoice;

  const supabase = await getSupabaseServerClient();
  if (!supabase) return nameByInvoice;

  const { data, error } = await supabase
    .from("invoices")
    .select("id, client_id")
    .in("id", invoiceIds);

  if (error) {
    console.error("[finance] resolveClientNamesByInvoice:", error.message);
    return nameByInvoice;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoices = (data ?? []) as any[];
  const clientIds = Array.from(new Set(invoices.map((i) => i.client_id).filter(Boolean)));
  const nameByClient = await resolveClientNames(clientIds);

  for (const inv of invoices) {
    const name = nameByClient.get(inv.client_id);
    if (name) nameByInvoice.set(String(inv.id), name);
  }
  return nameByInvoice;
}
