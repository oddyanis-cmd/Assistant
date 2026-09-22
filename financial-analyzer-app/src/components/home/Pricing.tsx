"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Reveal } from "@/components/ui/Reveal";
import type { DictKey } from "@/lib/i18n/types";

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Tier {
  id: string;
  extraClass: string;
  tag?: DictKey;
  name: DictKey;
  price: string;
  perMonth: boolean;
  cap: DictKey;
  features: DictKey[];
  cta: DictKey;
  ctaVariant: "primary" | "ghost";
}

const TIERS: Tier[] = [
  {
    id: "free",
    extraClass: "free",
    tag: "free_tag",
    name: "free_name",
    price: "$0",
    perMonth: false,
    cap: "free_cap",
    features: ["free_f1", "free_f2", "free_f3"],
    cta: "free_cta",
    ctaVariant: "primary",
  },
  {
    id: "basic",
    extraClass: "",
    name: "basic_name",
    price: "$5",
    perMonth: true,
    cap: "basic_cap",
    features: ["basic_f1", "basic_f2", "basic_f3"],
    cta: "basic_cta",
    ctaVariant: "ghost",
  },
  {
    id: "pro",
    extraClass: "pop",
    tag: "pro_badge",
    name: "pro_name",
    price: "$15",
    perMonth: true,
    cap: "pro_cap",
    features: ["pro_f1", "pro_f2", "pro_f3"],
    cta: "pro_cta",
    ctaVariant: "primary",
  },
  {
    id: "unlimited",
    extraClass: "",
    name: "unl_name",
    price: "$40",
    perMonth: true,
    cap: "unl_cap",
    features: ["unl_f1", "unl_f2", "unl_f3"],
    cta: "unl_cta",
    ctaVariant: "ghost",
  },
];

export function Pricing() {
  const { t } = useLanguage();
  return (
    <section className="band" id="pricing">
      <div className="wrap">
        <Reveal className="sec-head" style={{ maxWidth: "none", textAlign: "center", marginInline: "auto" }}>
          <p className="eyebrow">{t("price_eye")}</p>
          <h2>{t("price_h2")}</h2>
          <p className="lead" style={{ marginInline: "auto", maxWidth: "56ch" }}>
            {t("price_lead")}
          </p>
          <p style={{ textAlign: "center", marginTop: 14 }}>
            <button type="button" className="tnc-link">
              {t("price_terms")}
            </button>
          </p>
        </Reveal>
        <div className="price-grid">
          {TIERS.map((tier) => (
            <Reveal as="div" className={`tier ${tier.extraClass}`.trim()} key={tier.id}>
              {tier.tag && <span className="tag">{t(tier.tag)}</span>}
              <div className="tname">{t(tier.name)}</div>
              <div className="price">
                <span className="amt">{tier.price}</span>
                {tier.perMonth && <span className="per">{t("per")}</span>}
              </div>
              <div className="cap-line">{t(tier.cap)}</div>
              <ul>
                {tier.features.map((f) => (
                  <li key={f}>
                    <CheckIcon />
                    <span>{t(f)}</span>
                  </li>
                ))}
              </ul>
              <Link
                className={`btn btn-${tier.ctaVariant}`}
                href="/pro"
              >
                {t(tier.cta)}
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
