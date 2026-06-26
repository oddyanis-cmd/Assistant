import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Sign In",
};

interface SignInPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
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
                {t("auth.sign_in_title")}
              </h1>
              <p className="text-sm text-charcoal-500">{t("auth.sign_in_subtitle")}</p>
            </div>

            <SignInForm redirectTo={params.redirectTo} />

            <div className="mt-6 text-center">
              <p className="text-sm text-charcoal-500">
                {t("auth.no_account")}{" "}
                <Link href="/auth/signup" className="text-rose-500 hover:text-rose-600 font-medium">
                  {t("nav.sign_up")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
