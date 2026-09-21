"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import type { Locale } from "@/lib/i18n/types";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "fr", label: "FR" },
  { value: "ar", label: "ع" },
];

/** EN / FR / ع segmented control — sets <html lang>/dir via LanguageProvider. */
export function LanguageSwitch() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="seg" role="group" aria-label="Language">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={opt.value === lang ? "on" : undefined}
          onClick={() => setLang(opt.value)}
          aria-pressed={opt.value === lang}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
