import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { BottomNav } from "@/components/ui/BottomNav";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { getActiveStaff, getServiceById, getServices } from "@/lib/catalog";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Book Appointment",
};

interface BookPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ serviceId?: string }>;
}

export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations();

  const [user, staff, allServices, preselectedService] = await Promise.all([
    getCurrentUserWithPermissions(),
    getActiveStaff(),
    getServices(),
    sp.serviceId ? getServiceById(sp.serviceId) : Promise.resolve(null),
  ]);

  const isAr = locale === "ar";

  // Require auth — show a prompt rather than hard redirect so the user
  // can read the service info before signing in.
  if (!user) {
    return (
      <div className="min-h-screen bg-cream-50 flex flex-col pb-20">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-nude-100 px-4 py-3 flex items-center justify-between">
          <Logo size="sm" />
          <LanguageSwitcher />
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-sm w-full text-center space-y-5">
            <div className="text-5xl">🌸</div>
            <h1 className="text-2xl font-light text-charcoal-900">
              {t("booking.title")}
            </h1>
            <p className="text-charcoal-500 text-sm">
              {t("booking.sign_in_required")}
            </p>
            <Link
              href="/auth/signin"
              className="btn-primary w-full"
            >
              {t("booking.sign_in_button")}
            </Link>
            <Link href="/services" className="btn-ghost w-full">
              {t("nav.services")}
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col pb-20">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-nude-100 px-4 py-3 flex items-center justify-between">
        <Logo size="sm" />
        <LanguageSwitcher />
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-6">
        <h1 className="text-2xl font-light text-charcoal-900 mb-6">
          {t("booking.title")}
        </h1>
        <BookingWizard
          services={allServices}
          staff={staff}
          preselectedServiceId={preselectedService?.id ?? null}
          locale={locale}
          isAr={isAr}
        />
      </main>

      <BottomNav />
    </div>
  );
}
