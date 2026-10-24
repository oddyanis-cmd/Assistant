const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { agent, prisma, makeUser, makeProduct, resetDb } = require('./helpers');
const { expirePendingOrders } = require('../src/modules/orders/service');

const address = { fullName: 'Test Parent', phone: '+97455555555', line1: 'Building 1, Street 2', city: 'Doha', country: 'QA' };

before(() => resetDb());
after(() => prisma.$disconnect());

test('catalog hides drafts and filters by size/price', async () => {
  const a = agent();
  const pub = await makeProduct({ price: 5000 });
  const draft = await makeProduct({ status: 'DRAFT' });
  const list = await a.get('/api/products?pageSize=48');
  const slugs = list.body.items.map((p) => p.slug);
  assert.ok(slugs.includes(pub.slug));
  assert.ok(!slugs.includes(draft.slug));
  assert.equal((await a.get(`/api/products/${draft.slug}`)).status, 404);
  const cheap = await a.get('/api/products?maxPrice=60&size=0–3 months');
  assert.ok(cheap.body.items.some((p) => p.slug === pub.slug));
  const pricey = await a.get('/api/products?minPrice=60');
  assert.ok(!pricey.body.items.some((p) => p.slug === pub.slug));
});

test('guest cart → checkout → dev payment marks order PAID and reserves stock', async () => {
  const a = agent();
  const p = await makeProduct({ stock: 3, price: 12000 });
  const v = p.variants[0];
  const add = await a.post('/api/cart/items').send({ variantId: v.id, quantity: 2 });
  assert.equal(add.status, 201);
  assert.equal(add.body.cart.itemCount, 2);
  // second add in the same guest session must reuse the same cart
  await a.post('/api/cart/items').send({ variantId: v.id, quantity: 1 });
  const cart = (await a.get('/api/cart')).body.cart;
  assert.equal(cart.lines.length, 1);
  assert.equal(cart.lines[0].quantity, 3);
  assert.equal(cart.subtotal, 36000);
  assert.equal(cart.shippingFee, 0, 'free delivery over 300 QAR');

  const co = await a.post('/api/checkout').send({ email: 'guest@test.local', provider: 'dev', shippingAddress: address });
  assert.equal(co.status, 201, JSON.stringify(co.body));
  assert.match(co.body.redirectUrl, /^\/checkout\/dev-pay/);
  assert.equal((await prisma.productVariant.findUnique({ where: { id: v.id } })).stock, 0, 'stock reserved');
  assert.equal((await a.get('/api/cart')).body.cart.lines.length, 0, 'cart cleared');

  const ref = new URL(co.body.redirectUrl, 'http://x').searchParams.get('ref');
  // wrong token is rejected
  const bad = await a.post('/api/payments/dev/complete').send({ order: co.body.orderNumber, token: 'nope', ref, outcome: 'success' });
  assert.equal(bad.status, 403);
  const pay = await a.post('/api/payments/dev/complete').send({ order: co.body.orderNumber, token: co.body.accessToken, ref, outcome: 'success' });
  assert.equal(pay.body.status, 'PAID');
  // idempotent
  await a.post('/api/payments/dev/complete').send({ order: co.body.orderNumber, token: co.body.accessToken, ref, outcome: 'success' });
  const prod = await prisma.product.findUnique({ where: { id: p.id } });
  assert.equal(prod.salesCount, 3, 'sales counted once');

  // guest can view with token, stranger cannot
  assert.equal((await a.get(`/api/orders/${co.body.orderNumber}?token=${co.body.accessToken}`)).body.order.status, 'PAID');
  assert.equal((await agent().get(`/api/orders/${co.body.orderNumber}`)).status, 403);
});

test('cannot add more than stock, and prices come from the server', async () => {
  const a = agent();
  const p = await makeProduct({ stock: 1, price: 9900 });
  const r = await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 2 });
  assert.equal(r.status, 400);
  const ok = await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 1, unitPrice: 1 });
  assert.equal(ok.body.cart.lines[0].unitPrice, 9900);
});

test('concurrent checkouts cannot oversell the last item', async () => {
  const p = await makeProduct({ stock: 1 });
  const a = agent();
  const b = agent();
  await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 1 });
  await b.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 1 });
  const [r1, r2] = await Promise.all([
    a.post('/api/checkout').send({ email: 'a@test.local', provider: 'dev', shippingAddress: address }),
    b.post('/api/checkout').send({ email: 'b@test.local', provider: 'dev', shippingAddress: address }),
  ]);
  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, [201, 409]);
  assert.equal((await prisma.productVariant.findUnique({ where: { id: p.variants[0].id } })).stock, 0);
});

test('expired unpaid orders release their stock exactly once', async () => {
  const a = agent();
  const p = await makeProduct({ stock: 2 });
  await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 2 });
  const co = await a.post('/api/checkout').send({ email: 'slow@test.local', provider: 'dev', shippingAddress: address });
  await prisma.order.updateMany({ where: { number: co.body.orderNumber }, data: { createdAt: new Date(Date.now() - 2 * 3600e3) } });
  await expirePendingOrders();
  await expirePendingOrders();
  const order = await prisma.order.findUnique({ where: { number: co.body.orderNumber } });
  assert.equal(order.status, 'CANCELLED');
  assert.equal((await prisma.productVariant.findUnique({ where: { id: p.variants[0].id } })).stock, 2);
});

test('shipping country outside the allowed list is rejected', async () => {
  const a = agent();
  const p = await makeProduct();
  await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 1 });
  const r = await a.post('/api/checkout').send({ email: 'x@test.local', provider: 'dev', shippingAddress: { ...address, country: 'US' } });
  assert.equal(r.status, 400);
  assert.equal((await prisma.productVariant.findUnique({ where: { id: p.variants[0].id } })).stock, 5);
});

test('guest cart merges into the account on login', async () => {
  const p = await makeProduct();
  const email = `merge-${Date.now()}@test.local`;
  const a = agent();
  await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 1 });
  const reg = await a.post('/api/auth/register').send({ name: 'Merge Me', email, password: 'Password12345' });
  assert.equal(reg.status, 201);
  const cart = (await a.get('/api/cart')).body.cart;
  assert.equal(cart.itemCount, 1);
});

test('reviews need moderation before they are public', async () => {
  const c = await makeUser('CUSTOMER');
  const admin = await makeUser('ADMIN');
  const p = await makeProduct();
  const r = await c.post(`/api/products/${p.slug}/reviews`).send({ rating: 5, body: 'Beautiful and so soft!' });
  assert.equal(r.status, 201);
  assert.equal((await agent().get(`/api/products/${p.slug}/reviews`)).body.total, 0);
  await admin.patch(`/api/admin/reviews/${r.body.review.id}`).send({ status: 'APPROVED' });
  assert.equal((await agent().get(`/api/products/${p.slug}/reviews`)).body.total, 1);
});

test('newsletter requires explicit consent and stores the consent text', async () => {
  const a = agent();
  assert.equal((await a.post('/api/newsletter').send({ email: 'n@test.local', consent: false })).status, 400);
  assert.equal((await a.post('/api/newsletter').send({ email: 'n@test.local', consent: true })).status, 201);
  const sub = await prisma.newsletterSubscriber.findUnique({ where: { email: 'n@test.local' } });
  assert.ok(sub.consentText.length > 10);
});
