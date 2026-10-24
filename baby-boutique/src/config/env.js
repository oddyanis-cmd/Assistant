// Centralised, validated environment config. Never hardcode secrets — everything comes from env.
require('dotenv').config();
const { z } = require('zod');

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  SESSION_TTL_DAYS: z.coerce.number().default(14),
  COOKIE_SECURE: bool,
  TRUST_PROXY: bool,

  // Payments: comma-separated list of enabled providers, in display order.
  // "dev" is a clearly-labelled fake provider that is refused in production.
  PAYMENT_PROVIDERS: z.string().default('dev'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  /// PayPal does not settle QAR; charge in this currency, converted at PAYPAL_FX_RATE (1 QAR = x).
  PAYPAL_CURRENCY: z.string().default('USD'),
  PAYPAL_FX_RATE: z.coerce.number().default(0.2747),

  // Media storage: "local" (dev only) or "cloudinary"
  MEDIA_PROVIDER: z.enum(['local', 'cloudinary']).default('local'),
  CLOUDINARY_URL: z.string().optional(),
  MEDIA_UPLOAD_DIR: z.string().default('uploads'),

  // Bootstrap admin used by the seed script
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const env = parsed.data;
env.isProd = env.NODE_ENV === 'production';
env.paymentProviders = env.PAYMENT_PROVIDERS.split(',').map((s) => s.trim()).filter(Boolean);

if (env.isProd && env.paymentProviders.includes('dev')) {
  console.error('Refusing to start: the "dev" payment provider must not be enabled in production.');
  process.exit(1);
}
if (env.isProd && env.MEDIA_PROVIDER === 'local') {
  console.warn('[warn] MEDIA_PROVIDER=local in production — use cloudinary/S3 object storage.');
}

module.exports = env;
