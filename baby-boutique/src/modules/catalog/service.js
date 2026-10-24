const prisma = require('../../lib/prisma');

const SORTS = {
  newest: [{ publishedAt: 'desc' }],
  price_asc: [{ basePrice: 'asc' }],
  price_desc: [{ basePrice: 'desc' }],
  popular: [{ salesCount: 'desc' }, { publishedAt: 'desc' }],
  name: [{ name: 'asc' }],
};

const cardSelect = {
  id: true, name: true, slug: true, type: true, basePrice: true, compareAtPrice: true, currency: true,
  isFeatured: true, madeToOrder: true, publishedAt: true, isPersonalizable: true,
  category: { select: { name: true, slug: true } },
  images: { orderBy: [{ isFeatured: 'desc' }, { position: 'asc' }], take: 2, select: { thumbUrl: true, mediumUrl: true, alt: true } },
  variants: { where: { isActive: true }, orderBy: { position: 'asc' }, select: { id: true, size: true, color: true, colorHex: true, price: true, stock: true } },
};

/** Shape a product row into the storefront card DTO. */
function toCard(p) {
  const prices = p.variants.map((v) => v.price ?? p.basePrice);
  const stock = p.variants.reduce((s, v) => s + Math.max(0, v.stock), 0);
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    url: `/product/${p.slug}`,
    type: p.type,
    category: p.category,
    price: prices.length ? Math.min(...prices) : p.basePrice,
    priceVaries: new Set(prices).size > 1,
    compareAtPrice: p.compareAtPrice,
    currency: p.currency,
    image: p.images[0] ?? null,
    hoverImage: p.images[1] ?? null,
    sizes: uniq(p.variants.map((v) => v.size)),
    colors: uniq(p.variants.map((v) => v.color)).map((c) => ({ name: c, hex: p.variants.find((v) => v.color === c)?.colorHex })),
    stockStatus: stock <= 0 ? 'out_of_stock' : p.madeToOrder ? 'made_to_order' : stock <= 3 ? 'low' : 'in_stock',
    defaultVariantId: p.variants.length === 1 ? p.variants[0].id : null,
    isFeatured: p.isFeatured,
    isPersonalizable: p.isPersonalizable,
    isNew: p.publishedAt && Date.now() - new Date(p.publishedAt) < 30 * 864e5,
  };
}

function buildWhere(f) {
  const and = [{ status: 'PUBLISHED' }];
  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q, mode: 'insensitive' } },
        { shortDescription: { contains: f.q, mode: 'insensitive' } },
        { tags: { has: f.q.toLowerCase() } },
      ],
    });
  }
  if (f.category) {
    and.push({ OR: [{ category: { slug: f.category } }, { category: { parent: { slug: f.category } } }] });
  }
  if (f.type) and.push({ type: f.type });
  if (f.size?.length) and.push({ variants: { some: { isActive: true, size: { in: f.size } } } });
  if (f.color?.length) and.push({ variants: { some: { isActive: true, color: { in: f.color } } } });
  if (f.minPrice != null || f.maxPrice != null) {
    const range = { ...(f.minPrice != null && { gte: f.minPrice }), ...(f.maxPrice != null && { lte: f.maxPrice }) };
    and.push({ OR: [{ basePrice: range, variants: { some: { isActive: true, price: null } } }, { variants: { some: { isActive: true, price: range } } }] });
  }
  if (f.availability === 'in_stock') and.push({ variants: { some: { isActive: true, stock: { gt: 0 } } } });
  if (f.availability === 'made_to_order') and.push({ madeToOrder: true });
  if (f.featured) and.push({ isFeatured: true });
  if (f.newArrivals) and.push({ publishedAt: { gte: new Date(Date.now() - 45 * 864e5) } });
  return { AND: and };
}

