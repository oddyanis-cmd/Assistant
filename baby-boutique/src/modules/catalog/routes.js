const { Router } = require('express');
const { z } = require('zod');
const prisma = require('../../lib/prisma');
const { parse } = require('../../lib/validate');
const { notFound } = require('../../lib/errors');
const svc = require('./service');
const settings = require('../settings/service');
const { track } = require('../analytics/service');

const router = Router();

const list = (v) => (v == null || v === '' ? undefined : (Array.isArray(v) ? v : String(v).split(',')).map((s) => s.trim()).filter(Boolean));
const money = z.coerce.number().min(0).transform((n) => Math.round(n * 100)).optional();

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  type: z.enum(['CLOTHING', 'SHOES', 'ACCESSORY', 'DOLL', 'GIFT_SET']).optional(),
  size: z.preprocess(list, z.array(z.string().max(40)).max(20).optional()),
  color: z.preprocess(list, z.array(z.string().max(40)).max(20).optional()),
  minPrice: money, // major units (QAR) in the URL, minor units internally
  maxPrice: money,
  availability: z.enum(['in_stock', 'made_to_order']).optional(),
  featured: z.coerce.boolean().optional(),
  newArrivals: z.coerce.boolean().optional(),
  sort: z.enum(Object.keys(svc.SORTS)).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

router.get('/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true, description: true, imageUrl: true, parentId: true, showOnHome: true },
  });
  res.json({ categories });
});

router.get('/products', async (req, res) => {
  const f = parse(listQuery, req.query);
  if (f.q) track(req, 'search', { meta: { q: f.q } });
  res.json(await svc.listProducts(f));
});

router.get('/products/facets', async (req, res) => {
  const { category } = parse(z.object({ category: z.string().max(80).optional() }), req.query);
  res.json(await svc.facets(category));
});

router.get('/products/:slug', async (req, res) => {
  const product = await svc.getProductBySlug(req.params.slug);
  if (!product) throw notFound('Product not found');
  track(req, 'product_view', { productId: product.id, path: product.url });
  res.json({ product });
});

// Paginated gallery for products with very large image sets.
router.get('/products/:slug/images', async (req, res) => {
  const { page } = parse(z.object({ page: z.coerce.number().int().min(1).default(1) }), req.query);
  const { galleryPageSize } = await settings.get('media');
  const p = await prisma.product.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' }, select: { id: true, name: true } });
  if (!p) throw notFound();
  const [total, images] = await prisma.$transaction([
    prisma.productImage.count({ where: { productId: p.id } }),
    prisma.productImage.findMany({
      where: { productId: p.id },
      orderBy: [{ isFeatured: 'desc' }, { position: 'asc' }],
      skip: (page - 1) * galleryPageSize,
      take: galleryPageSize,
      select: { id: true, url: true, mediumUrl: true, thumbUrl: true, alt: true, width: true, height: true },
    }),
  ]);
  res.json({ images, page, total, totalPages: Math.ceil(total / galleryPageSize) });
});

router.get('/products/:slug/related', async (req, res) => {
  const p = await prisma.product.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' } });
  if (!p) throw notFound();
  res.json({ items: await svc.relatedProducts(p) });
});

/** Everything the homepage needs in one request. */
router.get('/home', async (_req, res) => {
  const home = await settings.get('home');
  const [categories, bestSellers, newArrivals, reviews] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true, showOnHome: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.product.findMany({
      where: { status: 'PUBLISHED', isFeatured: true },
      orderBy: [{ salesCount: 'desc' }],
      take: 8,
      select: svc.cardSelect,
    }),
    prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: home.newArrivalsCount,
      select: svc.cardSelect,
    }),
    home.showReviews
      ? prisma.review.findMany({
          where: { status: 'APPROVED', rating: { gte: 4 } },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { id: true, rating: true, title: true, body: true, createdAt: true, user: { select: { name: true } }, product: { select: { name: true, slug: true } } },
        })
      : [],
  ]);
  res.json({
    categories,
    bestSellers: bestSellers.map(svc.toCard),
    newArrivals: newArrivals.map(svc.toCard),
    reviews: reviews.map((r) => ({ ...r, user: { name: r.user.name.split(' ')[0] } })),
  });
});

router.get('/pages/:slug', async (req, res) => {
  const page = await prisma.page.findFirst({ where: { slug: req.params.slug, isPublished: true } });
  if (!page) throw notFound('Page not found');
  res.json({ page: { slug: page.slug, title: page.title, body: page.body, updatedAt: page.updatedAt } });
});

router.get('/settings', async (_req, res) => {
  res.json({ settings: await settings.getPublic() });
});

module.exports = { router };
