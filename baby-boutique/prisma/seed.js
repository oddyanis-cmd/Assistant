// Seeds the YAOUA shop: owner account, categories, size guide, bilingual legal pages and the 13 real
// products with their photos (served from public/img/products). Runs on every Netlify build and is
// safe to re-run: it only creates what is missing and never overwrites anything the owner edited.
require('dotenv').config();
const crypto = require('node:crypto');
const prisma = require('../src/lib/prisma');
const { hashPassword } = require('../src/modules/auth/password');
const catalog = require('./yaoua/catalog.json');

const TYPE_BY_CAT = { 'baby-clothes': 'CLOTHING', 'handmade-dolls': 'DOLL', 'gift-boxes': 'GIFT_SET', 'baby-accessories': 'ACCESSORY' };
// Preview page keys -> shop URLs (the first seven already have short routes).
const PAGE_SLUGS = { shipping: 'shipping-policy', returns: 'return-policy', privacy: 'privacy-policy' };
// Text the very first version of the app seeded. Pages still holding it were never edited by the owner,
// so they are safe to replace with the YAOUA versions.
const LEGACY_MARKERS = ['hello@example.com', 'Replace with your terms', 'We are a small studio in Doha', 'Card details are handled by our payment providers', 'We currently deliver across Qatar.', 'Unworn, unwashed items in original packaging', 'Which size should I choose?\nUse the Size Guide'];

// Bump when the legal texts change: untouched pages from an older seed version are refreshed.
const SEED_VERSION = 2;
const MARKER = '<!-- yaoua-seed v';

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
// A seeded page is untouched when its text still matches the fingerprint written in its first line.
function untouchedSeed(body) {
  if (!body.startsWith(MARKER)) return false;
  const [first, ...rest] = body.split('\n');
  const fp = first.slice(MARKER.length).split(' ')[1];
  return fp === hash(rest.join('\n'));
}

const fillEn = (s) => s.replace(/\[([^\]]+)\]/g, 'to be added');
const fillAr = (s) => s.replace(/\[([^\]]+)\]/g, 'سيُضاف لاحقاً');
const sections = (list, fill) => list.map(([h, b]) => `## ${fill(h)}\n${fill(b)}`).join('\n\n');

function pageBody(p) {
  const text = sections(p.en, fillEn) + (p.ar?.length ? `\n\n===AR===\n\n${sections(p.ar, fillAr)}` : '');
  return `${MARKER}${SEED_VERSION} ${hash(text)} -->\n${text}`;
}

