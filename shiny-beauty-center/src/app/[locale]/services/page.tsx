import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { BottomNav } from "@/components/ui/BottomNav";
import { ServicesCatalog } from "@/components/booking/ServicesCatalog";
import { getServiceCategories, getServices } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Services",
};

interface ServicesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ServicesPage({ params }: ServicesPageProps) {
  const { locale } = await params;
  const t = await getTranslations();

  const [categories, services] = await Promise.all([
    getServiceCategories(),
    getServices(),
  ]);

  const isAr = locale === "ar";

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-nude-100 px-4 py-3 flex items-center justify-between">
        <Logo size="sm" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
        </div>
      </header>

      {/* Hero strip */}
      <div className="bg-gradient-to-br from-rose-50 via-cream-50 to-blush-50 px-6 py-10 text-center">
        <h1 className="text-3xl font-light text-charcoal-900 mb-2">
          {t("services.title")}
        </h1>
        <p className="text-charcoal-500 text-sm">{t("services.subtitle")}</p>
      </div>

      {/* Catalog (client component handles filtering) */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6">
        <ServicesCatalog
          categories={categories}
          services={services}
          locale={locale}
          isAr={isAr}
        />
      </main>

      <BottomNav />
    </div>
  );
}
