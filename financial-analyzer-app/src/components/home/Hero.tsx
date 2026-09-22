"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { CountUp } from "@/components/ui/CountUp";
import { Reveal } from "@/components/ui/Reveal";

export function Hero() {
  const { t } = useLanguage();
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <Reveal>
          <p className="eyebrow">{t("hero_eyebrow")}</p>
          <h1>
            {t("hero_h1a")} <span className="accent">{t("hero_h1b")}</span>
          </h1>
          <p className="hero-sub">{t("hero_sub")}</p>
          <div className="hero-cta">
            <Link className="btn btn-primary" href="/pro">
              {t("hero_cta1")}
            </Link>
            <a className="btn btn-ghost" href="#how">
              {t("hero_cta2")}
            </a>
          </div>
          <div>
            <span className="free-pill">
              <span className="dot" />
              <span>{t("hero_free")}</span>
            </span>
          </div>
          <p className="hero-trust">
            <b>20+</b> {t("hero_trust")}
          </p>
        </Reveal>

        <div className="chart-card">
          <div className="chart-head">
            <span className="t">{t("chart_title")}</span>
            <span className="v">{t("chart_tag")}</span>
          </div>
          <svg className="chart-svg" viewBox="0 0 520 300" role="img" aria-label="Upward financial trend">
            <line className="grid-line" x1="30" y1="70" x2="500" y2="70" />
            <line className="grid-line" x1="30" y1="130" x2="500" y2="130" />
            <line className="grid-line" x1="30" y1="190" x2="500" y2="190" />
            <line className="grid-line" x1="30" y1="250" x2="500" y2="250" />
            <path
              className="area-fill"
              d="M30,250 L95,262 L160,225 L225,238 L290,180 L355,196 L420,120 L485,70 L485,280 L30,280 Z"
            />
            <path
              className="chart-line"
              pathLength={1}
              d="M30,250 L95,262 L160,225 L225,238 L290,180 L355,196 L420,120 L485,70"
            />
            <circle className="end-dot" cx="485" cy="70" r="5.5" />
          </svg>
          <div className="kpi k1">
            <div className="l">{t("kpi_nm")}</div>
            <div className="n">
              <CountUp target={9.75} decimals={2} />%
            </div>
          </div>
          <div className="kpi k2">
            <div className="l">{t("kpi_roe")}</div>
            <div className="n">
              <CountUp target={24.38} decimals={2} />%
            </div>
          </div>
          <div className="kpi k3">
            <div className="l">{t("kpi_cur")}</div>
            <div className="n">
              <CountUp target={2.0} decimals={1} />×
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
