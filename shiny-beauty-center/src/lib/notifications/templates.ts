/**
 * EN + AR message templates for email and WhatsApp.
 *
 * Each template returns a { subject, body } pair.
 * WhatsApp body is plain-text; email body is an HTML string.
 */

import type { TemplateId, TemplateData } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO date string to a human-readable format in the given locale */
function formatDate(iso: string, locale: "en" | "ar"): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Plain-text (WhatsApp) templates
// ---------------------------------------------------------------------------

function whatsappBookingConfirmed(
  data: TemplateData,
  locale: "en" | "ar"
): string {
  const date = formatDate(data.startAt, locale);

  if (locale === "ar") {
    return [
      `✨ *مركز شايني للتجميل — تأكيد الحجز*`,
      ``,
      `أهلاً ${data.clientName}!`,
      ``,
      `تم تأكيد موعدك بنجاح. إليكِ التفاصيل:`,
      ``,
      `📋 *الخدمة:* ${data.serviceName}`,
      `📅 *الموعد:* ${date}`,
      data.staffName ? `💅 *المتخصصة:* ${data.staffName}` : null,
      data.location ? `📍 *الموقع:* ${data.location}` : null,
      data.price ? `💰 *السعر:* ${data.price}` : null,
      data.bookingRef ? `🔖 *رقم الحجز:* ${data.bookingRef}` : null,
      ``,
      `يرجى الحضور قبل 5 دقائق من موعدك.`,
      ``,
      `نتطلع لرؤيتكِ! 💖`,
    ]
      .filter((l) => l !== null)
      .join("\n");
  }

  return [
    `✨ *Shiny Beauty Center — Booking Confirmed*`,
    ``,
    `Hello ${data.clientName}!`,
    ``,
    `Your appointment has been confirmed. Here are your details:`,
    ``,
    `📋 *Service:* ${data.serviceName}`,
    `📅 *Date & Time:* ${date}`,
    data.staffName ? `💅 *Specialist:* ${data.staffName}` : null,
    data.location ? `📍 *Location:* ${data.location}` : null,
    data.price ? `💰 *Price:* ${data.price}` : null,
    data.bookingRef ? `🔖 *Booking Ref:* ${data.bookingRef}` : null,
    ``,
    `Please arrive 5 minutes early.`,
    ``,
    `We look forward to seeing you! 💖`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function whatsappReminder24h(data: TemplateData, locale: "en" | "ar"): string {
  const date = formatDate(data.startAt, locale);

  if (locale === "ar") {
    return [
      `⏰ *تذكير — موعدكِ غداً*`,
      ``,
      `مرحباً ${data.clientName}!`,
      ``,
      `نذكّركِ بأن لديكِ موعداً غداً في *مركز شايني للتجميل*.`,
      ``,
      `📋 *الخدمة:* ${data.serviceName}`,
      `📅 *الموعد:* ${date}`,
      data.staffName ? `💅 *المتخصصة:* ${data.staffName}` : null,
      data.location ? `📍 *الموقع:* ${data.location}` : null,
      ``,
      `نراكِ غداً! ✨`,
    ]
      .filter((l) => l !== null)
      .join("\n");
  }

  return [
    `⏰ *Reminder — Your appointment is tomorrow*`,
    ``,
    `Hi ${data.clientName}!`,
    ``,
    `This is a reminder that you have an appointment tomorrow at *Shiny Beauty Center*.`,
    ``,
    `📋 *Service:* ${data.serviceName}`,
    `📅 *Date & Time:* ${date}`,
    data.staffName ? `💅 *Specialist:* ${data.staffName}` : null,
    data.location ? `📍 *Location:* ${data.location}` : null,
    ``,
    `See you tomorrow! ✨`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function whatsappReminder2h(data: TemplateData, locale: "en" | "ar"): string {
  const date = formatDate(data.startAt, locale);

  if (locale === "ar") {
    return [
      `⏰ *تذكير — موعدكِ بعد ساعتين*`,
      ``,
      `مرحباً ${data.clientName}!`,
      ``,
      `موعدكِ في *مركز شايني للتجميل* بعد ساعتين تقريباً.`,
      ``,
      `📋 *الخدمة:* ${data.serviceName}`,
      `📅 *الوقت:* ${date}`,
      data.location ? `📍 *الموقع:* ${data.location}` : null,
      ``,
      `نتطلع لرؤيتكِ قريباً! 💖`,
    ]
      .filter((l) => l !== null)
      .join("\n");
  }

  return [
    `⏰ *Reminder — Your appointment is in 2 hours*`,
    ``,
    `Hi ${data.clientName}!`,
    ``,
    `Your appointment at *Shiny Beauty Center* is coming up in about 2 hours.`,
    ``,
    `📋 *Service:* ${data.serviceName}`,
    `📅 *Time:* ${date}`,
    data.location ? `📍 *Location:* ${data.location}` : null,
    ``,
    `See you soon! 💖`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

// ---------------------------------------------------------------------------
// HTML email templates
// ---------------------------------------------------------------------------

/** Shared CSS / wrapper for email HTML */
function emailWrapper(
  content: string,
  locale: "en" | "ar"
): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const fontFamily =
    locale === "ar"
      ? "'Noto Sans Arabic', Tahoma, Arial, sans-serif"
      : "Inter, 'Helvetica Neue', Arial, sans-serif";

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Shiny Beauty Center</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fefdfb; font-family: ${fontFamily}; color: #2d2e35; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 24px 16px 48px; }
    .header { text-align: center; padding: 32px 0 24px; }
    .logo-text { font-size: 22px; font-weight: 300; color: #2d2e35; }
    .logo-em { color: #f43f5e; font-style: normal; }
    .card { background: #fff; border: 1px solid #f2d9d0; border-radius: 16px;
            padding: 28px 24px; margin-bottom: 16px; }
    .badge { display: inline-block; background: #fff1f2; color: #e11d48;
             border: 1px solid #fecdd3; border-radius: 999px;
             font-size: 12px; font-weight: 600; padding: 4px 12px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 400; margin-bottom: 8px; color: #2d2e35; }
    .subtitle { font-size: 14px; color: #62636e; margin-bottom: 24px; }
    .detail-row { display: flex; gap: 10px; align-items: flex-start;
                  padding: 10px 0; border-bottom: 1px solid #f9ede8; }
    .detail-row:last-child { border-bottom: none; }
    .detail-icon { font-size: 16px; width: 24px; flex-shrink: 0; margin-top: 1px; }
    .detail-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
                    color: #7c7e89; margin-bottom: 2px; }
    .detail-value { font-size: 14px; font-weight: 500; color: #2d2e35; }
    .ref-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px;
               padding: 14px 18px; text-align: center; margin-top: 16px; }
    .ref-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;
                 color: #7c7e89; margin-bottom: 4px; }
    .ref-value { font-size: 20px; font-family: monospace; font-weight: 700;
                 color: #e11d48; letter-spacing: 0.15em; text-transform: uppercase; }
    .note-box { background: #fff1f2; border: 1px solid #ffe4e6; border-radius: 10px;
                padding: 14px 18px; font-size: 13px; color: #4e4f5a; line-height: 1.6; margin-top: 16px; }
    .footer { text-align: center; font-size: 12px; color: #7c7e89; margin-top: 32px; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo-text">Shiny <span class="logo-em">Beauty</span> Center</div>
    </div>
    ${content}
    <div class="footer">
      Shiny Beauty Center — Luxury Beauty, Exclusively for Women<br/>
      If you need to change your appointment, please visit our website or contact us.
    </div>
  </div>
</body>
</html>`;
}

function emailBookingConfirmed(
  data: TemplateData,
  locale: "en" | "ar"
): { subject: string; html: string } {
  const date = formatDate(data.startAt, locale);

  const isAr = locale === "ar";
  const subject = isAr
    ? `تأكيد حجزكِ — ${data.serviceName}`
    : `Booking Confirmed — ${data.serviceName}`;

  const rows = [
    { icon: "📋", label: isAr ? "الخدمة" : "Service", value: data.serviceName },
    { icon: "📅", label: isAr ? "الموعد" : "Date & Time", value: date },
    data.staffName
      ? { icon: "💅", label: isAr ? "المتخصصة" : "Specialist", value: data.staffName }
      : null,
    data.location
      ? { icon: "📍", label: isAr ? "الموقع" : "Location", value: data.location }
      : null,
    data.price
      ? { icon: "💰", label: isAr ? "السعر" : "Price", value: data.price }
      : null,
  ]
    .filter(Boolean)
    .map(
      (r) => `<div class="detail-row">
        <span class="detail-icon">${r!.icon}</span>
        <div>
          <div class="detail-label">${r!.label}</div>
          <div class="detail-value">${r!.value}</div>
        </div>
      </div>`
    )
    .join("");

  const refBlock = data.bookingRef
    ? `<div class="ref-box">
        <div class="ref-label">${isAr ? "رقم الحجز" : "Booking Reference"}</div>
        <div class="ref-value">${data.bookingRef}</div>
      </div>`
    : "";

  const noteMsg = isAr
    ? "يرجى الحضور قبل 5 دقائق من موعدك. إذا احتجتِ تغيير أي شيء، يُرجى التواصل معنا في أقرب وقت ممكن. نتطلع لرؤيتكِ! 💖"
    : "Please arrive 5 minutes early. If you need to make any changes, please contact us as soon as possible. We look forward to seeing you! 💖";

  const html = emailWrapper(
    `<div class="card">
      <div class="badge">${isAr ? "تأكيد الحجز" : "Booking Confirmed"}</div>
      <h1>${isAr ? `مرحباً ${data.clientName}!` : `Hello ${data.clientName}!`}</h1>
      <p class="subtitle">${isAr ? "تم تأكيد موعدك بنجاح." : "Your appointment has been confirmed."}</p>
      ${rows}
      ${refBlock}
      <div class="note-box">${noteMsg}</div>
    </div>`,
    locale
  );

  return { subject, html };
}

function emailReminder24h(
  data: TemplateData,
  locale: "en" | "ar"
): { subject: string; html: string } {
  const date = formatDate(data.startAt, locale);
  const isAr = locale === "ar";
  const subject = isAr
    ? `تذكير — موعدكِ غداً: ${data.serviceName}`
    : `Reminder — Your appointment is tomorrow: ${data.serviceName}`;

  const rows = [
    { icon: "📋", label: isAr ? "الخدمة" : "Service", value: data.serviceName },
    { icon: "📅", label: isAr ? "الموعد" : "Date & Time", value: date },
    data.staffName
      ? { icon: "💅", label: isAr ? "المتخصصة" : "Specialist", value: data.staffName }
      : null,
    data.location
      ? { icon: "📍", label: isAr ? "الموقع" : "Location", value: data.location }
      : null,
  ]
    .filter(Boolean)
    .map(
      (r) => `<div class="detail-row">
        <span class="detail-icon">${r!.icon}</span>
        <div>
          <div class="detail-label">${r!.label}</div>
          <div class="detail-value">${r!.value}</div>
        </div>
      </div>`
    )
    .join("");

  const noteMsg = isAr
    ? "نذكّركِ بموعدكِ غداً. نراكِ في المركز! ✨"
    : "This is your 24-hour reminder. We look forward to seeing you tomorrow! ✨";

  const html = emailWrapper(
    `<div class="card">
      <div class="badge">${isAr ? "تذكير بالموعد — غداً" : "Appointment Reminder — Tomorrow"}</div>
      <h1>${isAr ? `مرحباً ${data.clientName}!` : `Hi ${data.clientName}!`}</h1>
      <p class="subtitle">${isAr ? "موعدكِ غداً في مركز شايني للتجميل." : "Your appointment is tomorrow at Shiny Beauty Center."}</p>
      ${rows}
      <div class="note-box">${noteMsg}</div>
    </div>`,
    locale
  );

  return { subject, html };
}

function emailReminder2h(
  data: TemplateData,
  locale: "en" | "ar"
): { subject: string; html: string } {
  const date = formatDate(data.startAt, locale);
  const isAr = locale === "ar";
  const subject = isAr
    ? `تذكير — موعدكِ بعد ساعتين: ${data.serviceName}`
    : `Reminder — Your appointment is in 2 hours: ${data.serviceName}`;

  const rows = [
    { icon: "📋", label: isAr ? "الخدمة" : "Service", value: data.serviceName },
    { icon: "📅", label: isAr ? "الوقت" : "Time", value: date },
    data.location
      ? { icon: "📍", label: isAr ? "الموقع" : "Location", value: data.location }
      : null,
  ]
    .filter(Boolean)
    .map(
      (r) => `<div class="detail-row">
        <span class="detail-icon">${r!.icon}</span>
        <div>
          <div class="detail-label">${r!.label}</div>
          <div class="detail-value">${r!.value}</div>
        </div>
      </div>`
    )
    .join("");

  const noteMsg = isAr
    ? "موعدكِ بعد ساعتين تقريباً. نتطلع لرؤيتكِ قريباً! 💖"
    : "Your appointment is coming up in about 2 hours. See you soon! 💖";

  const html = emailWrapper(
    `<div class="card">
      <div class="badge">${isAr ? "تذكير بالموعد — 2 ساعة" : "Appointment Reminder — 2 Hours"}</div>
      <h1>${isAr ? `مرحباً ${data.clientName}!` : `Hi ${data.clientName}!`}</h1>
      <p class="subtitle">${isAr ? "موعدكِ قريباً جداً!" : "Your appointment is coming up very soon!"}</p>
      ${rows}
      <div class="note-box">${noteMsg}</div>
    </div>`,
    locale
  );

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderWhatsAppTemplate(
  template: TemplateId,
  data: TemplateData,
  locale: "en" | "ar" = "en"
): string {
  switch (template) {
    case "booking_confirmed":
      return whatsappBookingConfirmed(data, locale);
    case "reminder_24h":
      return whatsappReminder24h(data, locale);
    case "reminder_2h":
      return whatsappReminder2h(data, locale);
  }
}

export function renderEmailTemplate(
  template: TemplateId,
  data: TemplateData,
  locale: "en" | "ar" = "en"
): { subject: string; html: string } {
  switch (template) {
    case "booking_confirmed":
      return emailBookingConfirmed(data, locale);
    case "reminder_24h":
      return emailReminder24h(data, locale);
    case "reminder_2h":
      return emailReminder2h(data, locale);
  }
}
