"use client";

/**
 * ReviewModerationList — interactive table of all reviews for admins.
 * Allows hide/unhide per row. Calls adminModerateReview server action.
 */
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { adminModerateReview } from "@/lib/reviews";
import type { AdminReviewRow } from "@/lib/reviews";
import { StarDisplay } from "@/components/reviews/StarPicker";

interface ReviewModerationListProps {
  reviews: AdminReviewRow[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ReviewRow({ review }: { review: AdminReviewRow }) {
  const t = useTranslations("adminPortal");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localHidden, setLocalHidden] = useState(review.is_hidden);
  const [err, setErr] = useState<string | null>(null);

  function handleToggle() {
    setErr(null);
    startTransition(async () => {
      const result = await adminModerateReview(review.id, !localHidden);
      if (result.success) {
        setLocalHidden(!localHidden);
        router.refresh();
      } else {
        setErr(result.error ?? "Error");
      }
    });
  }

  return (
    <tr
      className={`border-b border-nude-50 hover:bg-rose-50/30 transition-colors ${
        localHidden ? "opacity-50" : ""
      }`}
    >
      {/* Date */}
      <td className="py-3 px-3 text-xs text-charcoal-400 whitespace-nowrap">
        {formatDate(review.created_at)}
      </td>

      {/* Client */}
      <td className="py-3 px-3 text-sm font-medium text-charcoal-800 max-w-[120px] truncate">
        {review.client_name}
      </td>

      {/* Service */}
      <td className="py-3 px-3 text-sm text-charcoal-600 max-w-[140px] truncate">
        {review.service_name}
      </td>

      {/* Staff */}
      <td className="py-3 px-3 text-sm text-charcoal-600 max-w-[120px] truncate">
        {review.staff_name}
      </td>

      {/* Rating */}
      <td className="py-3 px-3">
        <StarDisplay rating={review.rating} size="sm" />
      </td>

      {/* Comment */}
      <td className="py-3 px-3 text-xs text-charcoal-500 max-w-[200px]">
        {review.comment ? (
          <span className="line-clamp-2">{review.comment}</span>
        ) : (
          <span className="italic text-charcoal-300">{t("reviews_no_comment")}</span>
        )}
      </td>

      {/* Status */}
      <td className="py-3 px-3">
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            localHidden
              ? "bg-charcoal-100 text-charcoal-500"
              : "bg-green-100 text-green-700"
          }`}
        >
          {localHidden ? t("reviews_hidden") : t("reviews_visible")}
        </span>
      </td>

      {/* Action */}
      <td className="py-3 px-3">
        {err && <p className="text-xs text-rose-500 mb-1">{err}</p>}
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
            localHidden
              ? "border-green-200 text-green-600 hover:bg-green-50"
              : "border-charcoal-200 text-charcoal-500 hover:bg-charcoal-50"
          }`}
        >
          {isPending
            ? "…"
            : localHidden
            ? t("reviews_unhide")
            : t("reviews_hide")}
        </button>
      </td>
    </tr>
  );
}

export function ReviewModerationList({ reviews }: ReviewModerationListProps) {
  const t = useTranslations("adminPortal");

  if (reviews.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-charcoal-400 italic">{t("reviews_empty")}</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm text-left rtl:text-right">
        <thead>
          <tr className="border-b border-nude-100">
            {[
              t("col_date"),
              t("col_client"),
              t("col_service"),
              t("col_staff"),
              t("col_rating"),
              t("col_comment"),
              t("col_status"),
              t("col_actions"),
            ].map((col) => (
              <th
                key={col}
                className="py-2 px-3 text-xs font-semibold text-charcoal-500 uppercase tracking-wide whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
