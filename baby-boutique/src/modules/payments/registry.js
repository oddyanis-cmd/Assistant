const env = require('../../config/env');

const ALL = {
  dev: require('./providers/dev'),
  stripe: require('./providers/stripe'),
  paypal: require('./providers/paypal'),
};

/** Providers that are both enabled in PAYMENT_PROVIDERS and have credentials. */
function enabledProviders() {
  return env.paymentProviders.map((id) => ALL[id]).filter((p) => p && p.isConfigured());
}

function getProvider(id) {
  const p = enabledProviders().find((x) => x.id === id);
  return p ?? null;
}

module.exports = { enabledProviders, getProvider, ALL };
