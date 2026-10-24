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
          upgradeInsecureRequests: env.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());

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
  const pub = path.join(__dirname, '..', 'public');
  app.use('/uploads', express.static(path.resolve(env.MEDIA_UPLOAD_DIR), { maxAge: '30d', immutable: true, index: false }));
  app.use(express.static(pub, { index: false, maxAge: env.isProd ? '1h' : 0 }));

  const page = (file) => (_req, res) => res.sendFile(path.join(pub, file));
  app.get('/', page('index.html'));
  app.get('/shop', page('shop.html'));
  app.get('/product/:slug', page('product.html'));
  app.get('/cart', page('cart.html'));
  app.get('/checkout', page('checkout.html'));
  app.get('/checkout/dev-pay', (req, res, next) => (env.isProd ? next() : page('dev-pay.html')(req, res)));
  app.get('/order', page('order.html'));
  app.get(['/login', '/register'], page('login.html'));
  app.get('/account', page('account.html'));
  app.get('/wishlist', page('wishlist.html'));
  app.get(['/about', '/contact', '/faq', '/shipping-policy', '/return-policy', '/privacy-policy', '/terms', '/pages/:slug'], page('page.html'));
  app.get(['/admin', '/admin/*rest'], page('admin/index.html'));

  app.use((req, res) => res.status(404).sendFile(path.join(pub, '404.html')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
