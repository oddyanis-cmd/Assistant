import { z } from 'zod';

// ── Availability query ────────────────────────────────────────────────
export const availabilityQuerySchema = z.object({
  serviceId: z.string().min(1),
  staffId:   z.string().min(1),      // cuid or "any"
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

// ── Create booking ────────────────────────────────────────────────────
export const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  staffId:   z.string().min(1),            // cuid or "any"
  startsAt:  z.string().datetime(),        // ISO UTC string
  firstName: z.string().min(1).max(100),
  lastName:  z.string().max(100).optional(),
  email:     z.string().email(),
  phone:     z.string().max(30).optional(),
  notes:     z.string().max(1000).optional(),
  marketingOptIn: z.boolean().optional().default(false),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// ── Staff query ───────────────────────────────────────────────────────
export const staffQuerySchema = z.object({
  serviceId: z.string().min(1).optional(),
});

// ── Cancel booking ────────────────────────────────────────────────────
export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});
