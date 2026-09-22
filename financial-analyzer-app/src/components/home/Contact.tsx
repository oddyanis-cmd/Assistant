"use client";

import { useState, type FormEvent } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Reveal } from "@/components/ui/Reveal";

/** mailto: contact form — no backend needed, ported verbatim from keel-landing. */
export function Contact() {
  const { t } = useLanguage();
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement | null)?.value ?? "";
    const email = (form.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "";
    const message = (form.elements.namedItem("message") as HTMLTextAreaElement | null)?.value ?? "";
    const subject = encodeURIComponent(`Keel enquiry${name ? ` — ${name}` : ""}`);
    const body = encodeURIComponent(`${message}\n\n— ${name}${email ? ` <${email}>` : ""}`);
    setSent(true);
    window.location.href = `mailto:hello@keel.finance?subject=${subject}&body=${body}`;
  }

  return (
    <section className="band" id="contact">
      <div className="wrap">
        <Reveal className="sec-head" style={{ maxWidth: "none" }}>
          <p className="eyebrow">{t("contact_eye")}</p>
          <h2>{t("contact_h2")}</h2>
        </Reveal>
        <div className="contact-grid">
          <Reveal as="form" className="cform" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="c_name">{t("c_name")}</label>
              <input type="text" id="c_name" name="name" autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="c_email">{t("c_email")}</label>
              <input type="email" id="c_email" name="email" autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="c_msg">{t("c_msg")}</label>
              <textarea id="c_msg" name="message" />
            </div>
            <button type="submit" className="btn btn-primary">
              {t("c_send")}
            </button>
            {sent && <p className="cnote">{t("c_thanks")}</p>}
          </Reveal>
          <Reveal as="div" className="contact-side">
            <p className="lead">{t("contact_side")}</p>
            <div className="ci">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <span>{t("c_email_l")}</span> · <a href="mailto:hello@keel.finance">hello@keel.finance</a>
              </div>
            </div>
            <div className="ci">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <span>{t("c_hours")}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
