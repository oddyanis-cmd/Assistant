/**
 * Payment provider contract. Every adapter exports an object with:
 *
 *   id            string                 "stripe" | "paypal" | "dev" | ...
 *   label         string                 shown to the customer
 *   isConfigured  () => boolean          credentials present?
 *   createCheckout({ order, lines, returnUrl, cancelUrl })
 *                 => { providerRef, redirectUrl }
 *   confirmReturn({ order, payment, query })        // optional: called when the customer comes back
 *                 => { status: 'SUCCEEDED'|'PENDING'|'FAILED', amount, raw }
 *   handleWebhook(req) => [{ providerRef, status, amount, eventId, type, raw }]   // optional
 *   refund({ payment, amount })                       // optional
 *
 * Adding a regional gateway (e.g. Tap, SkipCash, MyFatoorah, QPay) means writing one more adapter
 * that satisfies this contract and listing it in PAYMENT_PROVIDERS — no changes to orders/checkout.
 */
module.exports = {};
