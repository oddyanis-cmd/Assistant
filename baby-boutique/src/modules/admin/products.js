const { Router } = require('express');
const { z } = require('zod');
const multer = require('multer');
const prisma = require('../../lib/prisma');
const { parse } = require('../../lib/validate');
const { notFound, badRequest } = require('../../lib/errors');
const { uniqueSlug, slugify } = require('../../lib/slug');
const { audit } = require('../../lib/audit');
const settings = require('../settings/service');
const media = require('../media/service');

const router = Router();

const price = z.coerce.number().min(0).max(1_000_000).transform((n) => Math.round(n * 100)); // QAR in, minor units stored
const productSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z.string().trim().max(90).optional(),
  shortDescription: z.string().trim().max(300).nullish(),
  description: z.string().max(20000).default(''),
  type: z.enum(['CLOTHING', 'SHOES', 'ACCESSORY', 'DOLL', 'GIFT_SET']).default('CLOTHING'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  basePrice: price,
  compareAtPrice: price.nullish(),
  categoryId: z.string().nullish(),
  sizeGuideId: z.string().nullish(),
  materials: z.string().max(500).nullish(),
  careInstructions: z.string().max(1000).nullish(),
  ageRange: z.string().max(100).nullish(),
  dimensionsCm: z.string().max(200).nullish(),
  dispatchMinDays: z.coerce.number().int().min(0).max(120).default(2),
  dispatchMaxDays: z.coerce.number().int().min(0).max(120).default(5),
  madeToOrder: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  isPersonalizable: z.boolean().default(false),
  personalizationLabel: z.string().max(100).nullish(),
  tags: z.array(z.string().trim().toLowerCase().max(40)).max(30).default([]),
});

router.get('/products', async (req, res) => {
  const q = parse(
    z.object({
      q: z.string().max(100).optional(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
      categoryId: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }),
    req.query,
  );
  const where = {
    ...(q.status && { status: q.status }),
    ...(q.categoryId && { categoryId: q.categoryId }),
    ...(q.q && { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { variants: { some: { sku: { contains: q.q, mode: 'insensitive' } } } }] }),
  };
  const [total, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        category: { select: { name: true } },
        images: { where: { isFeatured: true }, take: 1, select: { thumbUrl: true } },
        variants: { select: { stock: true, isActive: true } },
        _count: { select: { images: true } },
      },
    }),
  ]);
  res.json({
    items: items.map((p) => ({
      id: p.id, name: p.name, slug: p.slug, status: p.status, type: p.type, basePrice: p.basePrice,
      category: p.category?.name ?? null, thumbUrl: p.images[0]?.thumbUrl ?? null, imageCount: p._count.images,
      variantCount: p.variants.length, stock: p.variants.filter((v) => v.isActive).reduce((s, v) => s + v.stock, 0),
      isFeatured: p.isFeatured, salesCount: p.salesCount, updatedAt: p.updatedAt,
    })),
    total, page: q.page, totalPages: Math.ceil(total / q.pageSize),
  });
});

router.get('/products/:id', async (req, res) => {
  const p = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { variants: { orderBy: { position: 'asc' } }, _count: { select: { images: true } } },
  });
  if (!p) throw notFound();
  res.json({ product: p });
});

async function prepare(data, id) {
  const out = { ...data };
  out.slug = await uniqueSlug(prisma.product, data.slug ? slugify(data.slug) : data.name, id);
  if (data.dispatchMaxDays < data.dispatchMinDays) throw badRequest('Max dispatch days must be ≥ min');
  return out;
}

router.post('/products', async (req, res) => {
  const data = await prepare(parse(productSchema, req.body));
  const product = await prisma.product.create({ data: { ...data, publishedAt: data.status === 'PUBLISHED' ? new Date() : null } });
  audit(req, 'create', 'product', product.id, { name: product.name });
  res.status(201).json({ product });
});

router.patch('/products/:id', async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound();
  const data = await prepare(parse(productSchema, { ...existing, basePrice: existing.basePrice / 100, compareAtPrice: existing.compareAtPrice != null ? existing.compareAtPrice / 100 : null, ...req.body }), existing.id);
  const publishedAt = data.status === 'PUBLISHED' && !existing.publishedAt ? new Date() : existing.publishedAt;
  const product = await prisma.product.update({ where: { id: existing.id }, data: { ...data, publishedAt } });
  audit(req, 'update', 'product', product.id, { fields: Object.keys(req.body) });
  res.json({ product });
});

