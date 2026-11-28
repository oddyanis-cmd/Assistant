// Security regression tests: stock, prices, payments, admin access, rate limits and injection guards.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { authenticator } = require('otplib');
const { agent, prisma, makeUser, makeProduct, resetDb } = require('./helpers');
const { hashPassword } = require('../src/modules/auth/password');
const { applyPaymentResult } = require('../src/modules/orders/service');

before(() => resetDb());
after(() => prisma.$disconnect());

const addr = { fullName: 'A B', phone: '12345678', line1: 'Street 1', city: 'Doha', country: 'QA' };

test('cart refuses zero, negative, fractional and oversized quantities', async () => {
  const a = agent();
  const p = await makeProduct({ stock: 5 });
  for (const quantity of [0, -1, -100, 1.5, 21, '3']) {
    assert.equal((await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity })).status, 400, `qty ${quantity}`);
  }
  assert.equal((await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 6 })).status, 400, 'more than stock');
});

test('stock can never go below zero, even with the database edited directly', async () => {
  const p = await makeProduct({ stock: 1 });
  await assert.rejects(prisma.productVariant.update({ where: { id: p.variants[0].id }, data: { stock: -1 } }));
  const admin = await makeUser('ADMIN');
  const r = await admin.post(`/api/admin/variants/${p.variants[0].id}/adjust`).send({ delta: -5, reason: 'adjustment' });
  assert.equal(r.status, 400);
  assert.equal((await prisma.productVariant.findUnique({ where: { id: p.variants[0].id } })).stock, 1);
});

test('two buyers cannot both get the last item', async () => {
  const p = await makeProduct({ stock: 1 });
  const [a, b] = [agent(), agent()];
  await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 1 });
  await b.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 1 });
  const results = await Promise.all([a, b].map((x) => x.post('/api/checkout').send({ email: 'x@test.local', provider: 'dev', shippingAddress: addr })));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await prisma.productVariant.findUnique({ where: { id: p.variants[0].id } })).stock, 0);
});

test('admin cannot set a free or negative price', async () => {
  const admin = await makeUser('ADMIN');
  for (const basePrice of [0, -10]) {
    assert.equal((await admin.post('/api/admin/products').send({ name: 'Free thing', basePrice })).status, 400, `price ${basePrice}`);
  }
});

test('a payment for the wrong amount or currency never marks the order paid', async () => {
  const a = agent();
  const p = await makeProduct({ stock: 3, price: 10000 });
  await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 1 });
  const co = await a.post('/api/checkout').send({ email: 'pay@test.local', provider: 'dev', shippingAddress: addr });
  const order = await prisma.order.findUnique({ where: { number: co.body.orderNumber }, include: { payments: true } });
  const pay = order.payments[0];
  let o = await applyPaymentResult(pay, { status: 'SUCCEEDED', amount: 1, currency: 'QAR', raw: {} });
  assert.equal(o.status, 'PENDING_PAYMENT', 'underpaid');
  await prisma.payment.update({ where: { id: pay.id }, data: { status: 'PENDING' } });
  o = await applyPaymentResult(pay, { status: 'SUCCEEDED', amount: order.total, currency: 'USD', raw: {} });
  assert.equal(o.status, 'PENDING_PAYMENT', 'wrong currency');
});

test('admins cannot mark an order paid or refunded by hand', async () => {
  const admin = await makeUser('ADMIN');
  const a = agent();
  const p = await makeProduct({ stock: 3 });
  await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 1 });
  const co = await a.post('/api/checkout').send({ email: 'm@test.local', provider: 'dev', shippingAddress: addr });
  const order = await prisma.order.findUnique({ where: { number: co.body.orderNumber } });
  for (const status of ['PAID', 'PROCESSING', 'REFUNDED', 'DELIVERED']) {
    assert.equal((await admin.patch(`/api/admin/orders/${order.id}`).send({ status })).status, 400, status);
  }
});

test('order pages need the secret token; guessing fails', async () => {
  const a = agent();
  const p = await makeProduct({ stock: 3 });
  await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 1 });
  const co = await a.post('/api/checkout').send({ email: 't@test.local', provider: 'dev', shippingAddress: addr });
  assert.equal((await agent().get(`/api/orders/${co.body.orderNumber}?token=wrong`)).status, 403);
  assert.equal((await agent().get(`/api/orders/${co.body.orderNumber}`)).status, 403);
  assert.equal((await agent().get(`/api/orders/${co.body.orderNumber}?token=${co.body.accessToken}`)).status, 200);
});

