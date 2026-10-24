const { Router } = require('express');
const { z } = require('zod');
const { parse } = require('../../lib/validate');
const svc = require('./service');
const { track } = require('../analytics/service');

const router = Router();

router.get('/', async (req, res) => {
  res.json({ cart: await svc.priceCart(await svc.findCart(req)) });
});

router.post('/items', async (req, res) => {
  const body = parse(
    z.object({
      variantId: z.string().min(1),
      quantity: z.number().int().min(1).max(20).default(1),
      personalization: z.string().trim().max(60).default(''),
    }),
    req.body,
  );
  const cartId = await svc.addItem(req, res, body);
  track(req, 'add_to_cart', { meta: { variantId: body.variantId, quantity: body.quantity } });
  res.status(201).json({ cart: await svc.priceCart(await svc.loadCartById(cartId)) });
});

router.patch('/items/:id', async (req, res) => {
  const { quantity } = parse(z.object({ quantity: z.number().int().min(0).max(20) }), req.body);
  await svc.updateItem(req, req.params.id, quantity);
  res.json({ cart: await svc.priceCart(await svc.findCart(req)) });
});

router.delete('/items/:id', async (req, res) => {
  await svc.updateItem(req, req.params.id, 0);
  res.json({ cart: await svc.priceCart(await svc.findCart(req)) });
});

module.exports = { router };
