// Defaults for every admin-editable setting. Stored values are merged over these, so new keys
// added in code appear automatically without a migration.
module.exports = {
  brand: {
    name: 'YAOUA',
    tagline: 'Crochet & Gifts · Handmade in Qatar',
    logoUrl: '/img/yaoua-badge.webp',
    faviconUrl: '/img/yaoua-favicon.png',
    // YAOUA badge palette: raspberry yarn, rose, blush fabric, gold hook.
    colors: {
      ivory: '#FFF8F5',
      beige: '#F7DFD8',
      rose: '#EFB3BF',
      sage: '#C9963A',
      brown: '#8E1730',
      white: '#FFFFFF',
    },
    fonts: {
      heading: 'Fraunces',
      body: 'Nunito Sans',
    },
  },
  hero: {
    headline: 'Tiny treasures, crocheted by hand',
    subheading: 'Crocheted rompers, ponchos and cuddly friends, made stitch by stitch in Qatar and wrapped as a gift.',
    imageUrl: '/img/products/1.webp',
    imageAlt: 'A baby in the buttercup crochet romper next to a crocheted duckling',
    primaryCta: { label: 'Shop the collection', href: '/shop' },
    secondaryCta: { label: 'Find a gift', href: '/shop?category=gift-boxes' },
  },
  home: {
    bestSellersTitle: 'Best Sellers',
    newArrivalsTitle: 'New Arrivals',
    newArrivalsCount: 8,
    storyTitle: 'Made stitch by stitch in Qatar',
    storyBody:
      'YAOUA is a small crochet studio in Qatar. Every romper, poncho and soft friend is made by hand ' +
      'from baby-safe yarn, checked stitch by stitch, and wrapped as a gift with a handwritten card.',
    storyImageUrl: '/img/products/18.webp',
    showReviews: true,
    newsletterTitle: 'Join our little circle',
    newsletterBody: 'New collections, restocks and gentle care tips — no more than twice a month.',
  },
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop' },
    { label: 'Baby Clothes', href: '/shop?category=baby-clothes' },
    { label: 'Handmade Dolls', href: '/shop?category=handmade-dolls' },
    { label: 'Gift Boxes', href: '/shop?category=gift-boxes' },
    { label: 'Accessories', href: '/shop?category=baby-accessories' },
    { label: 'Our Story', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  footer: {
    about: 'Handmade crochet baby clothes, dolls and gifts, made in small batches in Qatar and wrapped with love.',
    email: 'info@yaoua.qa',
    phone: '+974 7735 3521',
    whatsapp: '+974 7735 3521',
    address: 'Online business, State of Qatar',
    social: { instagram: '', facebook: '', tiktok: '', pinterest: '' },
    // Shown on every page, as MoCI requires for licensed online shops.
    legalName: 'Yaoua for Craft Work Trading',
    legalNameAr: 'ياوا للتجارة في الأعمال الحرفية',
    cr: '258148',
    ecommerceLicence: '',
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
