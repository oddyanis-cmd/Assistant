// Defaults for every admin-editable setting. Stored values are merged over these, so new keys
// added in code appear automatically without a migration.
module.exports = {
  brand: {
    name: 'Little Stitches',
    tagline: 'Handmade with love in Qatar',
    logoUrl: '',
    faviconUrl: '',
    colors: {
      ivory: '#FAF7F2',
      beige: '#EDE2D4',
      rose: '#D8B4AF',
      sage: '#A8B8A0',
      brown: '#745A4A',
      white: '#FFFFFF',
    },
    fonts: {
      heading: 'Cormorant Garamond',
      body: 'Nunito Sans',
    },
  },
  hero: {
    headline: 'Little Treasures, Handmade with Love',
    subheading: 'Beautifully crafted knitted clothes and adorable handmade dolls for your little ones.',
    imageUrl: '/img/hero.svg',
    imageAlt: 'Soft knitted baby cardigan and a handmade crochet doll',
    primaryCta: { label: 'Shop Collection', href: '/shop' },
    secondaryCta: { label: 'Discover Our Story', href: '/about' },
  },
  home: {
    bestSellersTitle: 'Best Sellers',
    newArrivalsTitle: 'New Arrivals',
    newArrivalsCount: 8,
    storyTitle: 'Our Handmade Story',
    storyBody:
      'Every piece begins as a skein of soft, baby-safe yarn and is knitted or crocheted stitch by stitch. ' +
      'We choose gentle natural fibres, check every seam by hand, and wrap each order as a gift — ' +
      'because the first clothes and toys a baby touches should be made with care.',
    storyImageUrl: '/img/story.svg',
    showReviews: true,
    newsletterTitle: 'Join our little circle',
    newsletterBody: 'New collections, restocks and gentle care tips — no more than twice a month.',
  },
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop' },
    { label: 'Baby Clothes', href: '/shop?category=baby-clothes' },
    { label: 'Handmade Dolls', href: '/shop?category=handmade-dolls' },
    { label: 'Gift Sets', href: '/shop?category=gift-boxes' },
    { label: 'About Us', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  footer: {
    about: 'Handmade knitted and crocheted baby clothes, booties and dolls, made in small batches in Doha.',
    email: 'hello@example.com',
    phone: '+974 0000 0000',
    whatsapp: '',
    address: 'Doha, Qatar',
    social: { instagram: 'https://instagram.com/', facebook: '', tiktok: '', pinterest: '' },
    securePaymentText: 'Payments are processed securely by our payment partners. We never store your card details.',
  },
  shipping: {
    countries: ['QA'],
    flatFee: 2500, // minor units (25.00 QAR)
    freeOver: 30000, // free shipping from 300.00 QAR; 0 disables
  },
  commerce: {
    currency: 'QAR',
    locale: 'en-QA',
    pendingOrderTtlMinutes: 60,
  },
  media: {
    maxFileSizeMb: 8,
    storageQuotaMb: 2048,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    galleryPageSize: 24,
  },
  newsletter: {
    enabled: true,
    consentText: 'I agree to receive emails about new collections and offers. I can unsubscribe at any time.',
  },
};
