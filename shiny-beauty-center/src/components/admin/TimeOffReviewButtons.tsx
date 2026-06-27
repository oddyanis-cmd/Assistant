"use client";

import { useTransition, useState } from "react";
import { reviewTimeOffAction } from "@/app/[locale]/admin/time-off/actions";

interface Props {
  id: string;
  locale: string;
  approveLabel: string;
  rejectLabel: string;
}

export function TimeOffReviewButtons({ id, locale, approveLabel, rejectLabel }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  function handle(status: "approved" | "rejected") {
    startTransition(async () => {
      setError(null);
      const res = await reviewTimeOffAction(id, status, locale);
      if (res.error) { setError(res.error); return; }
      setDone(status);
    });
  }

  if (done) {
    return (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
        done === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}>
        {done === "approved" ? approveLabel : rejectLabel}
      </span>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={() => handle("approved")}
        disabled={isPending}
        className="text-xs px-3 py-1 rounded-lg bg-green-100 text-green-700 font-semibold hover:bg-green-200 transition-colors disabled:opacity-50"
      >
        {isPending ? "…" : approveLabel}
      </button>
      <button
        onClick={() => handle("rejected")}
        disabled={isPending}
        className="text-xs px-3 py-1 rounded-lg bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition-colors disabled:opacity-50"
      >
        {isPending ? "…" : rejectLabel}
      </button>
    </div>
  );
}
