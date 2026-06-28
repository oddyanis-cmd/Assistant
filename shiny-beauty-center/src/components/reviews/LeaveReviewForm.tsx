"use client";

/**
 * LeaveReviewForm — shown on completed appointments that have no review yet.
 * Calls the submitReview server action. On success shows the submitted review.
 */
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { StarPicker, StarDisplay } from "@/components/reviews/StarPicker";
import { submitReview } from "@/lib/reviews";
import type { ReviewRow } from "@/lib/reviews";

interface LeaveReviewFormProps {
  appointmentId: string;
  existingReview?: ReviewRow | null;
}

export function LeaveReviewForm({
  appointmentId,
  existingReview,
}: LeaveReviewFormProps) {
  const t = useTranslations("reviews");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rating, setRating] = useState<number>(existingReview?.rating ?? 0);
  const [comment, setComment] = useState<string>(
    existingReview?.comment ?? ""
  );
  const [submitted, setSubmitted] = useState<ReviewRow | null>(
    existingReview ?? null
  );
  const [error, setError] = useState<string | null>(null);

  // Already submitted — show the submitted review
  if (submitted) {
    return (
      <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl">
        <p className="text-xs font-semibold text-rose-700 mb-2">
          {t("your_review")}
        </p>
        <StarDisplay rating={submitted.rating} size="sm" />
        {submitted.comment && (
          <p className="text-sm text-charcoal-600 mt-2 leading-relaxed">
            &ldquo;{submitted.comment}&rdquo;
          </p>
        )}
      </div>
    );
  }

  function handleSubmit() {
    if (rating === 0) {
      setError(t("error_no_rating"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitReview(
        appointmentId,
        rating,
        comment.trim() || null
      );
      if ("error" in result) {
        setError(result.error);
      } else {
        setSubmitted({
          id: result.reviewId,
          rating,
          comment: comment.trim() || null,
          created_at: new Date().toISOString(),
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-4 p-4 bg-cream-50 border border-nude-100 rounded-2xl">
      <p className="text-xs font-semibold text-charcoal-700 mb-3">
        {t("leave_review")}
      </p>

      {/* Star picker */}
      <div className="mb-3">
        <StarPicker value={rating} onChange={setRating} size="md" />
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("comment_placeholder")}
        rows={3}
        maxLength={500}
        className="w-full text-sm border border-nude-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-rose-300 placeholder:text-charcoal-300 bg-white"
      />

      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || rating === 0}
        className="mt-3 btn-primary text-xs px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? t("submitting") : t("submit_review")}
      </button>
    </div>
  );
}
