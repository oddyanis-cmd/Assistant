// DEVELOPMENT-ONLY fake gateway. No money moves. Refused at startup when NODE_ENV=production.
const env = require('../../../config/env');

module.exports = {
  id: 'dev',
  label: 'Test payment (no real charge)',
  // Development, or a production TEST website with PAYMENTS_TEST_MODE=true.
  isConfigured: () => !env.isProd || env.PAYMENTS_TEST_MODE,
  async createCheckout({ order, accessToken }) {
    const ref = `dev_${order.number}_${Date.now()}`;
    return { providerRef: ref, redirectUrl: `/checkout/dev-pay?order=${order.number}&token=${encodeURIComponent(accessToken)}&ref=${ref}` };
  },
};
