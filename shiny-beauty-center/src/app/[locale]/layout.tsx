import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ServiceWorkerRegistrar } from "@/components/ui/ServiceWorkerRegistrar";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Shiny Beauty Center",
    template: "%s | Shiny Beauty Center",
  },
  description: "Luxury Beauty, Exclusively for Women — Book your appointment at Shiny Beauty Center.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#fda4af",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as "en" | "ar")) {
    notFound();
  }

  const messages = await getMessages();
  const isRtl = locale === "ar";

  return (
    <html
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
      className={isRtl ? "font-arabic" : ""}
    >
      <body className="antialiased bg-cream-50 text-charcoal-900 min-h-screen">
        <NextIntlClientProvider messages={messages}>
          <ServiceWorkerRegistrar />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
