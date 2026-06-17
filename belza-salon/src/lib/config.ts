/**
 * Runtime configuration derived from env vars.
 * All references to env live here — callers import from this module.
 */

export const paymentsEnabled =
  process.env.PAYMENTS_ENABLED === 'true' &&
  !!process.env.STRIPE_SECRET_KEY &&
  !!process.env.STRIPE_WEBHOOK_SECRET;

export const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const emailFrom =
  process.env.EMAIL_FROM ?? 'Belza Salon <bookings@belzasalon.com>';

export const emailProvider =
  (process.env.EMAIL_PROVIDER as 'resend' | 'smtp' | undefined) ?? 'resend';

export const resendApiKey = process.env.RESEND_API_KEY ?? '';

export const smtpConfig = {
  host:     process.env.SMTP_HOST ?? '',
  port:     parseInt(process.env.SMTP_PORT ?? '587', 10),
  user:     process.env.SMTP_USER ?? '',
  password: process.env.SMTP_PASSWORD ?? '',
};

export const cronSecret = process.env.CRON_SECRET ?? '';
