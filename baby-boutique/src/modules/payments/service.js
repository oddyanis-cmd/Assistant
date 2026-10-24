const prisma = require('../../lib/prisma');
const env = require('../../config/env');

/** Create a provider checkout for an order and record the pending Payment. */
async function startPayment({ order, lines, provider, accessToken }) {
  const q = `order=${encodeURIComponent(order.number)}&token=${encodeURIComponent(accessToken)}`;
  const returnUrl = `${env.APP_URL}/checkout/return?provider=${provider.id}&${q}`;
  const cancelUrl = `${env.APP_URL}/order?${q}&cancelled=1`;
  const { providerRef, redirectUrl } = await provider.createCheckout({ order, lines, returnUrl, cancelUrl, accessToken });
  await prisma.payment.create({
    data: { orderId: order.id, provider: provider.id, providerRef, amount: order.total, currency: order.currency },
  });
  await prisma.order.update({ where: { id: order.id }, data: { paymentProvider: provider.id } });
  return { redirectUrl };
}

module.exports = { startPayment };
