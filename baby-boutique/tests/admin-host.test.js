const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, prisma, resetDb } = require('./helpers');
const env = require('../src/config/env');

before(async () => { await resetDb(); env.ADMIN_URL = 'http://admin.localhost:3000'; });
after(async () => { delete env.ADMIN_URL; await prisma.$disconnect(); });

const shop = (p) => request(app).get(p).set('Host', 'localhost:3000');
const admin = (p) => request(app).get(p).set('Host', 'admin.localhost:3000');

test('with ADMIN_URL set, the storefront has no admin at all', async () => {
  assert.equal((await shop('/admin')).status, 404);
  assert.equal((await shop('/admin/login')).status, 404);
  assert.equal((await shop('/api/admin/products')).status, 404);
  assert.equal((await shop('/')).status, 200);
});

test('the admin host serves only the admin and its own sign-in page', async () => {
  assert.equal((await admin('/admin/login')).status, 200);
  assert.match((await admin('/admin/login')).text, /Admin sign in/);
  assert.equal((await admin('/admin/')).status, 200); // /admin itself redirects to /admin/ (static dir)
  const home = await admin('/');
  assert.equal(home.status, 302);
  assert.equal(home.headers.location, '/admin');
  assert.equal((await admin('/shop')).headers.location, '/admin');
  assert.match((await admin('/robots.txt')).text, /Disallow: \//);
  assert.equal((await admin('/admin/')).headers['x-robots-tag'], 'noindex, nofollow');
  // customers are still refused by the API itself
  assert.equal((await admin('/api/admin/products')).status, 401);
});

test('CSRF accepts the admin origin and still blocks others', async () => {
  const ok = await request(app).post('/api/auth/login').set('Host', 'admin.localhost:3000').set('Origin', 'http://admin.localhost:3000').send({ email: 'nobody@test.local', password: 'x' });
  assert.equal(ok.status, 401); // reached the login handler, not blocked by CSRF
  const bad = await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'nobody@test.local', password: 'x' });
  assert.equal(bad.status, 403);
});
