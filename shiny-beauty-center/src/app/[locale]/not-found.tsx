/**
 * Locale-scoped 404 page.
 *
 * Rendered inside [locale]/layout.tsx so it inherits the NextIntl provider,
 * RTL direction, and global CSS. Shows a bilingual-friendly 404 screen
 * using the brand design system.
 */
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/Logo";

export default function LocaleNotFound() {
  const t = useTranslations("errors");

  return (
    <div className="min-h-screen bg-brand-gradient flex flex-col items-center justify-center px-4">
      {/* Brand header */}
      <div className="mb-10">
        <Logo />
      </div>

      {/* Card */}
      <div className="card max-w-md w-full text-center shadow-md">
        {/* Decorative numeral */}
        <div className="text-6xl font-light text-rose-300 mb-2 select-none" aria-hidden="true">
          404
        </div>

        <div className="w-12 h-px bg-rose-200 mx-auto mb-6" />

        <h1 className="text-xl font-semibold text-charcoal-800 mb-2">
          {t("not_found")}
        </h1>

        <p className="text-sm text-charcoal-500 mb-8 leading-relaxed">
          {t("not_found_body")}
        </p>

        <Link href="/" className="btn-primary">
          {t("back_home")}
        </Link>
      </div>

      {/* Footer */}
      <p className="mt-10 text-xs text-charcoal-400">
        &copy; {new Date().getFullYear()} Shiny Beauty Center
      </p>
    </div>
  );
}
