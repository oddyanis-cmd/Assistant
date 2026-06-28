"use server";

/**
 * Reviews & Ratings — server actions and data fetchers.
 * All mutations go through the submit_review SECURITY DEFINER RPC.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ReviewStats {
  avgRating: number | null;
  reviewCount: number;
}

export interface AdminReviewRow {
  id: string;
  appointment_id: string | null;
  client_name: string;
  service_name: string;
  staff_name: string;
  rating: number;
  comment: string | null;
  is_published: boolean;
  is_hidden: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// submit_review — calls SECURITY DEFINER RPC
// ---------------------------------------------------------------------------
export async function submitReview(
  appointmentId: string,
  rating: number,
  comment: string | null
): Promise<{ reviewId: string } | { error: string }> {
  if (rating < 1 || rating > 5) {
    return { error: "Rating must be between 1 and 5" };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("submit_review", {
    p_appointment_id: appointmentId,
    p_rating: rating,
    p_comment: comment ?? null,
  });

  if (error) {
    console.error("[reviews] submitReview:", error.message);
    return { error: error.message };
  }

  return { reviewId: String(data) };
}

// ---------------------------------------------------------------------------
// getMyReviewForAppointment — fetch the current user's review
// ---------------------------------------------------------------------------
export async function getMyReviewForAppointment(
  appointmentId: string
): Promise<ReviewRow | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "get_my_review_for_appointment",
    { p_appointment_id: appointmentId }
  );

  if (error) {
    console.error("[reviews] getMyReviewForAppointment:", error.message);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (data as any[])?.[0];
  if (!row) return null;

  return {
    id: String(row.id),
    rating: Number(row.rating),
    comment: row.comment ?? null,
    created_at: String(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// getServiceRatingStats — public stats for a service
// ---------------------------------------------------------------------------
export async function getServiceRatingStats(
  serviceId: string
): Promise<ReviewStats> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { avgRating: null, reviewCount: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "get_service_rating_stats",
    { p_service_id: serviceId }
  );

  if (error) {
    console.error("[reviews] getServiceRatingStats:", error.message);
    return { avgRating: null, reviewCount: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (data as any[])?.[0];
  if (!row) return { avgRating: null, reviewCount: 0 };

  return {
    avgRating: row.avg_rating != null ? Number(row.avg_rating) : null,
    reviewCount: Number(row.review_count ?? 0),
  };
}

// ---------------------------------------------------------------------------
// getStaffRatingStats — public stats for a staff member
// ---------------------------------------------------------------------------
export async function getStaffRatingStats(
  staffId: string
): Promise<ReviewStats> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { avgRating: null, reviewCount: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "get_staff_rating_stats",
    { p_staff_id: staffId }
  );

  if (error) {
    console.error("[reviews] getStaffRatingStats:", error.message);
    return { avgRating: null, reviewCount: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (data as any[])?.[0];
  if (!row) return { avgRating: null, reviewCount: 0 };

  return {
    avgRating: row.avg_rating != null ? Number(row.avg_rating) : null,
    reviewCount: Number(row.review_count ?? 0),
  };
}

// ---------------------------------------------------------------------------
// adminGetAllReviews — for moderation panel
// ---------------------------------------------------------------------------
export async function adminGetAllReviews(
  limit = 100,
  offset = 0
): Promise<AdminReviewRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("admin_get_all_reviews", {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("[reviews] adminGetAllReviews:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row) => ({
    id: String(row.id),
    appointment_id: row.appointment_id ?? null,
    client_name: String(row.client_name ?? ""),
    service_name: String(row.service_name ?? ""),
    staff_name: String(row.staff_name ?? ""),
    rating: Number(row.rating),
    comment: row.comment ?? null,
    is_published: Boolean(row.is_published),
    is_hidden: Boolean(row.is_hidden),
    created_at: String(row.created_at),
  }));
}

// ---------------------------------------------------------------------------
// adminModerateReview — hide / unhide
// ---------------------------------------------------------------------------
export async function adminModerateReview(
  reviewId: string,
  hide: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { success: false, error: "Not configured" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("admin_moderate_review", {
    p_review_id: reviewId,
    p_hide: hide,
  });

  if (error) {
    console.error("[reviews] adminModerateReview:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}
