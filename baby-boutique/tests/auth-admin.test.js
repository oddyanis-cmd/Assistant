const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { agent, prisma, makeUser, makeProduct, resetDb } = require('./helpers');

before(() => resetDb());
after(() => prisma.$disconnect());

test('register validates password strength; passwords are stored as argon2id', async () => {
  const a = agent();
  const weak = await a.post('/api/auth/register').send({ name: 'Weak', email: 'weak@test.local', password: 'short' });
  assert.equal(weak.status, 400);
  const ok = await a.post('/api/auth/register').send({ name: 'Strong', email: 'Strong@Test.local', password: 'GoodPassword123' });
  assert.equal(ok.status, 201);
  const cookie = ok.headers['set-cookie'].find((c) => c.startsWith('sid='));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const u = await prisma.user.findUnique({ where: { email: 'strong@test.local' } });
  assert.match(u.passwordHash, /^\$argon2id\$/);
  // session row stores only a hash of the cookie token
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal(await prisma.session.count({ where: { id: token } }), 0);
});

test('login locks the account after repeated failures', async () => {
  const a = agent();
  await a.post('/api/auth/register').send({ name: 'Lock', email: 'lock@test.local', password: 'GoodPassword123' });
  await a.post('/api/auth/logout');
  for (let i = 0; i < 5; i++) await a.post('/api/auth/login').send({ email: 'lock@test.local', password: 'wrong-password' });
  const r = await a.post('/api/auth/login').send({ email: 'lock@test.local', password: 'GoodPassword123' });
  assert.equal(r.status, 401);
  assert.match(r.body.error, /locked/i);
});

test('role-based access: customers blocked, staff limited, admin full', async () => {
  const customer = await makeUser('CUSTOMER');
  const staff = await makeUser('STAFF');
  const admin = await makeUser('ADMIN');
  assert.equal((await customer.get('/api/admin/products')).status, 403);
  assert.equal((await staff.get('/api/admin/products')).status, 200);
  assert.equal((await staff.get('/api/admin/settings')).status, 403);
  assert.equal((await staff.get('/api/admin/customers')).status, 403);
  assert.equal((await admin.get('/api/admin/settings')).status, 200);
  assert.equal((await admin.get('/api/admin/dashboard')).status, 200);
});

test('admin product lifecycle: create, variants, stock ledger, publish', async () => {
  const admin = await makeUser('ADMIN');
  const c = await admin.post('/api/admin/products').send({ name: 'Admin Made Hat', basePrice: 79.5, status: 'DRAFT' });
  assert.equal(c.status, 201);
  assert.equal(c.body.product.basePrice, 7950);
  assert.equal(c.body.product.slug, 'admin-made-hat');
  const id = c.body.product.id;
  const g = await admin.post(`/api/admin/products/${id}/variants/generate`).send({ sizes: ['Newborn', '0–3 months'], colors: [{ name: 'Ivory', hex: '#F5EFE6' }, { name: 'Sage' }], stock: 4 });
  assert.equal(g.body.created.length, 4);
  const v = g.body.created[0];
  const adj = await admin.post(`/api/admin/variants/${v.id}/adjust`).send({ delta: -10, reason: 'adjustment' });
  assert.equal(adj.status, 400, 'cannot go below zero');
  await admin.post(`/api/admin/variants/${v.id}/adjust`).send({ delta: 3, reason: 'restock' });
  const moves = (await admin.get(`/api/admin/variants/${v.id}/movements`)).body.movements;
  assert.deepEqual(moves.map((m) => m.delta).sort(), [3, 4]);
  const pub = await admin.patch(`/api/admin/products/${id}`).send({ status: 'PUBLISHED' });
  assert.ok(pub.body.product.publishedAt);
  assert.equal(pub.body.product.basePrice, 7950, 'partial update keeps price');
  assert.equal((await agent().get('/api/products/admin-made-hat')).status, 200);
});

