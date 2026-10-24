// Categories, size guides, pages, reviews, settings, customers, newsletter.
const { Router } = require('express');
const { z } = require('zod');
const prisma = require('../../lib/prisma');
const { parse } = require('../../lib/validate');
const { notFound, badRequest } = require('../../lib/errors');
const { uniqueSlug, slugify } = require('../../lib/slug');
const { audit } = require('../../lib/audit');
const { requireRole } = require('../../middleware/session');
const settings = require('../settings/service');
const defaults = require('../settings/defaults');

const router = Router();
const adminOnly = requireRole('ADMIN');

// ---------- Categories ----------
const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().max(90).optional(),
  description: z.string().max(1000).nullish(),
  imageUrl: z.string().max(500).nullish(),
  parentId: z.string().nullish(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  showOnHome: z.boolean().default(false),
});

router.get('/categories', async (_req, res) => {
  res.json({ categories: await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: true } } } }) });
});
router.post('/categories', async (req, res) => {
  const data = parse(categorySchema, req.body);
  data.slug = await uniqueSlug(prisma.category, data.slug ? slugify(data.slug) : data.name);
  const category = await prisma.category.create({ data });
  audit(req, 'create', 'category', category.id);
  res.status(201).json({ category });
});
router.patch('/categories/:id', async (req, res) => {
  const data = parse(categorySchema.partial(), req.body);
  if (data.slug !== undefined) data.slug = await uniqueSlug(prisma.category, slugify(data.slug), req.params.id);
  if (data.parentId === req.params.id) throw badRequest('A category cannot be its own parent');
  const category = await prisma.category.update({ where: { id: req.params.id }, data });
  audit(req, 'update', 'category', category.id);
  res.json({ category });
});
router.delete('/categories/:id', async (req, res) => {
  const count = await prisma.product.count({ where: { categoryId: req.params.id } });
  if (count) throw badRequest(`Move the ${count} product(s) in this category first`);
  await prisma.category.updateMany({ where: { parentId: req.params.id }, data: { parentId: null } });
  await prisma.category.delete({ where: { id: req.params.id } });
  audit(req, 'delete', 'category', req.params.id);
  res.json({ ok: true });
});