test('admin needs the authenticator code, not just the password', async () => {
  const email = 'mfa-admin@test.local';
  await prisma.user.create({ data: { email, name: 'Boss', role: 'ADMIN', passwordHash: await hashPassword('Password12345') } });
  const a = agent();
  const login = await a.post('/api/auth/login').send({ email, password: 'Password12345' });
  assert.equal(login.body.mfa.required, true);
  assert.equal((await a.get('/api/admin/products')).status, 401, 'password alone is not enough');
  const setup = await a.post('/api/auth/mfa/setup');
  assert.match(setup.body.qr, /^data:image\/png;base64,/);
  assert.equal((await a.post('/api/auth/mfa/verify').send({ code: '000000' })).status, 401, 'wrong code');
  assert.equal((await a.post('/api/auth/mfa/verify').send({ code: authenticator.generate(setup.body.secret) })).status, 200);
  assert.equal((await a.get('/api/admin/products')).status, 200);
  // Once switched on, nobody can replace the authenticator with their own.
  assert.equal((await a.post('/api/auth/mfa/setup')).status, 409);
  // A new sign-in starts locked again until the code is entered.
  const b = agent();
  await b.post('/api/auth/login').send({ email, password: 'Password12345' });
  assert.equal((await b.get('/api/admin/products')).status, 401);
  // Staff/admin sessions are short (12 hours).
  const s = await prisma.session.findFirst({ where: { user: { email } }, orderBy: { createdAt: 'desc' } });
  assert.ok(s.expiresAt - Date.now() <= 12 * 36e5 + 5000);
});

test('customers cannot reach two-step setup or any admin data', async () => {
  const c = await makeUser('CUSTOMER');
  assert.equal((await c.post('/api/auth/mfa/setup')).status, 400);
  assert.equal((await c.get('/api/admin/orders')).status, 403);
  assert.equal((await c.get('/api/admin/settings')).status, 403);
});

test('settings refuse javascript: links and prototype tricks', async () => {
  const admin = await makeUser('ADMIN');
  const bad = await admin.put('/api/admin/settings/hero').send({ value: { primaryCta: { label: 'x', href: ' JavaScript:alert(1)' } } });
  assert.equal(bad.status, 400);
  const proto = await admin.raw.put('/api/admin/settings/hero').set('X-Requested-With', 'fetch').set('Content-Type', 'application/json').send('{"value":{"__proto__":{"isAdmin":true}}}');
  assert.equal(proto.status, 400);
  assert.equal({}.isAdmin, undefined);
  assert.equal((await admin.post('/api/admin/categories').send({ name: 'Bad', imageUrl: 'javascript:alert(1)' })).status, 400);
});

test('newsletter export cannot smuggle spreadsheet formulas', async () => {
  await prisma.newsletterSubscriber.create({ data: { email: 'x@test.local', consentText: '=HYPERLINK("http://evil")', source: 'footer' } });
  const admin = await makeUser('ADMIN');
  const r = await admin.get('/api/admin/newsletter?format=csv');
  assert.match(r.text, /"'=HYPERLINK/);
});

test('sign-in attempts are limited across server instances (shared counter)', async () => {
  process.env.STRICT_RATE_LIMITS = '1';
  try {
    // A fresh limiter instance stands in for a second server: it must see the same counts.
    const { limiter } = require('../src/lib/rateLimit');
    const express = require('express');
    const request = require('supertest');
    const mk = () => { const app = express(); app.post('/x', limiter({ name: 'probe', windowMs: 60_000, limit: 3 }), (_q, s) => s.send('ok')); return app; };
    const [one, two] = [mk(), mk()];
    const codes = [];
    for (const app of [one, two, one, two]) codes.push((await request(app).post('/x')).status);
    assert.deepEqual(codes, [200, 200, 200, 429]);
  } finally {
    delete process.env.STRICT_RATE_LIMITS;
  }
});

test('an authenticator code cannot be used twice', async () => {
  const email = 'replay-admin@test.local';
  await prisma.user.create({ data: { email, name: 'Boss', role: 'ADMIN', passwordHash: await hashPassword('Password12345') } });
  const a = agent();
  await a.post('/api/auth/login').send({ email, password: 'Password12345' });
  const { body } = await a.post('/api/auth/mfa/setup');
  const code = authenticator.generate(body.secret);
  assert.equal((await a.post('/api/auth/mfa/verify').send({ code })).status, 200);
  const b = agent();
  await b.post('/api/auth/login').send({ email, password: 'Password12345' });
  const again = await b.post('/api/auth/mfa/verify').send({ code });
  assert.equal(again.status, 401, 'a stolen or replayed code is refused');
});

test('security headers are sent and personal data is never cached', async () => {
  const r = await agent().get('/api/auth/me');
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.match(r.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(r.headers['content-security-policy'], /object-src 'none'/);
  assert.match(r.headers['permissions-policy'], /camera=\(\)/);
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['referrer-policy'], 'no-referrer');
  assert.match(r.headers['strict-transport-security'], /max-age=31536000/);
  assert.equal(r.headers['x-powered-by'], undefined);
  assert.match((await agent().get('/.well-known/security.txt')).text, /Contact: mailto:/);
});
