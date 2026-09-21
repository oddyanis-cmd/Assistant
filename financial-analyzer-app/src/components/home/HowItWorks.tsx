"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { Reveal } from "@/components/ui/Reveal";
import type { DictKey } from "@/lib/i18n/types";

const STEPS: { h: DictKey; p: DictKey }[] = [
  { h: "p1h", p: "p1p" },
  { h: "p2h", p: "p2p" },
  { h: "p3h", p: "p3p" },
];

export function HowItWorks() {
  const { t } = useLanguage();
  return (
    <section className="band" id="how">
      <div className="wrap">
        <Reveal className="sec-head">
          <p className="eyebrow">{t("process_eyebrow")}</p>
          <h2>{t("process_h2")}</h2>
        </Reveal>
        <div className="steps">
          {STEPS.map((step, i) => (
            <Reveal className="step" key={step.h}>
              <div className="no">{i + 1}</div>
              <h3>{t(step.h)}</h3>
              <p>{t(step.p)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
