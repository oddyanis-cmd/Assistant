"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { BrandMark } from "./BrandMark";
import { LanguageSwitch } from "./LanguageSwitch";

const NAV_LINKS = [
  { href: "/#how", key: "nav_how" },
  { href: "/#capabilities", key: "nav_caps" },
  { href: "/#pricing", key: "nav_pricing" },
  { href: "/training", key: "nav_training" },
  { href: "/#about", key: "nav_about" },
  { href: "/#contact", key: "nav_contact" },
] as const;

export function Nav() {
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="wrap nav-in">
        <Link className="brand" href="/" aria-label="Keel">
          <BrandMark />
          <span style={{ letterSpacing: ".02em" }}>Keel</span>
        </Link>
        <div className="nav-right">
          <nav className="nav-links">
            {NAV_LINKS.map((link) => (
              <Link key={link.key} href={link.href}>
                {t(link.key)}
              </Link>
            ))}
          </nav>
          <LanguageSwitch />
          <Link className="btn btn-primary nav-cta" href="/pro">
            {t("nav_cta")}
          </Link>
        </div>
      </div>
    </header>
  );
}
