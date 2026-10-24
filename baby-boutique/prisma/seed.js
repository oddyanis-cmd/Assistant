// Seeds an administrator, categories, a size guide, CMS pages and sample products.
// Safe to re-run: uses upserts and skips products that already exist.
require('dotenv').config();
const sharp = require('sharp');
const prisma = require('../src/lib/prisma');
const { hashPassword } = require('../src/modules/auth/password');
const media = require('../src/modules/media/service');

const SIZES = ['Newborn', '0–3 months', '3–6 months', '6–9 months', '9–12 months', '12–18 months', '18–24 months', '2–3 years'];

const categories = [
  { name: 'Baby Clothes', slug: 'baby-clothes', showOnHome: true, sortOrder: 1, description: 'Knitted cardigans, crochet dresses, rompers and sets.' },
  { name: 'Baby Shoes', slug: 'baby-shoes', showOnHome: true, sortOrder: 2, description: 'Soft booties and first shoes.' },
  { name: 'Handmade Dolls', slug: 'handmade-dolls', showOnHome: true, sortOrder: 3, description: 'Crochet dolls and plush friends.' },
  { name: 'Gift Boxes', slug: 'gift-boxes', showOnHome: true, sortOrder: 4, description: 'Ready-to-give sets, beautifully wrapped.' },
  { name: 'New Arrivals', slug: 'new-arrivals', showOnHome: true, sortOrder: 5, description: 'Fresh off the needles.' },
  { name: 'Personalized Gifts', slug: 'personalized-gifts', showOnHome: true, sortOrder: 6, description: 'Embroidered names and made-to-order pieces.' },
  { name: 'Hats & Bonnets', slug: 'hats-bonnets', sortOrder: 7, parent: 'baby-clothes' },
];

const pages = [
  ['about', 'Our Story', 'We are a small studio in Doha making knitted and crocheted pieces for babies.\n\nEvery item is made by hand, in small batches, from soft, baby-safe yarns. We check each seam, wash-test our fibres and wrap every order as a gift.'],
  ['contact', 'Contact Us', 'We would love to hear from you.\n\nEmail: hello@example.com\nWhatsApp: +974 0000 0000\n\nWe reply within one working day.'],
  ['shipping-policy', 'Shipping Policy', 'We currently deliver across Qatar.\n\nReady-made items are dispatched within the time shown on each product. Made-to-order and personalised pieces take longer — the estimate is shown before you buy.\n\nDelivery fee and free-delivery threshold are shown in your cart.'],
  ['return-policy', 'Return Policy', 'Unworn, unwashed items in original packaging may be returned within 14 days of delivery.\n\nPersonalised and made-to-order items cannot be returned unless faulty.'],
  ['privacy-policy', 'Privacy Policy', 'We collect only the information needed to process your order and, if you opt in, to send our newsletter. Card details are handled by our payment providers and never stored on our servers.\n\n(Replace this text with your full privacy policy reviewed against Qatar Law No. 13 of 2016 on Personal Data Privacy Protection.)'],
  ['terms', 'Terms & Conditions', 'Replace with your terms and conditions.'],
  ['faq', 'Frequently Asked Questions', 'Which size should I choose?\nUse the Size Guide on each product page. Measurements are in centimetres. If your baby is between sizes, choose the larger one.\n\nHow do I wash knitted items?\nHand wash cold with gentle detergent, dry flat in shade.\n\nAre your dolls safe for newborns?\nOur dolls use safety eyes or embroidered eyes and are recommended for the age shown on the product.'],
];

// Soft illustrative placeholder photo (replace with real photography in the admin).
function placeholderSvg(label, bg, fg) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  <defs><pattern id="k" width="60" height="60" patternUnits="userSpaceOnUse">
    <path d="M0 30 Q15 0 30 30 T60 30" fill="none" stroke="${fg}" stroke-opacity="0.18" stroke-width="6"/></pattern></defs>
  <rect width="1200" height="1500" fill="${bg}"/><rect width="1200" height="1500" fill="url(#k)"/>
  <circle cx="600" cy="680" r="300" fill="#FFFFFF" fill-opacity="0.55"/>
  <text x="600" y="700" font-family="Georgia, serif" font-size="64" text-anchor="middle" fill="#745A4A">${label}</text>
  <text x="600" y="780" font-family="Georgia, serif" font-size="34" text-anchor="middle" fill="#745A4A" fill-opacity="0.7">handmade with love</text>
