const { Router } = require('express');
const { z } = require('zod');
const prisma = require('../../lib/prisma');
const { parse } = require('../../lib/validate');
const { notFound, badRequest } = require('../../lib/errors');
const { audit } = require('../../lib/audit');
const { requireRole } = require('../../middleware/session');
const { TRANSITIONS, cancelOrder, releaseStock } = require('../orders/service');
const { ALL } = require('../payments/registry');

const router = Router();
const STATUSES = Object.keys(TRANSITIONS);

router.get('/orders', async (req, res) => {
  const q = parse(
    z.object({
      status: z.enum(STATUSES).optional(),
      q: z.string().max(100).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }),
    req.query,
  );
  const where = {
    ...(q.status && { status: q.status }),
    ...(q.q && { OR: [{ number: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }] }),
  };
  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
      select: { id: true, number: true, email: true, status: true, total: true, currency: true, paymentProvider: true, createdAt: true, _count: { select: { items: true } } },
    }),
  ]);
  res.json({ orders, total, page: q.page, totalPages: Math.ceil(total / q.pageSize) });
});

router.get('/orders/:id', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true, payments: true, user: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!order) throw notFound();
  const { accessTokenHash, ...rest } = order;
  void accessTokenHash;
  res.json({ order: rest, allowedTransitions: TRANSITIONS[order.status] });
});

router.patch('/orders/:id', async (req, res) => {
  const body = parse(
    z.object({ status: z.enum(STATUSES).optional(), trackingNumber: z.string().max(100).nullish(), adminNote: z.string().max(2000).nullish() }),
    req.body,
  );
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) throw notFound();
  if (body.status && body.status !== order.status) {
    if (!TRANSITIONS[order.status].includes(body.status)) throw badRequest(`Cannot change ${order.status} → ${body.status}`);
    if (body.status === 'REFUNDED' && req.user.role !== 'ADMIN') throw badRequest('Only an administrator can refund');
    if (body.status === 'CANCELLED') await cancelOrder(order.id, { userId: req.user.id });
  }
  const { status, ...rest } = body;
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { ...rest, ...(status && status !== 'CANCELLED' && { status }) },
  });
  audit(req, 'update', 'order', order.id, body);
  res.json({ order: updated });
});

/** Refund through the payment provider where supported, restock optionally. ADMIN only. */
router.post('/orders/:id/refund', requireRole('ADMIN'), async (req, res) => {
  const { amount, restock } = parse(z.object({ amount: z.number().int().positive().optional(), restock: z.boolean().default(true) }), req.body);
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { payments: true } });
  if (!order) throw notFound();
  const payment = order.payments.find((p) => p.status === 'SUCCEEDED');
  if (!payment) throw badRequest('No captured payment on this order');
  const provider = ALL[payment.provider];
  let providerResult = null;
  if (provider?.refund) providerResult = await provider.refund({ payment, amount });
  const fullRefund = !amount || amount >= order.total;
  await prisma.$transaction(async (tx) => {
    if (fullRefund) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
      await tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
    }
    if (restock) await releaseStock(tx, order, 'refund', req.user.id);
  });
  audit(req, 'refund', 'order', order.id, { amount: amount ?? order.total, provider: payment.provider, manual: !provider?.refund });
  res.json({ ok: true, manualRefundRequired: !provider?.refund, providerResult: providerResult ? { id: providerResult.id, status: providerResult.status } : null });
});

module.exports = { router };