// ---------- Size guides ----------
const guideSchema = z.object({
  name: z.string().trim().min(2).max(100),
  columns: z.array(z.string().max(40)).min(1).max(10),
  rows: z.array(z.array(z.string().max(40))).max(40),
  notes: z.string().max(1000).nullish(),
});
router.get('/size-guides', async (_req, res) => res.json({ sizeGuides: await prisma.sizeGuide.findMany({ orderBy: { name: 'asc' } }) }));
router.post('/size-guides', async (req, res) => res.status(201).json({ sizeGuide: await prisma.sizeGuide.create({ data: parse(guideSchema, req.body) }) }));
router.patch('/size-guides/:id', async (req, res) => res.json({ sizeGuide: await prisma.sizeGuide.update({ where: { id: req.params.id }, data: parse(guideSchema.partial(), req.body) }) }));
router.delete('/size-guides/:id', async (req, res) => {
  await prisma.product.updateMany({ where: { sizeGuideId: req.params.id }, data: { sizeGuideId: null } });
  await prisma.sizeGuide.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ---------- Reviews moderation ----------
router.get('/reviews', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') }), req.query);
  res.json({
    reviews: await prisma.review.findMany({
      where: { status }, orderBy: { createdAt: 'desc' }, take: 200,
      include: { user: { select: { name: true, email: true } }, product: { select: { name: true, slug: true } } },
    }),
  });
});
router.patch('/reviews/:id', async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']) }), req.body);
  const review = await prisma.review.update({ where: { id: req.params.id }, data: { status } });
  audit(req, 'moderate', 'review', review.id, { status });
  res.json({ review });
});
router.delete('/reviews/:id', async (req, res) => {
  await prisma.review.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ---------- CMS pages (ADMIN) ----------
const pageSchema = z.object({
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(150),
  body: z.string().max(50000),
  isPublished: z.boolean().default(true),
});
router.get('/pages', adminOnly, async (_req, res) => res.json({ pages: await prisma.page.findMany({ orderBy: { slug: 'asc' } }) }));
router.post('/pages', adminOnly, async (req, res) => res.status(201).json({ page: await prisma.page.create({ data: parse(pageSchema, req.body) }) }));
router.patch('/pages/:id', adminOnly, async (req, res) => {
  const page = await prisma.page.update({ where: { id: req.params.id }, data: parse(pageSchema.partial(), req.body) });
  audit(req, 'update', 'page', page.id);
  res.json({ page });
});
router.delete('/pages/:id', adminOnly, async (req, res) => {
  await prisma.page.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ---------- Settings (ADMIN) ----------
router.get('/settings', adminOnly, async (_req, res) => res.json({ settings: await settings.getAll(), keys: settings.KEYS }));
router.put('/settings/:key', adminOnly, async (req, res) => {
  const { key } = req.params;
  if (!settings.KEYS.includes(key)) throw notFound('Unknown setting');
  const value = req.body?.value;
  if (value === undefined || typeof value !== typeof defaults[key] || Array.isArray(value) !== Array.isArray(defaults[key])) {
    throw badRequest(`Setting "${key}" must be ${Array.isArray(defaults[key]) ? 'an array' : `an ${typeof defaults[key]}`}`);
  }
  if (JSON.stringify(value).length > 100_000) throw badRequest('Setting is too large');
  if (key === 'media') {
    const m = parse(z.object({ maxFileSizeMb: z.number().min(0.1).max(50), storageQuotaMb: z.number().min(10), galleryPageSize: z.number().int().min(6).max(200) }).passthrough(), value);
    void m;
  }
  if (key === 'shipping') parse(z.object({ flatFee: z.number().int().min(0), freeOver: z.number().int().min(0), countries: z.array(z.string().length(2)).min(1) }), value);
  const saved = await settings.set(key, value);
  audit(req, 'update', 'setting', key);
  res.json({ key, value: saved });
});

// ---------- Customers (ADMIN) ----------
router.get('/customers', adminOnly, async (req, res) => {
  const { q, page } = parse(z.object({ q: z.string().max(100).optional(), page: z.coerce.number().int().min(1).default(1) }), req.query);
  const where = q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] } : {};
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 25, take: 25,
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, _count: { select: { orders: true } } },
    }),
  ]);
  res.json({ customers: users, total, page, totalPages: Math.ceil(total / 25) });
});
router.patch('/customers/:id/role', adminOnly, async (req, res) => {
  const { role } = parse(z.object({ role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']) }), req.body);
  if (req.params.id === req.user.id) throw badRequest('You cannot change your own role');
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role }, select: { id: true, role: true } });
  await prisma.session.deleteMany({ where: { userId: user.id } }); // force re-login with new privileges
  audit(req, 'change_role', 'user', user.id, { role });
  res.json({ user });
});

// ---------- Newsletter (ADMIN) ----------
router.get('/newsletter', adminOnly, async (req, res) => {
  const subs = await prisma.newsletterSubscriber.findMany({ where: { unsubscribedAt: null }, orderBy: { consentAt: 'desc' } });
  if (req.query.format === 'csv') {
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    res.type('text/csv').attachment('newsletter.csv');
    return res.send(['email,consent_at,source,consent_text', ...subs.map((s) => [s.email, s.consentAt.toISOString(), s.source, s.consentText].map(esc).join(','))].join('\n'));
  }
  res.json({ subscribers: subs, total: subs.length });
});

// ---------- Audit log (ADMIN) ----------
router.get('/audit', adminOnly, async (_req, res) => {
  res.json({ entries: await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) });
});

module.exports = { router };
