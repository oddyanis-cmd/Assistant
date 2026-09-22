"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { Reveal } from "@/components/ui/Reveal";
import type { DictKey } from "@/lib/i18n/types";
import type { ReactNode } from "react";

const VIC_PROPS = {
  className: "vic",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  "aria-hidden": true,
} as const;

const VALUES: { h: DictKey; p: DictKey; icon: ReactNode }[] = [
  {
    h: "val1h",
    p: "val1p",
    icon: (
      <svg {...VIC_PROPS}>
        <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    h: "val2h",
    p: "val2p",
    icon: (
      <svg {...VIC_PROPS}>
        <path d="M6 3h9l3 3v15H6z" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    h: "val3h",
    p: "val3p",
    icon: (
      <svg {...VIC_PROPS}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function About() {
  const { t } = useLanguage();
  return (
    <section className="band" id="about">
      <div className="wrap about-grid">
        <Reveal className="sec-head">
          <p className="eyebrow">{t("about_eye")}</p>
          <h2>{t("about_h2")}</h2>
          <p className="about-lead">{t("about_lead")}</p>
          <p className="about-p">{t("about_p")}</p>
        </Reveal>
        <div className="values">
          {VALUES.map((v) => (
            <Reveal as="div" className="value" key={v.h}>
              {v.icon}
              <div>
                <h3>{t(v.h)}</h3>
                <p>{t(v.p)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
