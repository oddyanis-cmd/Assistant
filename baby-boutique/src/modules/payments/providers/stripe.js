// Stripe Checkout (hosted page). Card data never touches our server.
// NOTE: Stripe does not currently onboard merchants registered in Qatar — this adapter is for a
// business entity in a Stripe-supported country (QAR is still a supported presentment currency).
const env = require('../../../config/env');

let client;
function stripe() {
  if (!client) client = require('stripe')(env.STRIPE_SECRET_KEY);
  return client;
}

module.exports = {
  id: 'stripe',
  label: 'Credit / debit card',
  isConfigured: () => Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),

  async createCheckout({ order, lines, returnUrl, cancelUrl }) {
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: order.email,
        client_reference_id: order.id,
        metadata: { orderId: order.id, orderNumber: order.number },
        line_items: [
          ...lines.map((l) => ({
            quantity: l.quantity,
            price_data: {
              currency: order.currency.toLowerCase(),
              unit_amount: l.unitPrice,
              product_data: { name: [l.productName, l.size, l.color].filter(Boolean).join(' · ') },
            },
          })),
          ...(order.shippingFee > 0
            ? [{ quantity: 1, price_data: { currency: order.currency.toLowerCase(), unit_amount: order.shippingFee, product_data: { name: 'Shipping' } } }]
            : []),
        ],
        success_url: `${returnUrl}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      },
      { idempotencyKey: `checkout-${order.id}-${order.updatedAt.getTime()}` },
    );
    return { providerRef: session.id, redirectUrl: session.url };
  },

  async confirmReturn({ payment }) {
    const s = await stripe().checkout.sessions.retrieve(payment.providerRef);
    return {
      status: s.payment_status === 'paid' ? 'SUCCEEDED' : s.status === 'expired' ? 'FAILED' : 'PENDING',
      amount: s.amount_total,
      currency: s.currency?.toUpperCase(),
      raw: { id: s.id, payment_intent: s.payment_intent, payment_status: s.payment_status },
    };
  },

  /** req.body must be the raw Buffer (route uses express.raw). */
  async handleWebhook(req) {
    const event = stripe().webhooks.constructEvent(req.body, req.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
    const s = event.data.object;
    const map = {
      'checkout.session.completed': s.payment_status === 'paid' ? 'SUCCEEDED' : 'PENDING',
      'checkout.session.async_payment_succeeded': 'SUCCEEDED',
      'checkout.session.async_payment_failed': 'FAILED',
      'checkout.session.expired': 'FAILED',
    };
    if (!map[event.type]) return [];
    return [{ eventId: event.id, type: event.type, providerRef: s.id, status: map[event.type], amount: s.amount_total, currency: s.currency?.toUpperCase(), raw: { id: s.id, payment_intent: s.payment_intent } }];
  },

  async refund({ payment, amount }) {
    const s = await stripe().checkout.sessions.retrieve(payment.providerRef);
    return stripe().refunds.create({ payment_intent: s.payment_intent, ...(amount ? { amount } : {}) });
  },
};
