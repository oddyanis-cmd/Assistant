/**
 * Admin Reviews — /admin/reviews
 * Gated on manage_reviews permission.
 * Lists all reviews with hide/unhide moderation controls.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import { adminGetAllReviews } from "@/lib/reviews";
import { getTranslations } from "next-intl/server";
import { ReviewModerationList } from "@/components/admin/ReviewModerationList";

export const metadata: Metadata = { title: "Reviews — Admin" };

interface ReviewsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminReviewsPage({ params }: ReviewsPageProps) {
  const { locale } = await params;
  const user = await getCurrentUserWithPermissions();

  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/reviews`);
  }

  const t = await getTranslations("adminPortal");

  if (!can(user, PERMISSIONS.MANAGE_REVIEWS)) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="card max-w-sm text-center">
          <div className="text-3xl mb-3 text-rose-300">◎</div>
          <p className="text-charcoal-600 text-sm">{t("access_denied_body")}</p>
        </div>
      </div>
    );
  }

  const reviews = await adminGetAllReviews(200, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light text-charcoal-900">
          {t("reviews_title")}
        </h1>
        <p className="text-charcoal-500 text-sm mt-1">{t("reviews_subtitle")}</p>
      </div>

      <ReviewModerationList reviews={reviews} />
    </div>
  );
}
