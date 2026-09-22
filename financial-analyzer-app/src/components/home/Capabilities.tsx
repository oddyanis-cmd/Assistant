"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { Reveal } from "@/components/ui/Reveal";
import type { DictKey } from "@/lib/i18n/types";
import type { ReactNode } from "react";

const ICON_PROPS = {
  className: "ic",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  "aria-hidden": true,
} as const;

const CAPS: { h: DictKey; p: DictKey; icon: ReactNode }[] = [
  {
    h: "cap1h",
    p: "cap1p",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 3v18h18" strokeLinecap="round" />
        <path d="M7 15l4-5 3 3 4-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    h: "cap2h",
    p: "cap2p",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="4" width="8" height="16" rx="1.5" />
        <rect x="14" y="9" width="7" height="11" rx="1.5" />
      </svg>
    ),
  },
  {
    h: "cap3h",
    p: "cap3p",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 2v20M5 6l7-4 7 4M4 10c2 2 14 2 16 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    h: "cap4h",
    p: "cap4p",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    h: "cap5h",
    p: "cap5p",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    h: "cap6h",
    p: "cap6p",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="9" />
        <path
          d="M12 7v10M9.5 9.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 1.5-2.5 1.5-2.5.5-2.5 1.8 1.1 2 2.5 2 2.5-.8 2.5-2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function Capabilities() {
  const { t } = useLanguage();
  return (
    <section className="band" id="capabilities">
      <div className="wrap">
        <Reveal className="sec-head">
          <p className="eyebrow">{t("caps_eyebrow")}</p>
          <h2>{t("caps_h2")}</h2>
          <p className="lead">{t("caps_lead")}</p>
        </Reveal>
        <div className="cap-grid">
          {CAPS.map((cap) => (
            <Reveal className="cap" key={cap.h}>
              {cap.icon}
              <h3>{t(cap.h)}</h3>
              <p>{t(cap.p)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
