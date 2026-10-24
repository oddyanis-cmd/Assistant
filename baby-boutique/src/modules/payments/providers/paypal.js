// PayPal Checkout via the official Orders v2 REST API (redirect/approve flow).
// PayPal does not support QAR as a transaction currency, so orders are charged in PAYPAL_CURRENCY
// (default USD) using the configured PAYPAL_FX_RATE; the QAR total is shown to the customer first.
const env = require('../../../config/env');

const base = () => (env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');

let tokenCache = { token: null, exp: 0 };
async function accessToken() {
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const r = await fetch(`${base()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error(`PayPal auth failed: ${r.status}`);
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return j.access_token;
}

async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`PayPal ${method} ${path} failed: ${r.status}`), { details: j });
  return j;
}

/** QAR minor units -> PayPal currency string amount */
function convert(minorQar) {
  return ((minorQar / 100) * env.PAYPAL_FX_RATE).toFixed(2);
}

module.exports = {
  id: 'paypal',
  label: 'PayPal',
  isConfigured: () => Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET),
  convert,

  async createCheckout({ order, returnUrl, cancelUrl }) {
    const j = await api('/v2/checkout/orders', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `order-${order.id}-${order.updatedAt.getTime()}` },
      body: {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: order.id,
          custom_id: order.number,
          description: `Order ${order.number}`,
          amount: { currency_code: env.PAYPAL_CURRENCY, value: convert(order.total) },
        }],
        payment_source: {
          paypal: {
            experience_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING' },
          },
        },
      },
    });
    const approve = j.links.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
    return { providerRef: j.id, redirectUrl: approve.href };
  },

  /** Customer approved on PayPal and was sent back: capture server-side. */
  async confirmReturn({ payment, order }) {
    let j = await api(`/v2/checkout/orders/${payment.providerRef}`);
    if (j.status === 'APPROVED') {
      j = await api(`/v2/checkout/orders/${payment.providerRef}/capture`, {
        method: 'POST',
        headers: { 'PayPal-Request-Id': `capture-${payment.id}` },
      });
    }
    const capture = j.purchase_units?.[0]?.payments?.captures?.[0];
    const ok = j.status === 'COMPLETED' && capture?.status === 'COMPLETED' && capture.amount.value === convert(order.total);
    return {
      status: ok ? 'SUCCEEDED' : capture?.status === 'DECLINED' ? 'FAILED' : 'PENDING',
      amount: ok ? order.total : null, // verified against the converted total above
      currency: order.currency,
      raw: { id: j.id, status: j.status, captureId: capture?.id },
    };
  },

  async handleWebhook(req) {
    if (!env.PAYPAL_WEBHOOK_ID) throw new Error('PAYPAL_WEBHOOK_ID not set');
    const event = JSON.parse(req.body.toString('utf8'));
    const v = await api('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: {
        auth_algo: req.get('paypal-auth-algo'),
        cert_url: req.get('paypal-cert-url'),
        transmission_id: req.get('paypal-transmission-id'),
        transmission_sig: req.get('paypal-transmission-sig'),
        transmission_time: req.get('paypal-transmission-time'),
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      },
    });
    if (v.verification_status !== 'SUCCESS') throw Object.assign(new Error('Invalid PayPal signature'), { status: 400 });
    const r = event.resource;
    const orderId = r?.supplementary_data?.related_ids?.order_id;
    const map = { 'PAYMENT.CAPTURE.COMPLETED': 'SUCCEEDED', 'PAYMENT.CAPTURE.DENIED': 'FAILED', 'PAYMENT.CAPTURE.REFUNDED': 'REFUNDED' };
    if (!map[event.event_type] || !orderId) return [];
    return [{ eventId: event.id, type: event.event_type, providerRef: orderId, status: map[event.event_type], amountInProviderCurrency: r.amount?.value, raw: { captureId: r.id } }];
  },
};
