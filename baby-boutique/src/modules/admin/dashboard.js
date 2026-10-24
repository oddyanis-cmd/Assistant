const { Router } = require('express');
const { z } = require('zod');
const prisma = require('../../lib/prisma');
const { parse } = require('../../lib/validate');

const router = Router();
const PAID = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

router.get('/dashboard', async (req, res) => {
  const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }), req.query);
  const since = new Date(Date.now() - days * 864e5);
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

  const [revenue, today, pending, toFulfil, lowStock, topItems, funnel, daily, customers, subscribers, pendingReviews] = await Promise.all([
    prisma.order.aggregate({ where: { status: { in: PAID }, paidAt: { gte: since } }, _sum: { total: true }, _count: true }),
    prisma.order.aggregate({ where: { status: { in: PAID }, paidAt: { gte: startOfToday } }, _sum: { total: true }, _count: true }),
    prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
    prisma.order.count({ where: { status: { in: ['PAID', 'PROCESSING'] } } }),
    prisma.$queryRaw`SELECT v.id, v.sku, v.size, v.color, v.stock, v."lowStockThreshold", p.name, p.id AS "productId"
                     FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
                     WHERE v."isActive" AND p.status = 'PUBLISHED' AND v.stock <= v."lowStockThreshold"
                     ORDER BY v.stock ASC LIMIT 20`,
    prisma.$queryRaw`SELECT oi."productName" AS name, SUM(oi.quantity)::int AS units, SUM(oi.quantity * oi."unitPrice")::int AS revenue
                     FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
                     WHERE o.status::text = ANY(${PAID}) AND o."paidAt" >= ${since}
                     GROUP BY oi."productName" ORDER BY units DESC LIMIT 10`,
    prisma.analyticsEvent.groupBy({ by: ['type'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.$queryRaw`SELECT to_char(date_trunc('day', "paidAt"), 'YYYY-MM-DD') AS day, SUM(total)::int AS revenue, COUNT(*)::int AS orders
                     FROM "Order" WHERE status::text = ANY(${PAID}) AND "paidAt" >= ${since}
                     GROUP BY 1 ORDER BY 1`,
    prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: since } } }),
    prisma.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    prisma.review.count({ where: { status: 'PENDING' } }),
  ]);

  const f = Object.fromEntries(funnel.map((r) => [r.type, r._count._all]));
  const visitors = await prisma.analyticsEvent.findMany({ where: { createdAt: { gte: since }, type: 'page_view' }, distinct: ['visitorId'], select: { visitorId: true } });

  res.json({
    periodDays: days,
    revenue: { total: revenue._sum.total ?? 0, orders: revenue._count, averageOrderValue: revenue._count ? Math.round((revenue._sum.total ?? 0) / revenue._count) : 0 },
    today: { revenue: today._sum.total ?? 0, orders: today._count },
    pendingPayment: pending,
    toFulfil,
    newCustomers: customers,
    subscribers,
    pendingReviews,
    lowStock,
    topProducts: topItems,
    daily,
    funnel: {
      visitors: visitors.length,
      pageViews: f.page_view ?? 0,
      productViews: f.product_view ?? 0,
      addToCart: f.add_to_cart ?? 0,
      checkoutStart: f.checkout_start ?? 0,
      purchases: f.purchase ?? 0,
      conversionRate: visitors.length ? Math.round(((f.purchase ?? 0) / visitors.length) * 10000) / 100 : 0,
    },
  });
});

module.exports = { router };
