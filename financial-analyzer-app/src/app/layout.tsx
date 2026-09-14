import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financial Analyzer — AI-powered financial analysis you can trust",
  description:
    "Verified financial ratios and statements from a tested calculation engine, narrated by AI. The math is verified; the insights are written by AI.",
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/training", label: "Training" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-navy text-offwhite">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-navy/95 backdrop-blur supports-[backdrop-filter]:bg-navy/80">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
            <Link
              href="/"
              className="font-serif text-lg font-semibold tracking-wide text-offwhite"
            >
              Financial<span className="text-gold">Analyzer</span>
            </Link>
            <div className="flex flex-wrap items-center gap-4 text-sm font-medium sm:gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-offwhite/80 transition hover:text-gold"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/pro"
                className="rounded-md border border-gold px-3 py-1.5 text-gold transition hover:bg-gold hover:text-navy"
              >
                Pro
              </Link>
            </div>
          </nav>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-white/10 py-6">
          <p className="mx-auto max-w-6xl px-4 text-center text-xs text-offwhite/50 sm:px-6">
            © {new Date().getFullYear()} Financial Analyzer — verified math, AI-written insight.
          </p>
        </footer>
      </body>
    </html>
  );
}
