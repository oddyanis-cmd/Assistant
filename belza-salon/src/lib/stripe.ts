/**
 * Stripe lazy client — never instantiated when PAYMENTS_ENABLED is false.
 * Safe to import anywhere; calling getStripe() throws if keys are missing.
 */

import { paymentsEnabled } from './config';

let _stripe: import('stripe').default | null = null;

export function getStripe(): import('stripe').default {
  if (!paymentsEnabled) {
    throw new Error('Payments are not enabled on this instance.');
  }
  if (!_stripe) {
    // Dynamic require prevents import-time crash when STRIPE_SECRET_KEY is absent
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe') as typeof import('stripe').default;
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });
  }
  return _stripe;
}
