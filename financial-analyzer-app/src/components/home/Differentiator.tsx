"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { Reveal } from "@/components/ui/Reveal";

export function Differentiator() {
  const { t } = useLanguage();
  return (
    <section className="band">
      <div className="wrap">
        <Reveal className="sec-head">
          <p className="eyebrow">{t("diff_eyebrow")}</p>
          <h2>{t("diff_h2")}</h2>
          <p className="lead">{t("diff_lead")}</p>
        </Reveal>
        <div className="diff-grid">
          <Reveal className="diff-card codecard">
            <div className="code-bar">
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
              <span className="fname">engine.ts · verified</span>
            </div>
            <div className="step-l">{t("diff_s1")}</div>
            <h3>{t("diff_c1h")}</h3>
            <p>{t("diff_c1p")}</p>
            <div className="code-lines" dir="ltr">
              <div>
                <span className="kw">grossMargin</span> = 40.00% <span className="ok">✓</span>
              </div>
              <div>
                <span className="kw">roe</span> = 24.38% <span className="ok">✓</span>
              </div>
              <div>
                <span className="kw">balanceCheck</span> = <span className="ok">reconciled</span>
              </div>
              <div>
                <span className="kw">ratio</span>(x / 0) = <span className="na">n/a</span>
              </div>
            </div>
          </Reveal>
          <div className="diff-arrow">
            <span>{t("diff_arrow")}</span>
          </div>
          <Reveal className="diff-card">
            <div className="step-l">{t("diff_s2")}</div>
            <h3>{t("diff_c2h")}</h3>
            <p>{t("diff_c2p")}</p>
            <p className="quote">{t("diff_quote")}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
