const { Router } = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { parse } = require('../../lib/validate');
const { track, TRACKABLE } = require('./service');

const router = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });

// Client-side beacons are limited to a whitelist; server-side events (purchase, add_to_cart...) are tracked in their modules.
router.post('/event', limiter, (req, res) => {
  const { type, path } = parse(z.object({ type: z.string().max(40), path: z.string().max(300).optional() }), req.body);
  if (TRACKABLE.has(type)) track(req, type, { path });
  res.status(204).end();
});

module.exports = { router };
