// Reviews, wishlist and newsletter.
const { Router } = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const prisma = require('../../lib/prisma');
const { parse } = require('../../lib/validate');
const { notFound, badRequest } = require('../../lib/errors');
const { requireAuth } = require('../../middleware/session');
const settings = require('../settings/service');
const catalog = require('../catalog/service');

const router = Router();
const writeLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });

// ---- Reviews ----
router.get('/products/:slug/reviews', async (req, res) => {
  const { page } = parse(z.object({ page: z.coerce.number().int().min(1).default(1) }), req.query);
  const p = await prisma.product.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' }, select: { id: true } });
  if (!p) throw notFound();
  const where = { productId: p.id, status: 'APPROVED' };
  const [total, reviews] = await prisma.$transaction([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 10,
      take: 10,
      select: { id: true, rating: true, title: true, body: true, verified: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);
  res.json({ reviews: reviews.map((r) => ({ ...r, user: { name: r.user.name.split(' ')[0] } })), total, page });
});

router.post('/products/:slug/reviews', requireAuth, writeLimiter, async (req, res) => {
  const data = parse(
    z.object({ rating: z.number().int().min(1).max(5), title: z.string().trim().max(120).optional(), body: z.string().trim().min(10).max(2000) }),
    req.body,
  );
  const p = await prisma.product.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' }, select: { id: true } });
  if (!p) throw notFound();
  const purchased = await prisma.orderItem.count({
    where: { variant: { productId: p.id }, order: { userId: req.user.id, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } } },
  });
  const review = await prisma.review.upsert({
    where: { productId_userId: { productId: p.id, userId: req.user.id } },
    create: { ...data, productId: p.id, userId: req.user.id, verified: purchased > 0 },
    update: { ...data, status: 'PENDING', verified: purchased > 0 },
  });
  res.status(201).json({ review: { id: review.id, status: review.status }, message: 'Thank you! Your review will appear once approved.' });
});

// ---- Wishlist ----
router.get('/wishlist', requireAuth, async (req, res) => {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId: req.user.id, product: { status: 'PUBLISHED' } },
    orderBy: { createdAt: 'desc' },
    include: { product: { select: catalog.cardSelect } },
  });
  res.json({ items: rows.map((r) => catalog.toCard(r.product)) });
});

router.post('/wishlist/:productId', requireAuth, async (req, res) => {
  const p = await prisma.product.findFirst({ where: { id: req.params.productId, status: 'PUBLISHED' }, select: { id: true } });
  if (!p) throw notFound();
  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: req.user.id, productId: p.id } },
    create: { userId: req.user.id, productId: p.id },
    update: {},
  });
  res.status(201).json({ ok: true });
});

router.delete('/wishlist/:productId', requireAuth, async (req, res) => {
  await prisma.wishlistItem.deleteMany({ where: { userId: req.user.id, productId: req.params.productId } });
  res.json({ ok: true });
});

// ---- Newsletter (explicit consent, stored with the consent text shown) ----
router.post('/newsletter', writeLimiter, async (req, res) => {
  const cfg = await settings.get('newsletter');
  if (!cfg.enabled) throw badRequest('Newsletter sign-up is currently closed');
  const { email, consent, source } = parse(
    z.object({ email: z.string().trim().toLowerCase().email().max(200), consent: z.literal(true), source: z.string().max(40).default('footer') }),
    req.body,
  );
  void consent;
  await prisma.newsletterSubscriber.upsert({
    where: { email },
    create: { email, consentText: cfg.consentText, ip: req.ip, source },
    update: { consentText: cfg.consentText, consentAt: new Date(), unsubscribedAt: null, ip: req.ip },
  });
  res.status(201).json({ ok: true, message: 'Thank you for subscribing!' });
});

router.post('/newsletter/unsubscribe', writeLimiter, async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email() }), req.body);
  await prisma.newsletterSubscriber.updateMany({ where: { email }, data: { unsubscribedAt: new Date() } });
  res.json({ ok: true });
});

module.exports = { router };