</svg>`);
}

const products = [
  { name: 'Cloud Cable-Knit Cardigan', cat: 'baby-clothes', type: 'CLOTHING', price: 185, featured: true, sizes: SIZES.slice(0, 5), colors: [['Ivory', '#F5EFE6'], ['Dusty Rose', '#D8B4AF']], materials: '100% merino wool, extra-fine 19.5 micron', age: '0–12 months', tags: ['cardigan', 'merino'], colorBg: '#EDE2D4', personal: true },
  { name: 'Rosebud Crochet Dress', cat: 'baby-clothes', type: 'CLOTHING', price: 220, featured: true, sizes: SIZES.slice(1, 6), colors: [['Blush', '#E8C9C3'], ['Sage', '#A8B8A0']], materials: 'Organic cotton', age: '3–18 months', tags: ['dress', 'crochet'], colorBg: '#F3DCD7' },
  { name: 'Little Acorn Romper', cat: 'baby-clothes', type: 'CLOTHING', price: 165, sizes: SIZES.slice(0, 4), colors: [['Oat', '#E6D8C3']], materials: 'Cotton–bamboo blend', age: '0–9 months', tags: ['romper'], colorBg: '#E6D8C3' },
  { name: 'Pebble Knit Sweater', cat: 'baby-clothes', type: 'CLOTHING', price: 175, sizes: SIZES.slice(3, 8), colors: [['Sage', '#A8B8A0'], ['Cocoa', '#8B6B5A']], materials: 'Merino & cashmere blend', age: '6 months – 3 years', tags: ['sweater'], colorBg: '#D9E0D3' },
  { name: 'Bunny Ear Bonnet', cat: 'hats-bonnets', type: 'ACCESSORY', price: 75, featured: true, sizes: SIZES.slice(0, 4), colors: [['Ivory', '#F5EFE6'], ['Blush', '#E8C9C3']], materials: 'Soft baby alpaca', age: '0–9 months', tags: ['hat', 'bonnet'], colorBg: '#F5EFE6' },
  { name: 'Moss Stitch Booties', cat: 'baby-shoes', type: 'SHOES', price: 85, featured: true, sizes: ['0–3 months', '3–6 months', '6–9 months'], colors: [['Ivory', '#F5EFE6'], ['Sage', '#A8B8A0'], ['Rose', '#D8B4AF']], materials: '100% cotton, non-slip suede sole', age: '0–9 months', tags: ['booties', 'shoes'], colorBg: '#E9EEE5' },
  { name: 'Mary-Jane Crochet Shoes', cat: 'baby-shoes', type: 'SHOES', price: 90, sizes: ['3–6 months', '6–9 months', '9–12 months'], colors: [['Blush', '#E8C9C3']], materials: 'Mercerised cotton', age: '3–12 months', tags: ['shoes'], colorBg: '#F3DCD7' },
  { name: 'Hazel the Bunny Doll', cat: 'handmade-dolls', type: 'DOLL', price: 160, featured: true, dims: 'Height 32 cm · width 12 cm', colors: [['Oat', '#E6D8C3']], materials: 'Cotton yarn, hypoallergenic polyester filling, embroidered eyes', age: 'Suitable from birth', tags: ['doll', 'bunny', 'plush'], colorBg: '#EDE2D4', personal: true },
  { name: 'Olive the Little Bear', cat: 'handmade-dolls', type: 'DOLL', price: 145, dims: 'Height 26 cm', colors: [['Cocoa', '#8B6B5A']], materials: 'Cotton yarn, embroidered features', age: 'Suitable from birth', tags: ['doll', 'bear', 'plush'], colorBg: '#E3D6C8' },
  { name: 'Lulu Crochet Doll with Dress', cat: 'handmade-dolls', type: 'DOLL', price: 195, dims: 'Height 35 cm', colors: [['Rose Dress', '#D8B4AF'], ['Sage Dress', '#A8B8A0']], materials: 'Cotton yarn, removable dress', age: '12 months +', tags: ['doll'], colorBg: '#F3DCD7', mto: true },
  { name: 'Welcome Baby Gift Box', cat: 'gift-boxes', type: 'GIFT_SET', price: 420, featured: true, colors: [['Neutral', '#EDE2D4'], ['Pink', '#E8C9C3']], materials: 'Cardigan, bonnet, booties and a mini bunny in a keepsake box', age: 'Newborn', tags: ['gift', 'newborn'], colorBg: '#EDE2D4', personal: true },
  { name: 'Name Embroidered Blanket', cat: 'personalized-gifts', type: 'ACCESSORY', price: 260, colors: [['Ivory', '#F5EFE6'], ['Sage', '#A8B8A0']], dims: '80 × 100 cm', materials: 'Merino wool', age: 'From birth', tags: ['blanket', 'personalised'], colorBg: '#E9EEE5', personal: true, mto: true },
];

async function main() {
  // Admin
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (email && process.env.ADMIN_PASSWORD) {
    await prisma.user.upsert({
      where: { email },
      create: { email, name: 'Store Owner', role: 'ADMIN', passwordHash: await hashPassword(process.env.ADMIN_PASSWORD) },
      update: { role: 'ADMIN' },
    });
    console.log(`Admin: ${email}`);
  } else {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set — no admin user created');
  }

  const catIds = {};
  for (const c of categories) {
    const { parent, ...data } = c;
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { ...data, parentId: parent ? catIds[parent] : null },
      update: {},
    });
    catIds[c.slug] = row.id;
  }

  for (const [slug, title, body] of pages) {
    await prisma.page.upsert({ where: { slug }, create: { slug, title, body }, update: {} });
  }

  const guide = (await prisma.sizeGuide.findFirst({ where: { name: 'Baby clothing (cm)' } })) ??
    (await prisma.sizeGuide.create({
      data: {
        name: 'Baby clothing (cm)',
        columns: ['Size', 'Baby height', 'Weight (kg)', 'Chest', 'Garment length'],
        rows: [
          ['Newborn', '50–56', '2.5–4', '38', '26'],
          ['0–3 months', '56–62', '4–6', '40', '28'],
          ['3–6 months', '62–68', '6–8', '43', '30'],
          ['6–9 months', '68–74', '8–9', '45', '32'],
          ['9–12 months', '74–80', '9–10', '47', '34'],
          ['12–18 months', '80–86', '10–11.5', '49', '36'],
          ['18–24 months', '86–92', '11.5–13', '51', '38'],
          ['2–3 years', '92–98', '13–15', '53', '40'],
        ],
        notes: 'Measurements are in centimetres and taken flat. Hand-knitted pieces may vary by ±1 cm. Between sizes? Choose the larger one.',
      },
    }));

  let i = 0;
  for (const p of products) {
    i++;
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
    if (await prisma.product.findUnique({ where: { slug } })) continue;
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug,
        type: p.type,
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - i * 3 * 864e5),
        basePrice: p.price * 100,
        categoryId: catIds[p.cat],
        sizeGuideId: p.sizes ? guide.id : null,
        shortDescription: `A soft, ${p.type === 'DOLL' ? 'cuddly' : 'heirloom-quality'} piece, made by hand in Doha.`,
        description:
          `${p.name} is knitted stitch by stitch from carefully chosen, baby-friendly yarn.\n\n` +
          'Each piece is checked by hand, washed-tested and gift-wrapped in tissue with a handwritten card.',
        materials: p.materials,
        careInstructions: 'Hand wash cold with gentle wool detergent. Do not wring. Dry flat in shade.',
        ageRange: p.age,
        dimensionsCm: p.dims ?? null,
        dispatchMinDays: p.mto ? 7 : 2,
        dispatchMaxDays: p.mto ? 14 : 4,
        madeToOrder: Boolean(p.mto),
        isFeatured: Boolean(p.featured),
        isPersonalizable: Boolean(p.personal),
        personalizationLabel: p.personal ? 'Name to embroider (max 12 letters)' : null,
        tags: p.tags,
        salesCount: Math.floor(Math.random() * 40),
      },
    });
    const sizes = p.sizes ?? [null];
    let pos = 0;
    for (const s of sizes) {
      for (const [color, hex] of p.colors) {
        const sku = ['LS', String(i).padStart(3, '0'), s && s.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6), color.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4)].filter(Boolean).join('-');
        // Made-to-order: stock = how many the maker can take on right now.
        const stock = p.mto ? 5 : Math.floor(Math.random() * 7);
        const v = await prisma.productVariant.create({ data: { productId: product.id, sku, size: s, color, colorHex: hex, stock, position: pos++ } });
        if (stock) await prisma.inventoryMovement.create({ data: { variantId: v.id, delta: stock, reason: 'restock', note: 'Seed' } });
      }
    }
    for (const [n, [color, hex]] of p.colors.entries()) {
      const png = await sharp(placeholderSvg(p.name.split(' ').slice(0, 2).join(' '), n === 0 ? p.colorBg : hex, '#745A4A')).png().toBuffer();
      await media.addProductImage(product.id, { buffer: png }, { alt: `${p.name} in ${color}` });
    }
    console.log(`Product: ${p.name}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
