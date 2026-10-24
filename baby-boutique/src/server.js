const env = require('./config/env');
const prisma = require('./lib/prisma');
const { createApp } = require('./app');
const { expirePendingOrders } = require('./modules/orders/service');

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`Boutique running on ${env.APP_URL} (port ${env.PORT}) — payments: ${env.paymentProviders.join(', ')}, media: ${env.MEDIA_PROVIDER}`);
});

// Release stock held by abandoned checkouts. For multi-instance deployments run this from a single
// scheduled job instead (see README).
const timer = setInterval(() => {
  expirePendingOrders()
    .then((n) => n && console.log(`expired ${n} unpaid order(s)`))
    .catch((e) => console.error('expire job', e));
  prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
}, 5 * 60_000);

async function shutdown() {
  clearInterval(timer);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
