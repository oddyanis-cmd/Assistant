const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const { loadSession } = require('./middleware/session');
const csrf = require('./middleware/csrf');
const errorHandler = require('./middleware/errorHandler');
const { visitorId } = require('./modules/analytics/service');
const payments = require('./modules/payments/routes');
const adminHost = require('./middleware/adminHost');

function createApp() {
  const app = express();
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
          connectSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          upgradeInsecureRequests: env.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      // 1 year. Sub-domains are left out on purpose: mail.yaoua.qa is the email host at Unitech.
      strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use((req, res, next) => {
    // The site never needs these browser features; switching them off limits what injected code could do.
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), usb=(), serial=(), bluetooth=(), payment=(self), interest-cohort=()');
    // Never let a shared cache or the CDN keep personal data (accounts, orders, admin).
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin') || req.path.startsWith('/account') || req.path.startsWith('/order') || req.path.startsWith('/checkout')) {
      res.set('Cache-Control', 'no-store');
    }
    next();
  });
  // While the site is a test website, keep it out of Google and other search engines.
  if (env.PAYMENTS_TEST_MODE) {
    app.use((_req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });
    app.get('/robots.txt', (_req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));
  }
  // How security researchers can report a problem (RFC 9116).
  app.get('/.well-known/security.txt', (_req, res) => {
    res.type('text/plain').send(`Contact: mailto:info@yaoua.qa\nExpires: ${new Date(Date.now() + 365 * 864e5).toISOString()}\nPreferred-Languages: en, ar\nCanonical: ${env.APP_URL}/.well-known/security.txt\n`);
  });
  app.use(cookieParser());
  app.use(adminHost);

  // Webhooks need the raw body and are authenticated by provider signatures, not cookies.
  app.use('/api/webhooks', payments.webhooks);

  app.use(express.json({ limit: '200kb' }));
  app.use(visitorId);
  app.use(loadSession);
  app.use('/api', csrf);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', require('./modules/auth/routes').router);
  app.use('/api/cart', require('./modules/cart/routes').router);
  app.use('/api/analytics', require('./modules/analytics/routes').router);
  app.use('/api/payments/dev', payments.devApi);
  app.use('/api/admin', require('./modules/admin').router);
  app.use('/api', require('./modules/catalog/routes').router);
  app.use('/api', require('./modules/engagement/routes').router);
  app.use('/api', require('./modules/orders/routes').router);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use(payments.pages);

  // ---------- Static storefront & admin ----------
  const { publicDir: pub } = require('./lib/paths');
  // Product photos stored in Netlify Blobs (MEDIA_PROVIDER=netlify).
  app.get('/media/*key', async (req, res, next) => {
    if (env.MEDIA_PROVIDER !== 'netlify') return next();
    const buf = await require('./modules/media/storage/netlify').read([].concat(req.params.key).join('/'));
    if (!buf) return next();
    res.set('Cache-Control', 'public, max-age=31536000, immutable').type('image/webp').send(buf);
  });
  app.use('/uploads', express.static(path.resolve(env.MEDIA_UPLOAD_DIR), { maxAge: '30d', immutable: true, index: false }));
  app.use(express.static(pub, {
    index: false,
    maxAge: env.isProd ? '1h' : 0,
    // Code and pages must update the moment a new version is published (e.g. a sign-in change), so the
    // browser re-checks them on every visit; only images keep the 1-hour cache.
    setHeaders: (res, filePath) => {
      if (/\.(js|css|html)$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  // `root` keeps send's dot-file guard to the file's own path (hosts like Netlify unpack under hidden dirs).
  const page = (file) => (_req, res) => res.sendFile(file, { root: pub });
  app.get('/', page('index.html'));
  app.get('/shop', page('shop.html'));
  app.get('/product/:slug', page('product.html'));
  app.get('/cart', page('cart.html'));
  app.get('/checkout', page('checkout.html'));
  app.get('/checkout/dev-pay', (req, res, next) => (env.isProd && !env.PAYMENTS_TEST_MODE ? next() : page('dev-pay.html')(req, res)));
  app.get('/order', page('order.html'));
  app.get(['/login', '/register'], page('login.html'));
  app.get('/account', page('account.html'));
  app.get('/wishlist', page('wishlist.html'));
  app.get(['/about', '/contact', '/faq', '/shipping-policy', '/return-policy', '/privacy-policy', '/terms', '/pages/:slug'], page('page.html'));
  app.get('/admin/login', page('admin/login.html'));
  app.get(['/admin', '/admin/*rest'], page('admin/index.html'));

  app.use((req, res) => res.status(404).sendFile('404.html', { root: pub }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