async function listProducts(f) {
  const where = buildWhere(f);
  const [total, rows] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: SORTS[f.sort] ?? SORTS.newest,
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: cardSelect,
    }),
  ]);
  return { items: rows.map(toCard), page: f.page, pageSize: f.pageSize, total, totalPages: Math.ceil(total / f.pageSize) };
}

/** Values available for filter UI, scoped to the current category if given. */
async function facets(category) {
  const productWhere = buildWhere({ category });
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: productWhere },
    select: { size: true, color: true, colorHex: true, price: true, product: { select: { basePrice: true } } },
  });
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];
  const colorMap = new Map();
  variants.forEach((v) => v.color && !colorMap.has(v.color) && colorMap.set(v.color, v.colorHex));
  const prices = variants.map((v) => v.price ?? v.product.basePrice);
  return {
    sizes: sortSizes(sizes),
    colors: [...colorMap].map(([name, hex]) => ({ name, hex })),
    price: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: 0, max: 0 },
  };
}

const SIZE_ORDER = ['Newborn', '0–3 months', '3–6 months', '6–9 months', '9–12 months', '12–18 months', '18–24 months', '2–3 years'];
function sortSizes(sizes) {
  const rank = (s) => (SIZE_ORDER.indexOf(s) === -1 ? 999 : SIZE_ORDER.indexOf(s));
  return sizes.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

async function getProductBySlug(slug, { includeDraft = false } = {}) {
  const p = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      sizeGuide: true,
      images: { orderBy: [{ isFeatured: 'desc' }, { position: 'asc' }], take: 50 },
      variants: { where: { isActive: true }, orderBy: { position: 'asc' } },
      _count: { select: { images: true } },
    },
  });
  if (!p || (!includeDraft && p.status !== 'PUBLISHED')) return null;
  const rating = await prisma.review.aggregate({
    where: { productId: p.id, status: 'APPROVED' },
    _avg: { rating: true },
    _count: true,
  });
  const card = toCard({ ...p, images: p.images });
  return {
    ...card,
    shortDescription: p.shortDescription,
    description: p.description,
    materials: p.materials,
    careInstructions: p.careInstructions,
    ageRange: p.ageRange,
    dimensionsCm: p.dimensionsCm,
    dispatch: { minDays: p.dispatchMinDays, maxDays: p.dispatchMaxDays, madeToOrder: p.madeToOrder },
    personalizationLabel: p.personalizationLabel,
    sizeGuide: p.sizeGuide ? { name: p.sizeGuide.name, columns: p.sizeGuide.columns, rows: p.sizeGuide.rows, notes: p.sizeGuide.notes } : null,
    images: p.images.map((i) => ({ id: i.id, url: i.url, mediumUrl: i.mediumUrl, thumbUrl: i.thumbUrl, alt: i.alt || p.name, width: i.width, height: i.height })),
    imageCount: p._count.images,
    sizes: sortSizes(card.sizes),
    variants: p.variants.map((v) => ({
      id: v.id, sku: v.sku, size: v.size, color: v.color, colorHex: v.colorHex,
      price: v.price ?? p.basePrice,
      stock: Math.max(0, v.stock),
      stockStatus: v.stock <= 0 ? 'out_of_stock' : p.madeToOrder ? 'made_to_order' : v.stock <= v.lowStockThreshold ? 'low' : 'in_stock',
    })),
    rating: { average: rating._avg.rating ? Number(rating._avg.rating.toFixed(1)) : null, count: rating._count },
    categoryId: p.categoryId,
  };
}

async function relatedProducts(product, limit = 4) {
  const rows = await prisma.product.findMany({
    where: { status: 'PUBLISHED', id: { not: product.id }, OR: [{ categoryId: product.categoryId }, { type: product.type }] },
    orderBy: [{ salesCount: 'desc' }, { publishedAt: 'desc' }],
    take: limit,
    select: cardSelect,
  });
  return rows.map(toCard);
}

module.exports = { listProducts, facets, getProductBySlug, relatedProducts, toCard, cardSelect, buildWhere, sortSizes, SORTS };
