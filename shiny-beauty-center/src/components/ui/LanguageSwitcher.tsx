"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTransition } from "react";

export function LanguageSwitcher() {
  const t = useTranslations("app");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const targetLocale = locale === "en" ? "ar" : "en";

  function handleSwitch() {
    startTransition(() => {
      router.replace(pathname, { locale: targetLocale });
    });
  }

  return (
    <button
      onClick={handleSwitch}
      disabled={isPending}
      className="btn-ghost text-sm text-charcoal-600 min-w-[60px]"
      aria-label={`Switch to ${targetLocale === "ar" ? "Arabic" : "English"}`}
    >
      {isPending ? "…" : t("locale_toggle")}
    </button>
  );
}
