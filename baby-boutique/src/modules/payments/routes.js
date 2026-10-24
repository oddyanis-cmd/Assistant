const express = require('express');
const { z } = require('zod');
const prisma = require('../../lib/prisma');
const env = require('../../config/env');
const { parse } = require('../../lib/validate');
const { badRequest, notFound, forbidden } = require('../../lib/errors');
const { sha256 } = require('../../lib/crypto');
const { getProvider, ALL } = require('./registry');
const { applyPaymentResult } = require('../orders/service');
const { track } = require('../analytics/service');

/** Amount checker for providers that settle in a different currency (PayPal). */
function amountCheckFor(provider, result) {
  if (result.amountInProviderCurrency != null && provider.convert) {
    return (order) => result.amountInProviderCurrency === provider.convert(order.total);
  }
  return undefined;
}

// ---------- Webhooks (raw body, signature-verified, idempotent, mounted before JSON/CSRF middleware) ----------
const webhooks = express.Router();
webhooks.post('/:provider', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const provider = ALL[req.params.provider];
  if (!provider?.handleWebhook || !provider.isConfigured()) return res.status(404).end();
  let events;
  try {
    events = await provider.handleWebhook(req);
  } catch (e) {
    console.warn(`[webhook:${provider.id}] rejected: ${e.message}`);
    return res.status(400).json({ error: 'Invalid webhook' });
  }
  for (const ev of events) {
    const id = `${provider.id}:${ev.eventId}`;
    const seen = await prisma.webhookEvent.findUnique({ where: { id } });
    if (seen) continue;
    const payment = await prisma.payment.findUnique({ where: { provider_providerRef: { provider: provider.id, providerRef: ev.providerRef } } });
    if (payment) {
      const order = await applyPaymentResult(payment, ev, amountCheckFor(provider, ev));
      if (order.status === 'PAID') track(req, 'purchase', { meta: { orderNumber: order.number, total: order.total } });
    }
    await prisma.webhookEvent.create({ data: { id, provider: provider.id, type: ev.type } });
  }
  res.json({ received: true });
});

// ---------- Customer return from a hosted payment page ----------
const pages = express.Router();
pages.get('/checkout/return', async (req, res) => {
  const { provider: providerId, order: number, token } = req.query;
  const back = `/order?order=${encodeURIComponent(number ?? '')}&token=${encodeURIComponent(token ?? '')}`;
  try {
    const provider = getProvider(String(providerId));
    const order = await prisma.order.findUnique({ where: { number: String(number) } });
    if (!provider?.confirmReturn || !order || sha256(String(token)) !== order.accessTokenHash) return res.redirect(back);
    const payment = await prisma.payment.findFirst({ where: { orderId: order.id, provider: provider.id }, orderBy: { createdAt: 'desc' } });
    if (payment && payment.status === 'PENDING') {
      const result = await provider.confirmReturn({ order, payment, query: req.query });
      const updated = await applyPaymentResult(payment, result);
      if (updated.status === 'PAID') track(req, 'purchase', { meta: { orderNumber: order.number, total: order.total } });
    }
  } catch (e) {
    console.error('payment return', e);
  }
  res.redirect(back);
});

// ---------- Development fake gateway ----------
const devApi = express.Router();
devApi.post('/complete', async (req, res) => {
  if (env.isProd || !getProvider('dev')) throw notFound();
  const { order: number, token, ref, outcome } = parse(
    z.object({ order: z.string(), token: z.string(), ref: z.string(), outcome: z.enum(['success', 'failure']) }),
    req.body,
  );
  const order = await prisma.order.findUnique({ where: { number } });
  if (!order || sha256(token) !== order.accessTokenHash) throw forbidden();
  const payment = await prisma.payment.findUnique({ where: { provider_providerRef: { provider: 'dev', providerRef: ref } } });
  if (!payment || payment.orderId !== order.id) throw badRequest('Unknown payment');
  const updated = await applyPaymentResult(payment, {
    status: outcome === 'success' ? 'SUCCEEDED' : 'FAILED',
    amount: order.total,
    raw: { simulated: true, outcome },
  });
  if (updated.status === 'PAID') track(req, 'purchase', { meta: { orderNumber: order.number, total: order.total } });
  res.json({ status: updated.status });
});

module.exports = { webhooks, pages, devApi };
