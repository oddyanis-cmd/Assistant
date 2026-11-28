// Runs every 5 minutes (UTC): releases stock held by abandoned checkouts, removes expired sessions
// and old rate-limit counters. Replaces the timer that src/server.js runs on a normal server.
import '../deps.mjs'; // ships every runtime package with the function
import prismaModule from '../../src/lib/prisma.js';
import ordersModule from '../../src/modules/orders/service.js';
import rateLimitModule from '../../src/lib/rateLimit.js';

export default async () => {
  const n = await ordersModule.expirePendingOrders();
  const { count } = await prismaModule.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await rateLimitModule.purgeExpired();
  console.log(`housekeeping: expired ${n || 0} unpaid order(s), removed ${count} session(s)`);
};

export const config = { schedule: '*/5 * * * *' };
