import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { BottomNav } from "@/components/ui/BottomNav";
import { AppointmentsList } from "@/components/booking/AppointmentsList";
import { getMyAppointments } from "@/lib/appointments";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "My Appointments",
};

interface AppointmentsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AppointmentsPage({ params }: AppointmentsPageProps) {
  const { locale } = await params;
  const t = await getTranslations();

  const user = await getCurrentUserWithPermissions();

  if (!user) {
    return (
      <div className="min-h-screen bg-cream-50 flex flex-col pb-20">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-nude-100 px-4 py-3 flex items-center justify-between">
          <Logo size="sm" />
          <LanguageSwitcher />
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-4">
            <div className="text-4xl">📅</div>
            <h1 className="text-xl font-light text-charcoal-900">
              {t("appointments.title")}
            </h1>
            <p className="text-charcoal-500 text-sm">
              {t("appointments.sign_in_required")}
            </p>
            <Link href="/auth/signin" className="btn-primary">
              {t("nav.sign_in")}
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const { upcoming, past } = await getMyAppointments();

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col pb-20">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-nude-100 px-4 py-3 flex items-center justify-between">
        <Logo size="sm" />
        <LanguageSwitcher />
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6">
        <h1 className="text-2xl font-light text-charcoal-900 mb-6">
          {t("appointments.title")}
        </h1>

        <AppointmentsList
          upcoming={upcoming}
          past={past}
          locale={locale}
        />
      </main>

      <BottomNav />
    </div>
  );
}