test('image upload: real images processed into 3 sizes, non-images rejected, metadata stripped', async () => {
  const admin = await makeUser('ADMIN');
  const p = await makeProduct();
  const png = await sharp({ create: { width: 2400, height: 3000, channels: 3, background: '#EDE2D4' } })
    .withMetadata({ exif: { IFD0: { Copyright: 'secret-location' } } }).jpeg().toBuffer();
  const up = await admin.raw.post(`/api/admin/products/${p.id}/images`).set('X-Requested-With', 'fetch')
    .attach('images', png, 'photo.jpg')
    .attach('images', Buffer.from('<?php echo 1; ?>'), { filename: 'evil.jpg', contentType: 'image/jpeg' });
  assert.equal(up.status, 201);
  assert.equal(up.body.results[0].ok, true);
  assert.equal(up.body.results[1].ok, false, 'fake image rejected');
  const img = up.body.results[0].image;
  assert.ok(img.width <= 2000 && img.height <= 2000);
  assert.ok(img.isFeatured, 'first image is featured');
  const res = await agent().raw.get(img.url);
  assert.equal(res.status, 200);
  const meta = await sharp(res.body).metadata();
  assert.equal(meta.exif, undefined, 'EXIF stripped');

  // reorder + delete
  const up2 = await admin.raw.post(`/api/admin/products/${p.id}/images`).set('X-Requested-With', 'fetch').attach('images', png, 'b.jpg');
  const second = up2.body.results[0].image;
  assert.equal((await admin.put(`/api/admin/products/${p.id}/images/order`).send({ ids: [second.id, img.id] })).status, 200);
  await admin.delete(`/api/admin/images/${img.id}`);
  const left = await prisma.productImage.findMany({ where: { productId: p.id } });
  assert.equal(left.length, 1);
  assert.equal(left[0].isFeatured, true, 'featured flag moves to the remaining image');
});

test('upload size limit comes from admin settings', async () => {
  const admin = await makeUser('ADMIN');
  const p = await makeProduct();
  const cur = (await admin.get('/api/admin/settings')).body.settings.media;
  await admin.put('/api/admin/settings/media').send({ value: { ...cur, maxFileSizeMb: 0.1 } });
  const big = await sharp({ create: { width: 1500, height: 1500, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 60 } } }).png().toBuffer();
  const r = await admin.raw.post(`/api/admin/products/${p.id}/images`).set('X-Requested-With', 'fetch').attach('images', big, 'big.png');
  assert.equal(r.status, 413);
  await admin.put('/api/admin/settings/media').send({ value: cur });
});

test('settings are validated and appear on the public settings endpoint', async () => {
  const admin = await makeUser('ADMIN');
  assert.equal((await admin.put('/api/admin/settings/hero').send({ value: 'nope' })).status, 400);
  const hero = (await admin.get('/api/admin/settings')).body.settings.hero;
  await admin.put('/api/admin/settings/hero').send({ value: { ...hero, headline: 'Tiny Knits' } });
  assert.equal((await agent().get('/api/settings')).body.settings.hero.headline, 'Tiny Knits');
});

test('order status transitions are enforced; cancelling restocks', async () => {
  const admin = await makeUser('ADMIN');
  const staff = await makeUser('STAFF');
  const a = agent();
  const p = await makeProduct({ stock: 2 });
  await a.post('/api/cart/items').send({ variantId: p.variants[0].id, quantity: 2 });
  const co = await a.post('/api/checkout').send({ email: 'o@test.local', provider: 'dev', shippingAddress: { fullName: 'A B', phone: '12345678', line1: 'Street 1', city: 'Doha', country: 'QA' } });
  const ref = new URL(co.body.redirectUrl, 'http://x').searchParams.get('ref');
  await a.post('/api/payments/dev/complete').send({ order: co.body.orderNumber, token: co.body.accessToken, ref, outcome: 'success' });
  const order = await prisma.order.findUnique({ where: { number: co.body.orderNumber } });
  assert.equal((await staff.patch(`/api/admin/orders/${order.id}`).send({ status: 'DELIVERED' })).status, 400, 'cannot skip to delivered');
  assert.equal((await staff.patch(`/api/admin/orders/${order.id}`).send({ status: 'PROCESSING' })).status, 200);
  assert.equal((await staff.patch(`/api/admin/orders/${order.id}`).send({ status: 'REFUNDED' })).status, 400, 'staff cannot refund');
  assert.equal((await admin.patch(`/api/admin/orders/${order.id}`).send({ status: 'CANCELLED' })).status, 200);
  assert.equal((await prisma.productVariant.findUnique({ where: { id: p.variants[0].id } })).stock, 2);
});

test('webhook endpoint for unconfigured provider is not exposed', async () => {
  const r = await agent().raw.post('/api/webhooks/stripe').send('{}');
  assert.equal(r.status, 404);
});
