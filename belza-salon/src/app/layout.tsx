import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
});

const playfair = Playfair_Display({
  subsets:   ['latin'],
  variable:  '--font-playfair',
  display:   'swap',
  style:     ['normal', 'italic'],
  weight:    ['600', '700'],
});

export const metadata: Metadata = {
  title: {
    default:  'Belza Salon — Where Beauty Meets Craft',
    template: '%s — Belza Salon',
  },
  description:
    'Premium hair and beauty studio. Expert colour, precision cuts, and transformative treatments. Book your appointment online.',
  keywords: ['hair salon', 'hair colour', 'balayage', 'keratin', 'haircut', 'beauty'],
  openGraph: {
    type:        'website',
    siteName:    'Belza Salon',
    title:       'Belza Salon — Where Beauty Meets Craft',
    description: 'Premium hair and beauty studio. Book your appointment online.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} antialiased scroll-smooth`}>
      <body className="font-sans bg-background text-text-primary">{children}</body>
    </html>
  );
}
