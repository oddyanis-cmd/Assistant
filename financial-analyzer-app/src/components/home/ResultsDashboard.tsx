"use client";

import type { CSSProperties } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { CountUp } from "@/components/ui/CountUp";
import { Reveal } from "@/components/ui/Reveal";

const BARS = [
  { h: "50%", label: "Q1" },
  { h: "62%", label: "Q2" },
  { h: "57%", label: "Q3" },
  { h: "76%", label: "Q4" },
  { h: "88%", label: "Q5" },
  { h: "100%", label: "Q6" },
];

export function ResultsDashboard() {
  const { t } = useLanguage();
  return (
    <section className="band" id="dashboard">
      <div className="wrap">
        <Reveal className="sec-head" style={{ maxWidth: "none", textAlign: "center", marginInline: "auto" }}>
          <p className="eyebrow">{t("dash_eye")}</p>
          <h2>{t("dash_h2")}</h2>
          <p className="lead" style={{ marginInline: "auto", maxWidth: "58ch" }}>
            {t("dash_lead")}
          </p>
        </Reveal>

        {/* This element gets both "reveal io" (fade-in) and drives the
            `.dash.io` bar/donut CSS transitions once in view — one shared
            IntersectionObserver, exactly like keel-landing. */}
        <Reveal className="dash-wrap dash">
          <div className="dash-top">
            <div className="dash-tabs">
              <span className="on">{t("dash_t1")}</span>
              <span>{t("dash_t2")}</span>
              <span>{t("dash_t3")}</span>
            </div>
            <span className="dash-live">
              <span className="ld" />
              <span>{t("dash_live")}</span>
            </span>
          </div>
          <div className="dash-grid">
            <div className="d-tile">
              <div className="dl">{t("kpi_nm")}</div>
              <div className="dv">
                <CountUp target={9.75} decimals={2} />%
              </div>
              <div className="dsub">{t("dash_s1")}</div>
            </div>
            <div className="d-tile">
              <div className="dl">{t("kpi_roe")}</div>
              <div className="dv">
                <CountUp target={24.38} decimals={2} />%
              </div>
              <div className="dsub">{t("dash_s2")}</div>
            </div>
            <div className="d-tile">
              <div className="dl">{t("t_cur")}</div>
              <div className="dv">
                <CountUp target={2.0} decimals={1} />×
              </div>
              <div className="dsub">{t("dash_s3")}</div>
            </div>
            <div className="d-tile">
              <div className="dl">{t("rep_r4")}</div>
              <div className="dv">
                <CountUp target={47.45} decimals={2} />
              </div>
              <div className="dsub">{t("days")}</div>
            </div>
            <div className="d-tile span2">
              <div className="dl">{t("dash_rev")}</div>
              <div className="d-bars">
                {BARS.map((bar) => (
                  <div className="bcol" key={bar.label}>
                    <div className="bar" style={{ "--h": bar.h } as CSSProperties} />
                    <span className="bl">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="d-tile span2">
              <div className="dl">{t("dash_comp")}</div>
              <div className="d-donut">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle className="donut-ring" cx="60" cy="60" r="46" />
                  <circle
                    className="donut-val"
                    cx="60"
                    cy="60"
                    r="46"
                    style={{ "--c": 289, "--off": 173 } as CSSProperties}
                  />
                </svg>
                <div className="d-legend">
                  <div>
                    <i style={{ background: "var(--accent)" }} />
                    <span>{t("dash_gm")}</span> · <b style={{ color: "var(--pos)" }}>40%</b>
                  </div>
                  <div>
                    <i style={{ background: "var(--line)" }} />
                    <span>{t("dash_cogs")}</span> · <b>60%</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
