"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Reveal } from "@/components/ui/Reveal";

export function SampleReportShowcase() {
  const { t } = useLanguage();
  return (
    <section className="band">
      <div className="wrap report-wrap">
        <Reveal as="div" className="paper" role="img" aria-label="Example analysis report">
          <div className="doc-eye">{t("rep_eye")}</div>
          <h4>{t("rep_co")}</h4>
          <div className="rule" />
          <div className="lbl">{t("rep_execl")}</div>
          <p className="exec">{t("rep_exec")}</p>
          <div className="rows">
            <div className="row">
              <span className="k">{t("rep_r1")}</span>
              <span className="val">9.75%</span>
            </div>
            <div className="row">
              <span className="k">{t("rep_r2")}</span>
              <span className="val">24.38%</span>
            </div>
            <div className="row">
              <span className="k">{t("rep_r3")}</span>
              <span className="val">2.0×</span>
            </div>
            <div className="row">
              <span className="k">{t("rep_r4")}</span>
              <span className="val">
                47.45 {t("days")}
              </span>
            </div>
          </div>
          <span className="stamp">{t("rep_stamp")}</span>
        </Reveal>
        <Reveal className="sec-head">
          <p className="eyebrow">{t("del_eye")}</p>
          <h2>{t("del_h2")}</h2>
          <p className="lead">{t("del_lead")}</p>
          <div style={{ marginTop: 24 }}>
            <Link className="btn btn-primary" href="/pro">
              {t("del_cta")}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
