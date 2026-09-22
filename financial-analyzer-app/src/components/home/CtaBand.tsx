"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Reveal } from "@/components/ui/Reveal";

export function CtaBand() {
  const { t } = useLanguage();
  return (
    <section className="wrap">
      <Reveal as="div" className="cta-band">
        <h2>{t("cta_h2")}</h2>
        <p>{t("cta_p")}</p>
        <Link className="btn btn-primary" href="/pro">
          {t("cta_btn")}
        </Link>
      </Reveal>
    </section>
  );
}
