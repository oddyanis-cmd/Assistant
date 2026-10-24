// CSRF defence for cookie-authenticated JSON APIs:
//  1. Session cookies are SameSite=Lax.
//  2. State-changing requests must carry an Origin/Referer matching APP_URL, or (when the browser
//     omits both) the custom X-Requested-With header that cross-site forms cannot set.
// Payment webhooks are mounted before this middleware and authenticated by signature instead.
const env = require('../config/env');
const { forbidden } = require('../lib/errors');

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

module.exports = function csrf(req, _res, next) {
  if (SAFE.has(req.method)) return next();
  const allowed = new URL(env.APP_URL).origin;
  const origin = req.get('origin') || (req.get('referer') && new URL(req.get('referer')).origin);
  if (origin) {
    if (origin !== allowed) throw forbidden('Cross-site request blocked');
    return next();
  }
  if (req.get('x-requested-with') === 'fetch') return next();
  throw forbidden('Cross-site request blocked');
};