router.delete('/products/:id', async (req, res) => {
  const sold = await prisma.orderItem.count({ where: { variant: { productId: req.params.id } } });
  if (sold > 0) {
    // Keep order history intact: archive instead of hard delete.
    await prisma.product.update({ where: { id: req.params.id }, data: { status: 'ARCHIVED' } });
    audit(req, 'archive', 'product', req.params.id);
    return res.json({ archived: true });
  }
  const images = await prisma.productImage.findMany({ where: { productId: req.params.id } });
  for (const img of images) await media.deleteImage(img);
  await prisma.product.delete({ where: { id: req.params.id } });
  audit(req, 'delete', 'product', req.params.id);
  res.json({ deleted: true });
});

// ---------- Variants ----------
const variantSchema = z.object({
  sku: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9._-]+$/, 'Letters, numbers, dot, dash, underscore only'),
  size: z.string().trim().max(40).nullish(),
  color: z.string().trim().max(40).nullish(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  price: price.nullish(),
  stock: z.coerce.number().int().min(0).max(100000).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000).default(2),
  isActive: z.boolean().default(true),
  position: z.coerce.number().int().default(0),
});

router.post('/products/:id/variants', async (req, res) => {
  const data = parse(variantSchema, req.body);
  const variant = await prisma.productVariant.create({ data: { ...data, productId: req.params.id } });
  if (data.stock) await prisma.inventoryMovement.create({ data: { variantId: variant.id, delta: data.stock, reason: 'restock', note: 'Initial stock', userId: req.user.id } });
  audit(req, 'create', 'variant', variant.id, { sku: variant.sku });
  res.status(201).json({ variant });
});

/** Create every size × colour combination that does not exist yet. */
router.post('/products/:id/variants/generate', async (req, res) => {
  const { sizes, colors, stock, skuPrefix } = parse(
    z.object({
      sizes: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
      colors: z.array(z.object({ name: z.string().trim().min(1).max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })).max(30).default([]),
      stock: z.coerce.number().int().min(0).default(0),
      skuPrefix: z.string().trim().max(20).regex(/^[A-Za-z0-9-]*$/).optional(),
    }),
    req.body,
  );
  const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: { variants: true } });
  if (!product) throw notFound();
  const prefix = (skuPrefix || product.slug.slice(0, 12)).toUpperCase();
  const sizeList = sizes.length ? sizes : [null];
  const colorList = colors.length ? colors : [{ name: null }];
  const created = [];
  let pos = product.variants.length;
  for (const s of sizeList) {
    for (const c of colorList) {
      if (product.variants.some((v) => v.size === s && v.color === c.name)) continue;
      const sku = [prefix, s && slugify(s).toUpperCase(), c.name && slugify(c.name).toUpperCase()].filter(Boolean).join('-');
      const v = await prisma.productVariant.create({
        data: { productId: product.id, sku: await uniqueSku(sku), size: s, color: c.name, colorHex: c.hex ?? null, stock, position: pos++ },
      });
      if (stock) await prisma.inventoryMovement.create({ data: { variantId: v.id, delta: stock, reason: 'restock', note: 'Initial stock', userId: req.user.id } });
      created.push(v);
    }
  }
  audit(req, 'generate_variants', 'product', product.id, { count: created.length });
  res.status(201).json({ created });
});

async function uniqueSku(base) {
  let sku = base;
  for (let i = 2; await prisma.productVariant.findUnique({ where: { sku } }); i++) sku = `${base}-${i}`;
  return sku;
}

router.patch('/variants/:id', async (req, res) => {
  // Stock is changed only via /adjust so every change is recorded in the inventory ledger.
  const data = parse(variantSchema.omit({ stock: true }).partial(), req.body);
  const variant = await prisma.productVariant.update({ where: { id: req.params.id }, data });
  audit(req, 'update', 'variant', variant.id, data);
  res.json({ variant });
});

router.delete('/variants/:id', async (req, res) => {
  const sold = await prisma.orderItem.count({ where: { variantId: req.params.id } });
  if (sold) {
    await prisma.productVariant.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ deactivated: true });
  }
  await prisma.productVariant.delete({ where: { id: req.params.id } });
  audit(req, 'delete', 'variant', req.params.id);
  res.json({ deleted: true });
});

