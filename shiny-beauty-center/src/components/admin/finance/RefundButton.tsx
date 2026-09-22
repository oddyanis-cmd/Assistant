/**
 * RefundButton — refund a single paid payment via the refund_payment RPC.
 * Shown only next to 'paid' rows, only to users holding issue_refund.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { refundPaymentAction } from "@/app/[locale]/admin/finance/actions";

export function RefundButton({
  paymentId,
  locale,
}: {
  paymentId: string;
  locale: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRefund() {
    const input = window.prompt("Refund this payment. Optional reason:");
    if (input === null) return; // cancelled
    setError(null);
    startTransition(async () => {
      const result = await refundPaymentAction(paymentId, input.trim() || null, locale);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRefund}
        disabled={isPending}
        className="text-xs text-charcoal-400 hover:text-red-600 disabled:opacity-50"
      >
        {isPending ? "Refunding…" : "Refund"}
      </button>
      {error && <p className="text-[10px] text-red-600 mt-1 max-w-[10rem]">{error}</p>}
    </div>
  );
}
