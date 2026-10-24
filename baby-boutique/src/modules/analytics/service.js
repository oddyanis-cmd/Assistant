const prisma = require('../../lib/prisma');
const env = require('../../config/env');
const { randomToken } = require('../../lib/crypto');

const VISITOR_COOKIE = 'vid';

/** Anonymous first-party visitor id (random, no PII) for funnel analytics. */
function visitorId(req, res, next) {
  let vid = req.cookies?.[VISITOR_COOKIE];
  if (!vid || !/^[\w-]{16,64}$/.test(vid)) {
    vid = randomToken(16);
    res.cookie(VISITOR_COOKIE, vid, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/', maxAge: 365 * 864e5 });
  }
  req.visitorId = vid;
  next();
}

/** Fire-and-forget event; analytics must never break a request. */
function track(req, type, { path, productId, meta } = {}) {
  prisma.analyticsEvent
    .create({ data: { type, path: path ?? null, productId: productId ?? null, visitorId: req.visitorId ?? null, meta: meta ?? undefined } })
    .catch((e) => console.error('analytics', e.message));
}

const TRACKABLE = new Set(['page_view', 'checkout_start']);

module.exports = { visitorId, track, TRACKABLE };