async function main() {
  // ---------- Owner account ----------
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  // Changing the owner's sign-in email: set ADMIN_EMAIL to the new address and ADMIN_PREVIOUS_EMAIL to
  // the old one. The same account (password, two-step sign-in, orders) is kept; old sessions are ended.
  const previous = (process.env.ADMIN_PREVIOUS_EMAIL || '').toLowerCase();
  if (email && previous && previous !== email) {
    const old = await prisma.user.findUnique({ where: { email: previous } });
    const taken = await prisma.user.findUnique({ where: { email } });
    if (old && !taken) {
      await prisma.user.update({ where: { id: old.id }, data: { email } });
      await prisma.session.deleteMany({ where: { userId: old.id } });
      console.log(`Admin sign-in email changed (${previous} -> ${email})`);
    }
  }
  if (email && process.env.ADMIN_PASSWORD && !(await prisma.user.findUnique({ where: { email } }))) {
    await prisma.user.create({ data: { email, name: 'Store Owner', role: 'ADMIN', passwordHash: await hashPassword(process.env.ADMIN_PASSWORD) } });
    console.log(`Admin created: ${email}`);
  } else if (!email) {
    console.warn('ADMIN_EMAIL not set: no admin user created');
  }

  // ---------- Categories ----------
  const catIds = {};
  const yaouaSlugs = catalog.categories.map((c) => c.slug);
  for (const [i, c] of catalog.categories.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, description: c.desc, imageUrl: `/img/products/${c.img}-m.webp`, sortOrder: i + 1, showOnHome: i < 4 },
      update: {},
    });
    catIds[c.slug] = row.id;
  }
  // Hide categories left over from the first sample data, if they are empty.
  const leftovers = await prisma.category.findMany({ where: { slug: { notIn: yaouaSlugs } }, include: { _count: { select: { products: true } } } });
  for (const c of leftovers) if (!c._count.products && c.isActive) await prisma.category.update({ where: { id: c.id }, data: { isActive: false, showOnHome: false } });

  // ---------- Size guide ----------
  const guide = (await prisma.sizeGuide.findFirst({ where: { name: 'YAOUA baby sizes (cm)' } })) ??
    (await prisma.sizeGuide.create({
      data: {
        name: 'YAOUA baby sizes (cm)',
        columns: catalog.sizeGuide.cols,
        rows: catalog.sizeGuide.rows,
        notes: 'Measurements are in centimetres, taken flat. Hand-crocheted pieces can vary by about 1 cm. Between sizes? Choose the larger one.',
      },
    }));

  // ---------- Legal & information pages (English + Arabic) ----------
  for (const [key, p] of Object.entries(catalog.pages)) {
    const slug = PAGE_SLUGS[key] ?? key;
    const body = pageBody(p);
    const existing = await prisma.page.findUnique({ where: { slug } });
    if (!existing) await prisma.page.create({ data: { slug, title: p.t, body } });
    else {
      // Replace only pages the owner has not edited: the very first sample text, or an older seed version.
      const untouched = LEGACY_MARKERS.some((m) => existing.body.includes(m)) || untouchedSeed(existing.body);
      if (untouched && existing.body !== body) await prisma.page.update({ where: { slug }, data: { title: p.t, body } });
    }
  }

  // ---------- Products ----------
  const imageRow = (n, alt, position) => ({
    provider: 'static', storageKey: `static/${n}`, url: `/img/products/${n}.webp`, mediumUrl: `/img/products/${n}-m.webp`,
    thumbUrl: `/img/products/${n}-t.webp`, width: 960, height: 960, bytes: 0, alt, position, isFeatured: position === 0,
  });
  for (const [i, p] of catalog.products.entries()) {
    if (await prisma.product.findUnique({ where: { slug: p.slug } })) continue;
    const extra = [
      p.includes?.length ? `In the box:\n${p.includes.map((x) => `• ${x}`).join('\n')}` : '',
      p.safety ? `Safety: ${p.safety}` : '',
    ].filter(Boolean).join('\n\n');
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        type: TYPE_BY_CAT[p.cat] ?? 'CLOTHING',
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - (p.daysOld ?? i) * 864e5),
        basePrice: p.price * 100,
        compareAtPrice: p.compareAt ? p.compareAt * 100 : null,
        categoryId: catIds[p.cat],
        sizeGuideId: p.sizes ? guide.id : null,
        shortDescription: p.short,
        description: [p.desc, extra].filter(Boolean).join('\n\n'),
        materials: p.materials,
        careInstructions: p.care,
        ageRange: p.age,
        dimensionsCm: p.dims ?? null,
        dispatchMinDays: p.dispatch?.[0] ?? 3,
        dispatchMaxDays: p.dispatch?.[1] ?? 6,
        isFeatured: Boolean(p.featured),
        isPersonalizable: Boolean(p.personal),
        personalizationLabel: p.personal ?? null,
        tags: [p.cat.replace('baby-', ''), p.isNew ? 'new' : null].filter(Boolean),
        images: { create: p.imgs.map((n, k) => imageRow(n, k === 0 ? p.name : `${p.name}, photo ${k + 1}`, k)) },
      },
    });
    let pos = 0;
    for (const s of p.sizes ?? [null]) {
      for (const [color, hex] of p.colors) {
        const sku = ['YA', String(i + 1).padStart(3, '0'), s && s.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6), color.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4)].filter(Boolean).join('-');
        // Starting stock: 3 of each. The owner sets the real numbers in Admin → Inventory.
        const v = await prisma.productVariant.create({ data: { productId: product.id, sku, size: s, color, colorHex: hex, stock: 3, position: pos++ } });
        await prisma.inventoryMovement.create({ data: { variantId: v.id, delta: 3, reason: 'restock', note: 'Opening stock' } });
      }
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
