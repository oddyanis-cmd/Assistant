// Scheduled every 5 minutes (see netlify.toml): releases stock held by abandoned checkouts and
// removes expired sessions. Replaces the timer that src/server.js runs on a normal server.
const prisma = require('../../src/lib/prisma');
const { expirePendingOrders } = require('../../src/modules/orders/service');

exports.handler = async () => {
  const n = await expirePendingOrders();
  const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  console.log(`housekeeping: expired ${n || 0} unpaid order(s), removed ${count} session(s)`);
  return { statusCode: 200 };
};
