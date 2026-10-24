// Test harness: runs against DATABASE_URL_TEST (a throwaway database), never the dev database.
const path = require('node:path');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || 'postgresql://boutique:boutique@localhost:5432/boutique_test?schema=public';
process.env.APP_URL = 'http://localhost:3000';
process.env.PAYMENT_PROVIDERS = 'dev';
process.env.MEDIA_PROVIDER = 'local';
process.env.MEDIA_UPLOAD_DIR = path.join(__dirname, '.uploads');

const { execSync } = require('node:child_process');
const request = require('supertest');

// Safety guard: the suite wipes tables, so it only ever runs against a database named *_test.
const dbName = new URL(process.env.DATABASE_URL).pathname.slice(1);
if (!dbName.endsWith('_test')) throw new Error(`Refusing to run tests against non-test database "${dbName}"`);
execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env, cwd: path.join(__dirname, '..') });

const prisma = require('../src/lib/prisma');

/** Empty every table (fast, keeps the schema). Called once per test file. */
async function resetDb() {
  const rows = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
}
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/modules/auth/password');
const app = createApp();

/** supertest agent that keeps cookies and sends the CSRF header. */
function agent() {
  const a = request.agent(app);
  const wrap = (m) => (url) => a[m](url).set('X-Requested-With', 'fetch');
  return { get: wrap('get'), post: wrap('post'), patch: wrap('patch'), put: wrap('put'), delete: wrap('delete'), raw: a };
}

async function makeUser(role = 'CUSTOMER', email = `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`) {
  const password = 'Password12345';
  await prisma.user.create({ data: { email, name: `${role} User`, role, passwordHash: await hashPassword(password) } });
  const a = agent();
  const r = await a.post('/api/auth/login').send({ email, password });
  if (r.status !== 200) throw new Error(`login failed ${r.status}`);
  return a;
}

async function makeProduct({ stock = 5, price = 10000, status = 'PUBLISHED', personal = false } = {}) {
  const slug = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return prisma.product.create({
    data: {
      name: `Test ${slug}`, slug, status, basePrice: price, publishedAt: new Date(), isPersonalizable: personal,
      variants: { create: [{ sku: `SKU-${slug}`, size: '0–3 months', color: 'Ivory', stock }] },
    },
    include: { variants: true },
  });
}

module.exports = { app, agent, prisma, makeUser, makeProduct, request, resetDb };
