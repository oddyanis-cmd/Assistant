import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = {
  title: "Create Account",
};

export default function SignUpPage() {
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-brand-gradient flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <Logo size="sm" />
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="card shadow-lg">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-light text-charcoal-900 mb-1">
                {t("auth.sign_up_title")}
              </h1>
              <p className="text-sm text-charcoal-500">{t("auth.sign_up_subtitle")}</p>
            </div>

            <SignUpForm />

            <div className="mt-6 text-center">
              <p className="text-sm text-charcoal-500">
                {t("auth.have_account")}{" "}
                <Link href="/auth/signin" className="text-rose-500 hover:text-rose-600 font-medium">
                  {t("auth.sign_in_button")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
