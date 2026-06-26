import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";
import { BottomNav } from "@/components/ui/BottomNav";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Booking Confirmed",
};

interface ConfirmationPageProps {
  searchParams: Promise<{ token?: string; appointmentId?: string }>;
}

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const sp = await searchParams;
  const t = await getTranslations();

  const token = sp.token ?? null;

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col pb-20">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-nude-100 px-4 py-3 flex items-center">
        <Logo size="sm" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-100 to-nude-100 flex items-center justify-center mb-6 shadow-sm">
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="18" cy="18" r="17" fill="#fecdd3" />
            <path
              d="M11 18l5 5 9-9"
              stroke="#e11d48"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-light text-charcoal-900 mb-3">
          {t("confirmation.title")}
        </h1>
        <p className="text-charcoal-500 mb-8">{t("confirmation.subtitle")}</p>

        {/* Booking reference */}
        {token && (
          <div className="card mb-8 w-full max-w-xs">
            <p className="text-xs text-charcoal-400 mb-1">
              {t("confirmation.ref_label")}
            </p>
            <p className="text-xl font-mono font-semibold text-rose-600 tracking-widest uppercase">
              {token}
            </p>
          </div>
        )}

        {/* What's next */}
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 text-start w-full max-w-xs mb-8">
          <h2 className="font-semibold text-charcoal-800 mb-2">
            {t("confirmation.what_next")}
          </h2>
          <p className="text-sm text-charcoal-500 leading-relaxed">
            {t("confirmation.what_next_body")}
          </p>
        </div>

        {/* Pay at salon badge — payment flag is off */}
        <div className="flex items-center gap-2 text-xs text-charcoal-400 mb-8">
          <span className="w-5 h-5 rounded-full bg-nude-100 flex items-center justify-center text-[10px]">
            ✓
          </span>
          {t("confirmation.pay_at_salon")}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href="/appointments" className="btn-primary w-full">
            {t("confirmation.view_appointments")}
          </Link>
          <Link href="/services" className="btn-secondary w-full">
            {t("confirmation.book_another")}
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
