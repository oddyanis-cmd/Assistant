/**
 * Unit tests for Reviews & Ratings logic.
 *
 * Tests cover:
 *   - Rating validation (1–5 range)
 *   - Average rating math (including edge cases)
 *   - StarDisplay rounding logic
 *
 * All tests are pure (no Supabase / Next.js dependencies).
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Rating validation — mirrors the constraint in submit_review() RPC
// ---------------------------------------------------------------------------

function isValidRating(rating: unknown): boolean {
  if (typeof rating !== "number") return false;
  if (!Number.isInteger(rating)) return false;
  return rating >= 1 && rating <= 5;
}

describe("isValidRating()", () => {
  it("accepts 1 as the minimum valid rating", () => {
    expect(isValidRating(1)).toBe(true);
  });

  it("accepts 5 as the maximum valid rating", () => {
    expect(isValidRating(5)).toBe(true);
  });

  it("accepts 2, 3, 4 as valid mid-range ratings", () => {
    expect(isValidRating(2)).toBe(true);
    expect(isValidRating(3)).toBe(true);
    expect(isValidRating(4)).toBe(true);
  });

  it("rejects 0 (below minimum)", () => {
    expect(isValidRating(0)).toBe(false);
  });

  it("rejects 6 (above maximum)", () => {
    expect(isValidRating(6)).toBe(false);
  });

  it("rejects negative numbers", () => {
    expect(isValidRating(-1)).toBe(false);
    expect(isValidRating(-100)).toBe(false);
  });

  it("rejects floats", () => {
    expect(isValidRating(3.5)).toBe(false);
    expect(isValidRating(1.1)).toBe(false);
  });

  it("rejects strings that look like numbers", () => {
    expect(isValidRating("3" as unknown as number)).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isValidRating(null)).toBe(false);
    expect(isValidRating(undefined)).toBe(false);
  });

  it("rejects NaN", () => {
    expect(isValidRating(NaN)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Average rating math — mirrors avg(rating) in the SQL helper functions
// ---------------------------------------------------------------------------

function computeAvgRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  // Round to 1 decimal place (mirrors: round(avg(rating)::numeric, 1))
  return Math.round((sum / ratings.length) * 10) / 10;
}

function computeReviewCount(ratings: number[]): number {
  return ratings.length;
}

describe("computeAvgRating()", () => {
  it("returns null for an empty array (no reviews)", () => {
    expect(computeAvgRating([])).toBeNull();
  });

  it("returns the single value for a single review", () => {
    expect(computeAvgRating([5])).toBe(5);
    expect(computeAvgRating([3])).toBe(3);
  });

  it("computes a simple average of [4, 5] → 4.5", () => {
    expect(computeAvgRating([4, 5])).toBe(4.5);
  });

  it("computes the average of all-5 ratings → 5", () => {
    expect(computeAvgRating([5, 5, 5, 5])).toBe(5);
  });

  it("rounds to 1 decimal place: [3, 4, 4] → 3.7", () => {
    // (3+4+4)/3 = 11/3 = 3.666… → rounds to 3.7
    expect(computeAvgRating([3, 4, 4])).toBe(3.7);
  });

  it("rounds to 1 decimal place: [1, 2, 3, 4, 5] → 3", () => {
    expect(computeAvgRating([1, 2, 3, 4, 5])).toBe(3);
  });

  it("handles a large dataset consistently", () => {
    const ratings = Array.from({ length: 100 }, (_, i) => (i % 5) + 1);
    const avg = computeAvgRating(ratings);
    expect(avg).toBe(3); // (1+2+3+4+5)*20 / 100 = 300/100 = 3
  });

  it("handles all-1 ratings → 1", () => {
    expect(computeAvgRating([1, 1, 1, 1, 1])).toBe(1);
  });
});

describe("computeReviewCount()", () => {
  it("returns 0 for empty array", () => {
    expect(computeReviewCount([])).toBe(0);
  });

  it("returns correct count for non-empty array", () => {
    expect(computeReviewCount([5, 4, 3])).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// StarDisplay rounding — fullStars = Math.floor(rating)
// ---------------------------------------------------------------------------

function getFullStarCount(rating: number): number {
  return Math.floor(rating);
}

describe("getFullStarCount() — star display logic", () => {
  it("5.0 → 5 full stars", () => {
    expect(getFullStarCount(5.0)).toBe(5);
  });

  it("4.7 → 4 full stars (floor)", () => {
    expect(getFullStarCount(4.7)).toBe(4);
  });

  it("4.5 → 4 full stars (floor)", () => {
    expect(getFullStarCount(4.5)).toBe(4);
  });

  it("3.0 → 3 full stars", () => {
    expect(getFullStarCount(3.0)).toBe(3);
  });

  it("1.0 → 1 full star", () => {
    expect(getFullStarCount(1.0)).toBe(1);
  });

  it("1.9 → 1 full star", () => {
    expect(getFullStarCount(1.9)).toBe(1);
  });

  it("0 → 0 full stars", () => {
    expect(getFullStarCount(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// One-review-per-appointment enforcement (logic test, no DB)
// ---------------------------------------------------------------------------

function hasExistingReview(
  reviewsByAppointmentId: Record<string, boolean>,
  appointmentId: string
): boolean {
  return reviewsByAppointmentId[appointmentId] === true;
}

describe("hasExistingReview()", () => {
  it("returns false when the appointment has no review", () => {
    expect(hasExistingReview({}, "appt-1")).toBe(false);
  });

  it("returns true when the appointment has an existing review", () => {
    expect(hasExistingReview({ "appt-1": true }, "appt-1")).toBe(true);
  });

  it("returns false for a different appointment that has a review", () => {
    expect(hasExistingReview({ "appt-2": true }, "appt-1")).toBe(false);
  });
});
