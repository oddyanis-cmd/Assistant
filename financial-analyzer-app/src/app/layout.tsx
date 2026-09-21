import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans_Arabic,
  Inter,
  Newsreader,
  Noto_Kufi_Arabic,
} from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { PaletteDock } from "@/components/layout/PaletteDock";
import { AskKeel } from "@/components/layout/AskKeel";
import { TncModal } from "@/components/layout/TncModal";

// Keel's exact font stack (see keel-landing/index.html's Google Fonts link):
// Newsreader (display), Inter (body), IBM Plex Mono (mono), with IBM Plex
// Sans Arabic + Noto Kufi Arabic as the RTL fallbacks. Self-hosted via
// next/font so there's no runtime request to Google Fonts.
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
  display: "swap",
});
const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  weight: ["500", "600", "700"],
  variable: "--font-noto-kufi-arabic",
  display: "swap",
});

const FONT_VARS = [
  newsreader.variable,
  inter.variable,
  ibmPlexMono.variable,
  ibmPlexSansArabic.variable,
  notoKufiArabic.variable,
].join(" ");

// Keel "sail" mark, inlined as a data-URI favicon — verbatim from keel-landing/index.html.
const FAVICON_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'%3E%3Crect width='44' height='44' rx='12' fill='%230e0d0c'/%3E%3Cpath d='M13 31 C14 21 19 14 30 11 C27.5 18 24.5 25 22 31 Z' fill='%23e28a4d'/%3E%3Ccircle cx='30' cy='11' r='2' fill='%23f2ad76'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "Keel — AI Financial Analysis",
  description:
    "AI financial analysis you can trust. A tested engine computes every ratio, margin and valuation; Keel writes the analyst-grade report. No guessed numbers.",
  icons: { icon: FAVICON_DATA_URI },
  openGraph: {
    type: "website",
    title: "Keel — AI Financial Analysis",
    description:
      "Verified-math financial analysis with an analyst-grade report and live dashboard. Trilingual EN / FR / AR.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e0d0c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={FONT_VARS} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        {/* Applies a persisted language/palette choice before hydration, so
            returning visitors don't see a flash of English/LTR or the
            default amber accent before React takes over. Mirrors
            LanguageProvider/ThemeProvider's own logic; wrapped in try/catch
            exactly like they are, so a blocked localStorage never breaks
            rendering. `suppressHydrationWarning` on <html> is required
            because this deliberately runs before React hydrates. */}
        <Script id="keel-theme-init" strategy="beforeInteractive">
          {`(function(){try{
            var l=localStorage.getItem('keel_lang');
            if(l==='fr'||l==='ar'){
              document.documentElement.lang=l;
              document.documentElement.dir=l==='ar'?'rtl':'ltr';
            }
            var p=localStorage.getItem('keel_pal');
            if(p==='custom'){
              var h=localStorage.getItem('keel_custom');
              if(h) document.documentElement.style.setProperty('--accent',h);
            } else if(p && p!=='orange'){
              document.documentElement.setAttribute('data-palette',p);
            }
          }catch(e){}})();`}
        </Script>
        <AppProviders>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
          <PaletteDock />
          <TncModal />
          <AskKeel />
        </AppProviders>
      </body>
    </html>
  );
}
