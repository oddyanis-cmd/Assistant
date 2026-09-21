"use client";

/**
 * Lightweight, client-only i18n context (no next-intl, no locale routing —
 * per the design brief). Ports keel-landing's `setLang`/`apply` logic:
 * dictionaries are looked up by key, missing FR/AR keys fall back to EN,
 * and the choice is persisted to localStorage (wrapped in try/catch so a
 * blocked/unavailable storage never breaks rendering).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ar, en, fr } from "@/lib/i18n/merged";
import { LOCALES, type DictKey, type Locale } from "@/lib/i18n/types";

const DICTS: Record<Locale, Record<string, string>> = { en, fr, ar };

const STORAGE_KEY = "keel_lang";

interface LanguageContextValue {
  lang: Locale;
  dir: "ltr" | "rtl";
  setLang: (lang: Locale) => void;
  /** Translate a dictionary key for the current language (falls back to EN). */
  t: (key: DictKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return !!value && (LOCALES as string[]).includes(value);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Server-rendered default is always "en" so hydration never mismatches;
  // the real (possibly persisted) language is applied after mount.
  const [lang, setLangState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored) && stored !== "en") setLangState(stored);
    } catch {
      // localStorage unavailable (private mode, blocked, etc.) — stay on "en".
    }
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  const setLang = useCallback((next: Locale) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — persistence is a nice-to-have, not a requirement.
    }
  }, []);

  const t = useCallback(
    (key: DictKey): string => {
      const dict = DICTS[lang];
      const value = dict[key];
      return value != null ? value : en[key];
    },
    [lang]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, t }),
    [lang, setLang, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
