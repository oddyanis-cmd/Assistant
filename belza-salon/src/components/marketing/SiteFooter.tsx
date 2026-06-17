import Link from 'next/link';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#2c2220] text-white/70 py-12 px-4 sm:px-6" role="contentinfo">
      <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2 sm:col-span-1">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-white mb-3" aria-label="Belza Salon home">
            <span className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white font-display font-bold" aria-hidden="true">B</span>
            Belza
          </Link>
          <p className="text-sm leading-relaxed">Premium hair and beauty studio in New York.</p>
        </div>

        <nav aria-label="Services links">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Services</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/services" className="hover:text-white transition-colors">Hair Colour</Link></li>
            <li><Link href="/services" className="hover:text-white transition-colors">Cuts &amp; Styling</Link></li>
            <li><Link href="/services" className="hover:text-white transition-colors">Treatments</Link></li>
          </ul>
        </nav>

        <nav aria-label="Salon links">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Salon</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/#about"  className="hover:text-white transition-colors">About Us</Link></li>
            <li><Link href="/#team"   className="hover:text-white transition-colors">Our Team</Link></li>
            <li><Link href="/book"    className="hover:text-white transition-colors">Book Online</Link></li>
          </ul>
        </nav>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Hours</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2"><dt>Mon–Fri</dt><dd>9am – 6pm</dd></div>
            <div className="flex gap-2"><dt>Saturday</dt><dd>9am – 5pm</dd></div>
            <div className="flex gap-2"><dt>Sunday</dt><dd className="text-white/40">Closed</dd></div>
          </dl>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3">
        <p className="text-xs text-white/40">&copy; {year} Belza Salon. All rights reserved.</p>
        <div className="flex gap-4 text-xs">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/terms"   className="hover:text-white transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
