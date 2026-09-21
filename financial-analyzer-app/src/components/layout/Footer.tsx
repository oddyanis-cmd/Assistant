"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { BrandMark } from "./BrandMark";

const FOOT_LINKS = [
  { href: "/#how", key: "nav_how" },
  { href: "/#capabilities", key: "nav_caps" },
  { href: "/#pricing", key: "nav_pricing" },
  { href: "/training", key: "nav_training" },
  { href: "/#about", key: "nav_about" },
  { href: "/#contact", key: "nav_contact" },
] as const;

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer>
      <div className="wrap foot-in">
        <Link className="brand" href="/" style={{ fontSize: 17 }}>
          <BrandMark size={24} />
          <span style={{ letterSpacing: ".02em" }}>Keel</span>
        </Link>
        <div className="foot-links">
          {FOOT_LINKS.map((link) => (
            <Link key={link.key} href={link.href}>
              {t(link.key)}
            </Link>
          ))}
          {/* Delegated click, handled globally by <TncModal/>. */}
          <button type="button" className="tnc-link">
            {t("foot_terms")}
          </button>
        </div>
        <p className="foot-note">{t("foot_note")}</p>
      </div>
    </footer>
  );
}
