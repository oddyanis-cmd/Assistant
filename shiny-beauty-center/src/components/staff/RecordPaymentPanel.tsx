/**
 * RecordPaymentPanel — record a cash/card/transfer payment against an
 * appointment and show any payments already taken. Shown only to users with
 * process_payments.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  recordManualPaymentAction,
  refundAppointmentPaymentAction,
} from "@/app/[locale]/staff/appointment/[id]/payment-actions";

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-cream-100 text-cream-700",
  pending: "bg-nude-100 text-nude-600",
  refunded: "bg-charcoal-100 text-charcoal-500",
  failed: "bg-red-100 text-red-700",
};

export function RecordPaymentPanel({
  appointmentId,
  locale,
  price,
  payments,
  paidTotal,
  currency,
  canRefund,
}: {
  appointmentId: string;
  locale: string;
  price: number;
  payments: PaymentRow[];
  paidTotal: number;
  currency: string;
  canRefund: boolean;
}) {
  const router = useRouter();
  const due = Math.max(0, price - paidTotal);
  const [amount, setAmount] = useState<number>(due > 0 ? due : price);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function fmt(n: number) {
    return `${n.toLocaleString("en-SA")} ${currency}`;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await recordManualPaymentAction(
        appointmentId,
        Number(amount),
        method,
        reference.trim() || null,
        locale
      );
      if (res.error) setMessage({ ok: false, text: res.error });
      else {
        setMessage({ ok: true, text: "Payment recorded." });
        setReference("");
        router.refresh();
      }
    });
  }

  function refund(paymentId: string) {
    if (!window.confirm("Refund this payment?")) return;
    setMessage(null);
    startTransition(async () => {
      const res = await refundAppointmentPaymentAction(paymentId, appointmentId, null, locale);
      if (res.error) setMessage({ ok: false, text: res.error });
      else router.refresh();
    });
  }

  const fullyPaid = due <= 0 && paidTotal > 0;

  return (
    <div className="card">
      <h2 className="text-base font-semibold text-charcoal-800 mb-4">Payment</h2>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div className="rounded-xl bg-nude-50 py-2">
          <p className="text-[11px] text-charcoal-400 uppercase tracking-wide">Price</p>
          <p className="text-sm font-semibold text-charcoal-800">{fmt(price)}</p>
        </div>
        <div className="rounded-xl bg-nude-50 py-2">
          <p className="text-[11px] text-charcoal-400 uppercase tracking-wide">Paid</p>
          <p className="text-sm font-semibold text-green-700">{fmt(paidTotal)}</p>
        </div>
        <div className="rounded-xl bg-nude-50 py-2">
          <p className="text-[11px] text-charcoal-400 uppercase tracking-wide">Due</p>
          <p className="text-sm font-semibold text-rose-700">{fmt(due)}</p>
        </div>
      </div>

      {/* Existing payments */}
      {payments.length > 0 && (
        <ul className="space-y-2 mb-4">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between py-2 border-b border-nude-100 last:border-0"
            >
              <div>
                <span className="text-sm font-medium text-charcoal-700">{fmt(p.amount)}</span>
                <span className="text-xs text-charcoal-400 ms-2 capitalize">
                  {p.provider ?? "—"} · {new Date(p.created_at).toLocaleDateString(
                    locale === "ar" ? "ar-SA" : "en-GB"
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                    STATUS_STYLES[p.status] ?? "bg-nude-100 text-nude-600"
                  }`}
                >
                  {p.status}
                </span>
                {canRefund && p.status === "paid" && (
                  <button
                    type="button"
                    onClick={() => refund(p.id)}
                    disabled={isPending}
                    className="text-[11px] text-charcoal-400 hover:text-red-600 disabled:opacity-50"
                  >
                    Refund
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Record form */}
      {fullyPaid ? (
        <p className="text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2 text-center">
          Fully paid ✓
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="field-label">Amount ({currency})</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              className="field-input"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="field-label">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="field-input"
              disabled={isPending}
            >
              <option value="cash">Cash</option>
              <option value="card">Card (in person)</option>
              <option value="transfer">Bank transfer</option>
            </select>
          </div>
          <div>
            <label className="field-label">Reference (optional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Receipt / txn no."
              className="field-input"
              disabled={isPending}
            />
          </div>
          <button type="submit" disabled={isPending} className="btn-primary text-sm w-full">
            {isPending ? "Recording…" : "Record payment"}
          </button>
        </form>
      )}

      {message && (
        <p className={`text-xs mt-2 ${message.ok ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
