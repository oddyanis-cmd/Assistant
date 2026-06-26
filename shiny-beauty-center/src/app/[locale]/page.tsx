import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { BottomNav } from "@/components/ui/BottomNav";

export default function HomePage() {
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-brand-gradient flex flex-col pb-16">
      {/* Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Logo />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/auth/signin" className="btn-ghost text-charcoal-600">
            {t("nav.sign_in")}
          </Link>
          <Link href="/auth/signup" className="btn-primary">
            {t("nav.sign_up")}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="max-w-3xl mx-auto">
          {/* Decorative element */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-px bg-rose-300" />
            <div className="mx-4 text-rose-400 text-xs font-light tracking-[0.3em] uppercase">
              Exclusively for Women
            </div>
            <div className="w-16 h-px bg-rose-300" />
          </div>

          <h1 className="text-5xl md:text-7xl font-light text-charcoal-900 mb-6 leading-tight">
            Shiny{" "}
            <span className="text-rose-500 italic font-normal">Beauty</span>
            <br />
            Center
          </h1>
          <p className="text-lg md:text-xl text-charcoal-500 mb-12 font-light leading-relaxed max-w-xl mx-auto">
            {t("app.tagline")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/services" className="btn-primary text-base px-8 py-4">
              {t("nav.services")}
            </Link>
            <Link href="/auth/signin" className="btn-secondary text-base px-8 py-4">
              {t("nav.sign_in")}
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full">
          {[
            {
              icon: "✦",
              title: "Expert Stylists",
              body: "Carefully selected beauty professionals dedicated to your perfection.",
            },
            {
              icon: "◈",
              title: "Easy Booking",
              body: "Reserve your appointment in seconds, anytime, anywhere.",
            },
            {
              icon: "◉",
              title: "Private & Safe",
              body: "A serene, women-only space where you can relax completely.",
            },
          ].map((card) => (
            <div key={card.title} className="card text-center hover:shadow-md transition-shadow">
              <div className="text-rose-400 text-2xl mb-3">{card.icon}</div>
              <h3 className="font-semibold text-charcoal-800 mb-2">{card.title}</h3>
              <p className="text-sm text-charcoal-500 leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-charcoal-400">
        <p>© {new Date().getFullYear()} Shiny Beauty Center. All rights reserved.</p>
        <p className="mt-1">{t("auth.privacy_note")}</p>
      </footer>

      <BottomNav />
    </div>
  );
}