// ---------- Inventory ----------
router.post('/variants/:id/adjust', async (req, res) => {
  const { delta, reason, note } = parse(
    z.object({ delta: z.number().int().min(-100000).max(100000).refine((n) => n !== 0), reason: z.enum(['restock', 'adjustment', 'damaged', 'return']), note: z.string().max(300).optional() }),
    req.body,
  );
  const variant = await prisma.$transaction(async (tx) => {
    const r = await tx.productVariant.updateMany({ where: { id: req.params.id, ...(delta < 0 && { stock: { gte: -delta } }) }, data: { stock: { increment: delta } } });
    if (r.count !== 1) throw badRequest('Stock cannot go below zero');
    await tx.inventoryMovement.create({ data: { variantId: req.params.id, delta, reason, note, userId: req.user.id } });
    return tx.productVariant.findUnique({ where: { id: req.params.id } });
  });
  res.json({ variant });
});

router.get('/variants/:id/movements', async (req, res) => {
  res.json({ movements: await prisma.inventoryMovement.findMany({ where: { variantId: req.params.id }, orderBy: { createdAt: 'desc' }, take: 100 }) });
});

router.get('/inventory', async (req, res) => {
  const { lowOnly } = parse(z.object({ lowOnly: z.coerce.boolean().default(false) }), req.query);
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { status: { not: 'ARCHIVED' } } },
    orderBy: [{ stock: 'asc' }],
    take: 500,
    include: { product: { select: { id: true, name: true, status: true } } },
  });
  const rows = variants.filter((v) => !lowOnly || v.stock <= v.lowStockThreshold);
  res.json({ variants: rows });
});

// ---------- Images ----------
// Upload size limit comes from admin-editable settings; there is no per-product image count cap.
async function uploader(req, res, next) {
  const { maxFileSizeMb } = await settings.get('media');
  multer({ storage: multer.memoryStorage(), limits: { fileSize: Math.floor(maxFileSizeMb * 1024 * 1024), files: 10 } }).array('images', 10)(req, res, next);
}

router.get('/products/:id/images', async (req, res) => {
  const { page } = parse(z.object({ page: z.coerce.number().int().min(1).default(1) }), req.query);
  const { galleryPageSize } = await settings.get('media');
  const where = { productId: req.params.id };
  const [total, images] = await prisma.$transaction([
    prisma.productImage.count({ where }),
    prisma.productImage.findMany({ where, orderBy: { position: 'asc' }, skip: (page - 1) * galleryPageSize, take: galleryPageSize }),
  ]);
  res.json({ images, total, page, totalPages: Math.ceil(total / galleryPageSize) });
});

router.post('/products/:id/images', uploader, async (req, res) => {
  if (!req.files?.length) throw badRequest('No images received (field name: images)');
  const product = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!product) throw notFound();
  const results = [];
  for (const file of req.files) {
    try {
      results.push({ ok: true, name: file.originalname, image: await media.addProductImage(product.id, file, { alt: req.body.alt }) });
    } catch (e) {
      results.push({ ok: false, name: file.originalname, error: e.message });
    }
  }
  audit(req, 'upload_images', 'product', product.id, { count: results.filter((r) => r.ok).length });
  res.status(201).json({ results });
});

router.put('/products/:id/images/order', async (req, res) => {
  const { ids } = parse(z.object({ ids: z.array(z.string()).min(1).max(5000) }), req.body);
  const owned = await prisma.productImage.count({ where: { productId: req.params.id, id: { in: ids } } });
  if (owned !== ids.length) throw badRequest('Image list does not match this product');
  await prisma.$transaction(ids.map((id, i) => prisma.productImage.update({ where: { id }, data: { position: i } })));
  res.json({ ok: true });
});

router.patch('/images/:id', async (req, res) => {
  const data = parse(z.object({ alt: z.string().max(200).nullish(), isFeatured: z.literal(true).optional() }), req.body);
  const img = await prisma.productImage.findUnique({ where: { id: req.params.id } });
  if (!img) throw notFound();
  if (data.isFeatured) await prisma.productImage.updateMany({ where: { productId: img.productId }, data: { isFeatured: false } });
  res.json({ image: await prisma.productImage.update({ where: { id: img.id }, data }) });
});

router.delete('/images/:id', async (req, res) => {
  const img = await prisma.productImage.findUnique({ where: { id: req.params.id } });
  if (!img) throw notFound();
  await media.deleteImage(img);
  audit(req, 'delete_image', 'product', img.productId);
  res.json({ ok: true });
});

router.get('/media/usage', async (_req, res) => {
  res.json(await media.usage());
});

module.exports = { router };
