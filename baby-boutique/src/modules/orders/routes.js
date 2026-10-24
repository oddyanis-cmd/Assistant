const { Router } = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const prisma = require('../../lib/prisma');
const env = require('../../config/env');
const { parse } = require('../../lib/validate');
const { badRequest, notFound, forbidden } = require('../../lib/errors');
const { sha256 } = require('../../lib/crypto');
const { requireAuth } = require('../../middleware/session');
const { findCart } = require('../cart/service');
const { addressSchema } = require('../auth/routes');
const { enabledProviders, getProvider } = require('../payments/registry');
const { startPayment } = require('../payments/service');
const svc = require('./service');
const { track } = require('../analytics/service');

const router = Router();
const checkoutLimiter = rateLimit({ windowMs: 10 * 60_000, limit: env.NODE_ENV === 'test' ? 1000 : 15, standardHeaders: 'draft-7', legacyHeaders: false });

router.get('/checkout/providers', (_req, res) => {
  res.json({ providers: enabledProviders().map((p) => ({ id: p.id, label: p.label, testMode: p.id === 'dev' })) });
});

router.post('/checkout', checkoutLimiter, async (req, res) => {
  const body = parse(
    z.object({
      email: z.string().trim().toLowerCase().email().max(200),
      shippingAddress: addressSchema.omit({ isDefault: true }),
      customerNote: z.string().trim().max(500).optional(),
      provider: z.string(),
      saveAddress: z.boolean().optional(),
    }),
    req.body,
  );
  const provider = getProvider(body.provider);
  if (!provider) throw badRequest('Selected payment method is not available');
  const cart = await findCart(req);
  if (!cart) throw badRequest('Your cart is empty');

  const { order, accessToken, lines } = await svc.createOrderFromCart({
    cart,
    userId: req.user?.id,
    email: req.user?.email ?? body.email,
    shippingAddress: body.shippingAddress,
    customerNote: body.customerNote,
    provider: provider.id,
  });
  if (req.user && body.saveAddress) {
    await prisma.address.create({ data: { ...body.shippingAddress, userId: req.user.id } }).catch(() => {});
  }
  track(req, 'checkout_start', { meta: { orderNumber: order.number, total: order.total } });

  try {
    const { redirectUrl } = await startPayment({ order, lines, provider, accessToken });
    res.status(201).json({ orderNumber: order.number, accessToken, redirectUrl });
  } catch (e) {
    // Payment could not even start: give the stock back immediately.
    await svc.cancelOrder(order.id, { reason: 'cancel' });
    console.error('payment start failed', e);
    throw badRequest('We could not start the payment. Please try again or choose another method.');
  }
});

/** Owner (logged-in) or holder of the order access token. */
async function loadOrderForViewer(req, number, token) {
  const order = await prisma.order.findUnique({
    where: { number },
    include: { items: true, payments: { select: { provider: true, status: true, amount: true, createdAt: true } } },
  });
  if (!order) throw notFound('Order not found');
  const ownsIt = req.user && order.userId === req.user.id;
  const hasToken = token && sha256(token) === order.accessTokenHash;
  if (!ownsIt && !hasToken) throw forbidden('You cannot view this order');
  return order;
}

const publicOrder = (o) => ({
  number: o.number, status: o.status, email: o.email, currency: o.currency,
  subtotal: o.subtotal, shippingFee: o.shippingFee, discount: o.discount, total: o.total,
  shippingAddress: o.shippingAddress, customerNote: o.customerNote, trackingNumber: o.trackingNumber,
  paymentProvider: o.paymentProvider, createdAt: o.createdAt, paidAt: o.paidAt,
  items: o.items.map((i) => ({ productName: i.productName, sku: i.sku, size: i.size, color: i.color, imageUrl: i.imageUrl, unitPrice: i.unitPrice, quantity: i.quantity, personalization: i.personalization })),
  payments: o.payments,
});

router.get('/orders/:number', async (req, res) => {
  const order = await loadOrderForViewer(req, req.params.number, req.query.token);
  res.json({ order: publicOrder(order) });
});

/** Retry payment for an unpaid order (e.g. customer closed the payment page). */
router.post('/orders/:number/pay', checkoutLimiter, async (req, res) => {
  const { token, provider: providerId } = parse(z.object({ token: z.string().optional(), provider: z.string() }), req.body);
  const order = await loadOrderForViewer(req, req.params.number, token);
  if (order.status !== 'PENDING_PAYMENT') throw badRequest('This order is not awaiting payment');
  const provider = getProvider(providerId);
  if (!provider) throw badRequest('Selected payment method is not available');
  if (!token) throw badRequest('Missing order token');
  const { redirectUrl } = await startPayment({ order, lines: order.items, provider, accessToken: token });
  res.json({ redirectUrl });
});

router.get('/account/orders', requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { items: true, payments: { select: { provider: true, status: true, amount: true, createdAt: true } } },
  });
  res.json({ orders: orders.map(publicOrder) });
});

module.exports = { router, loadOrderForViewer, publicOrder };
