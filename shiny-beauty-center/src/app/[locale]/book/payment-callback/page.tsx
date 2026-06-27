/**
 * /book/payment-callback
 *
 * Tap redirects the user here after the payment form is completed.
 * Tap appends ?tap_id=<charge_id>&status=<status> to the URL.
 *
 * We show a pending/success/failure UI; the appointment is only confirmed
 * once the webhook fires. We do a lightweight status check to show the user
 * the right screen.
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";
import { BottomNav } from "@/components/ui/BottomNav";
import { Link } from "@/i18n/navigation";
import { featureFlags } from "@/lib/config";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Payment Status",
};

interface PaymentCallbackPageProps {
  searchParams: Promise<{
    tap_id?: string;
    status?: string;
    token?: string;
    appointmentId?: string;
  }>;
}

export default async function PaymentCallbackPage({
  searchParams,
}: PaymentCallbackPageProps) {
  const sp = await searchParams;
  const t = await getTranslations();

  // If payments are off, nothing should land here — redirect to confirmation
  if (!featureFlags.paymentsEnabled) {
    redirect("/book/confirmation");
  }

  const tapStatus = (sp.status ?? "").toUpperCase();
  const isSuccess = tapStatus === "CAPTURED" || tapStatus === "AUTHORIZED";
  const isFailed = tapStatus === "FAILED" || tapStatus === "CANCELLED";
  const token = sp.token ?? null;

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col pb-20">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-nude-100 px-4 py-3 flex items-center">
        <Logo size="sm" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        {isSuccess ? (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-100 to-nude-100 flex items-center justify-center mb-6 shadow-sm">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <circle cx="18" cy="18" r="17" fill="#fecdd3" />
                <path d="M11 18l5 5 9-9" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-3xl font-light text-charcoal-900 mb-3">
              {t("payment.success_title")}
            </h1>
            <p className="text-charcoal-500 mb-8">{t("payment.success_body")}</p>
          </>
        ) : isFailed ? (
          <>
            <div className="w-20 h-20 rounded-full bg-nude-100 flex items-center justify-center mb-6 shadow-sm">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <circle cx="18" cy="18" r="17" fill="#f2d9d0" />
                <path d="M13 13l10 10M23 13l-10 10" stroke="#d99f8b" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-3xl font-light text-charcoal-900 mb-3">
              {t("payment.failed_title")}
            </h1>
            <p className="text-charcoal-500 mb-8">{t("payment.failed_body")}</p>
          </>
        ) : (
          <>
            {/* Pending / unknown — webhook will confirm */}
            <div className="w-20 h-20 rounded-full bg-nude-100 flex items-center justify-center mb-6 shadow-sm">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <circle cx="18" cy="18" r="17" fill="#fdeee0" />
                <circle cx="18" cy="18" r="5" fill="#fda4af" />
              </svg>
            </div>
            <h1 className="text-3xl font-light text-charcoal-900 mb-3">
              {t("payment.processing_title")}
            </h1>
            <p className="text-charcoal-500 mb-8">{t("payment.processing_body")}</p>
          </>
        )}

        {token && (
          <div className="card mb-8 w-full max-w-xs">
            <p className="text-xs text-charcoal-400 mb-1">{t("confirmation.ref_label")}</p>
            <p className="text-xl font-mono font-semibold text-rose-600 tracking-widest uppercase">
              {token}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {isFailed ? (
            <>
              <Link href="/book" className="btn-primary w-full">
                {t("payment.retry_button")}
              </Link>
              <Link href="/appointments" className="btn-secondary w-full">
                {t("confirmation.view_appointments")}
              </Link>
            </>
          ) : (
            <>
              <Link href="/appointments" className="btn-primary w-full">
                {t("confirmation.view_appointments")}
              </Link>
              <Link href="/services" className="btn-secondary w-full">
                {t("confirmation.book_another")}
              </Link>
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
