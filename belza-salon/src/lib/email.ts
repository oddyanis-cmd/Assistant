/**
 * Email sending abstraction.
 *
 * In development (or when RESEND_API_KEY / SMTP not configured) this
 * logs to console instead of sending.
 *
 * Production: set EMAIL_PROVIDER="resend" and RESEND_API_KEY,
 *             or EMAIL_PROVIDER="smtp" with SMTP_* vars.
 *
 * Resend SDK and Nodemailer are wired but only instantiated when the
 * respective env vars are present — missing keys don't crash the build.
 */

import { formatTimeInTz, formatDateInTz, formatCents, formatDuration } from './time';
import { emailFrom, emailProvider, resendApiKey, smtpConfig } from './config';

export interface ConfirmationEmailData {
  to:          string;
  firstName:   string;
  serviceName: string;
  staffName:   string;
  startsAt:    Date;
  endsAt:      Date;
  priceCents:  number;
  currency:    string;
  cancelUrl:   string;
  timezone:    string;
  salonName:   string;
  addressLine: string;
}

export async function sendConfirmationEmail(data: ConfirmationEmailData): Promise<void> {
  const {
    to, firstName, serviceName, staffName,
    startsAt, endsAt, priceCents, currency,
    cancelUrl, timezone, salonName, addressLine,
  } = data;

  const dateStr  = formatDateInTz(startsAt, timezone);
  const startStr = formatTimeInTz(startsAt, timezone);
  const endStr   = formatTimeInTz(endsAt, timezone);
  const price    = formatCents(priceCents, currency);

  const subject = `Your appointment at ${salonName} is confirmed`;
  const text = [
    `Hi ${firstName},`,
    '',
    `Your appointment is confirmed! Here are your details:`,
    '',
    `  Service:  ${serviceName}`,
    `  Stylist:  ${staffName}`,
    `  Date:     ${dateStr}`,
    `  Time:     ${startStr} – ${endStr}`,
    `  Price:    ${price}`,
    ...(addressLine ? [`  Location: ${addressLine}`] : []),
    '',
    `Need to cancel? You can do so up to 24 hours before your appointment:`,
    `  ${cancelUrl}`,
    '',
    `We look forward to seeing you!`,
    '',
    `— The ${salonName} Team`,
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#faf8f6;color:#2c2220;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #f0ebe8;box-shadow:0 2px 8px rgba(44,34,32,0.08);overflow:hidden;">
    <div style="background:#d4614f;padding:24px 32px;">
      <span style="font-size:24px;font-weight:700;color:#fff;font-family:Georgia,serif;">${salonName}</span>
    </div>
    <div style="padding:32px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:64px;height:64px;background:#dcfce7;border:3px solid #16a34a;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">✓</div>
        <h1 style="font-size:22px;font-weight:700;color:#2c2220;margin:16px 0 4px;font-family:Georgia,serif;">You're all booked!</h1>
        <p style="color:#6b5e59;font-size:14px;margin:0;">Hi ${firstName}, we look forward to seeing you.</p>
      </div>
      <div style="background:#f3ede9;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#9c8e88;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;width:90px;">Service</td><td style="padding:6px 0;color:#2c2220;font-weight:500;">${serviceName}</td></tr>
          <tr><td style="padding:6px 0;color:#9c8e88;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Stylist</td><td style="padding:6px 0;color:#2c2220;font-weight:500;">${staffName}</td></tr>
          <tr><td style="padding:6px 0;color:#9c8e88;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Date</td><td style="padding:6px 0;color:#2c2220;font-weight:500;">${dateStr}</td></tr>
          <tr><td style="padding:6px 0;color:#9c8e88;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Time</td><td style="padding:6px 0;color:#2c2220;font-weight:500;">${startStr} – ${endStr}</td></tr>
          <tr><td style="padding:6px 0;color:#9c8e88;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Price</td><td style="padding:6px 0;color:#2c2220;font-weight:500;">${price}</td></tr>
          ${addressLine ? `<tr><td style="padding:6px 0;color:#9c8e88;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Location</td><td style="padding:6px 0;color:#2c2220;font-weight:500;">${addressLine}</td></tr>` : ''}
        </table>
      </div>
      <p style="font-size:13px;color:#6b5e59;text-align:center;margin-bottom:16px;">
        Need to cancel? Free cancellation up to 24 hours before your appointment.
      </p>
      <div style="text-align:center;">
        <a href="${cancelUrl}" style="display:inline-block;padding:12px 28px;background:#d4614f;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;font-size:13px;">Manage Booking</a>
      </div>
    </div>
    <div style="background:#f3ede9;padding:16px 32px;text-align:center;">
      <p style="font-size:12px;color:#9c8e88;margin:0;">&copy; ${new Date().getFullYear()} ${salonName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`.trim();

  // ── Dev: log only ──────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production' || (!resendApiKey && !smtpConfig.host)) {
    console.log('[email] Would send confirmation email:');
    console.log(`  To:      ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Cancel:  ${cancelUrl}`);
    return;
  }

  // ── Resend ──────────────────────────────────────────────────────
  if (emailProvider === 'resend' && resendApiKey) {
    const { Resend } = await import('resend');
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: emailFrom,
      to,
      subject,
      text,
      html,
    });
    return;
  }

  // ── SMTP ────────────────────────────────────────────────────────
  if (emailProvider === 'smtp' && smtpConfig.host) {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      auth: { user: smtpConfig.user, pass: smtpConfig.password },
    });
    await transporter.sendMail({ from: emailFrom, to, subject, text, html });
    return;
  }

  console.warn('[email] No email provider configured — skipping send.');
}
