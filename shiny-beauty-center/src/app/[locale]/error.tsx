"use client";

/**
 * Locale-scoped error boundary (Next.js App Router).
 *
 * "use client" is required — Next.js error.tsx files must be Client Components
 * because they receive the `reset` callback from the React error boundary.
 *
 * Rendered inside [locale]/layout.tsx so it inherits RTL direction and global
 * CSS. Uses next-intl's useTranslations for bilingual support.
 *
 * The `reset` prop triggers a re-render of the segment; if the error was
 * transient (network hiccup, cold-start timeout) this is usually enough.
 */

import { useTranslations } from "next-intl";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LocaleError({ error, reset }: ErrorProps) {
  const t = useTranslations("errors");

  useEffect(() => {
    // Surface the error in the browser console for debugging during beta
    console.error("[LocaleError boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-brand-gradient flex flex-col items-center justify-center px-4">
      {/* Card */}
      <div className="card max-w-md w-full text-center shadow-md">
        {/* Decorative glyph */}
        <div className="text-4xl text-rose-300 mb-4 select-none" aria-hidden="true">
          ◈
        </div>

        <h1 className="text-xl font-semibold text-charcoal-800 mb-2">
          {t("error_title")}
        </h1>

        <p className="text-sm text-charcoal-500 mb-8 leading-relaxed">
          {t("error_body")}
        </p>

        {/* Retry button — triggers the React error boundary reset */}
        <button
          type="button"
          onClick={reset}
          className="btn-primary"
        >
          {t("error_retry")}
        </button>

        {/* Link back home — always available even if reset fails */}
        <div className="mt-4">
          <a href="/" className="text-sm text-rose-500 hover:text-rose-600 underline underline-offset-2">
            {t("back_home")}
          </a>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-10 text-xs text-charcoal-400">
        &copy; {new Date().getFullYear()} Shiny Beauty Center
      </p>
    </div>
  );
}
