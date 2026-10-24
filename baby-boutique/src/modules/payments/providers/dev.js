// DEVELOPMENT-ONLY fake gateway. No money moves. Refused at startup when NODE_ENV=production.
const env = require('../../../config/env');

module.exports = {
  id: 'dev',
  label: 'Test payment (development mode — no real charge)',
  isConfigured: () => !env.isProd,
  async createCheckout({ order, accessToken }) {
    const ref = `dev_${order.number}_${Date.now()}`;
    return { providerRef: ref, redirectUrl: `/checkout/dev-pay?order=${order.number}&token=${encodeURIComponent(accessToken)}&ref=${ref}` };
  },
};
