/**
 * Notification system — shared types.
 *
 * All types used across provider adapters, templates, and the send() entry point.
 */

export type NotificationChannel = "email" | "whatsapp";

export type TemplateId = "booking_confirmed" | "reminder_24h" | "reminder_2h";

/** Data passed to template renderers */
export interface TemplateData {
  clientName: string;
  serviceName: string;
  /** ISO string — human-formatted inside the template */
  startAt: string;
  /** e.g. "Studio 2, 2nd Floor" */
  location?: string;
  /** Public booking token / reference */
  bookingRef?: string;
  /** Staff/specialist name */
  staffName?: string;
  /** Price with currency, e.g. "250 SAR" */
  price?: string;
}

/** What send() accepts */
export interface SendParams {
  channel: NotificationChannel;
  /** Phone number (E.164, e.g. "+966501234567") or email address */
  to: string;
  template: TemplateId;
  data: TemplateData;
  /** "en" | "ar" — controls which template variant is used */
  locale?: "en" | "ar";
}

/** Result returned by each provider adapter */
export interface SendResult {
  ok: boolean;
  /** Provider-assigned message / message-SID / null on no-op */
  externalId?: string | null;
  error?: string;
}
