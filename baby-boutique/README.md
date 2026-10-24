# Handmade Baby Boutique (working name: "Little Stitches")

E-commerce platform for handmade knitted/crocheted baby clothes, accessories and dolls.
Customer storefront + secure accounts + payments + an admin dashboard. Default currency **QAR**, built for Qatar
first with international expansion in mind.

**Stack:** Node.js 20+ · Express 5 · PostgreSQL · Prisma 6 · vanilla HTML/CSS/JS (ES modules, no build step) ·
Argon2id · Stripe Checkout / PayPal Orders v2 adapters · Cloudinary (or local disk in dev) · sharp.

---

## Quick start (development)

```bash
cd baby-boutique
cp .env.example .env          # set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npm install                   # also runs `prisma generate`
npx prisma migrate deploy     # create tables
npm run db:seed               # admin user, categories, size guide, policy pages, 12 sample products
npm run dev                   # http://localhost:3000   ·   admin: http://localhost:3000/admin
```

Tests (need a separate database whose name ends in `_test`; the suite refuses to run on any other):

```bash
DATABASE_URL_TEST="postgresql://USER:PASS@localhost:5432/boutique_test" npm test
```

18 integration tests cover: catalogue filters & draft hiding, guest cart → checkout → payment → PAID, idempotent
payment handling, concurrent-checkout oversell protection, stock release on expiry/cancel, guest-cart merge on login,
review moderation, newsletter consent, Argon2id + HttpOnly cookies, login lockout, role-based access, admin product /
variant / inventory-ledger lifecycle, image validation (fake images rejected, EXIF stripped, size limit from settings),
settings validation, and order-status transition rules.

---

## ⚠️ Payments in Qatar — read before going live

Checked October 2026 (verify again on the providers' own pages before signing up):

| Provider | Qatar-registered merchant? | Notes |
|---|---|---|
| **Stripe** | **No.** Qatar is not on Stripe's supported-countries list. | Only works if the business has an entity + bank account in a supported country (e.g. UAE, UK, US). QAR *is* supported as a charge currency. |
| **PayPal** | Accounts can be opened in Qatar, but merchant features & withdrawal to local banks are limited/unclear. | PayPal **cannot charge in QAR** → the adapter charges in `PAYPAL_CURRENCY` (default USD) at `PAYPAL_FX_RATE`. |
| **Local gateways** (Tap Payments, SkipCash, MyFatoorah, QPay/NAPS, Dibsy) | Yes — built for Qatar, support QAR, NAPS debit cards, Apple Pay. | **Recommended for launch.** Not implemented yet — each is one new adapter file (see below). |

Because of this the code uses **payment-provider adapters** (`src/modules/payments/providers/`):

- `dev` — **clearly labelled fake gateway** for development ("Test payment — no real charge"). The server
  **refuses to start** if it is enabled with `NODE_ENV=production`.
- `stripe` — Stripe Checkout (hosted page, card data never touches our server), webhook signature verification, refunds.
- `paypal` — PayPal Orders v2 (redirect/approve → server-side capture), webhook signature verification via PayPal's API,
  amount verified after currency conversion.

A provider only appears at checkout if it is listed in `PAYMENT_PROVIDERS` **and** its credentials are set.
To add Tap/SkipCash/etc., create `providers/<name>.js` implementing the contract documented in
`providers/base.js` and register it in `payments/registry.js` — orders/checkout code does not change.

**Webhooks:** `POST /api/webhooks/stripe` and `POST /api/webhooks/paypal` (raw body, signature-verified, idempotent
via the `WebhookEvent` table). Payment status is also confirmed server-side when the customer returns
(`/checkout/return`), so either path can mark an order PAID, exactly once.

---

## Architecture

```
src/
  config/env.js            validated env (zod); refuses unsafe production config
  app.js / server.js       Express wiring, security headers (strict CSP), static pages, expiry job
  middleware/              session loader + requireAuth/requireRole, CSRF, error handler
  lib/                     prisma, errors, validation, money, slugs, audit log
  modules/
    auth/                  register/login/logout, Argon2id, lockout, sessions, addresses
    catalog/               search, filters, sort, pagination, facets, product detail, home data, CMS pages
    cart/                  server-side cart (guest cookie or user), server-side pricing
    orders/                checkout → order, atomic stock reservation, expiry, status transitions
    payments/              provider adapters, return handler, webhooks, dev gateway
    media/                 image pipeline + storage adapters (local | cloudinary)
    inventory              (in admin/products.js) stock adjustments with an append-only ledger
    engagement/            reviews (moderated), wishlist, newsletter (consent tracked)
    analytics/             anonymous first-party events → admin funnel
    settings/              all editable site content/config with code defaults
    admin/                 dashboard, products/variants/images, orders/refunds, content, settings, customers
public/                    storefront pages + js/ (api, layout, components, pages/*) + admin/ SPA
prisma/                    schema, migrations, seed
tests/                     node:test + supertest integration tests
```

### Key design decisions
- **Money** in integer minor units (`18500` = QAR 185.00). Prices are always recomputed on the server.
- **Stock** is reserved atomically at checkout (`UPDATE … WHERE stock >= qty`), released once if the order is
  cancelled/expires (`pendingOrderTtlMinutes`, default 60) or refunded. Every change is in `InventoryMovement`.
- **Variants:** every size × colour has its own SKU, optional price override, stock and low-stock threshold.
  Made-to-order products use stock as "production capacity".
- **Images:** stored in object storage, never in the DB. Each upload is *decoded* (MIME/extension not trusted),
  re-encoded to WebP in 3 sizes (2000/800/360 px), EXIF/GPS stripped. Per-file size limit and total storage quota are
  admin settings; no per-product image cap; galleries paginate. Drag-to-reorder, featured image, alt text, delete.
- **Everything editable without code:** brand name/logo/colours/fonts, hero, homepage text, navigation, footer &
  socials, shipping fee/threshold/countries, media limits, newsletter text, policy pages, categories, size guides.
  New setting keys added in `settings/defaults.js` appear in the admin automatically.

### Security
- Server-side sessions; cookie holds a random token, DB stores only its SHA-256. `HttpOnly`, `SameSite=Lax`,
  `Secure` when `COOKIE_SECURE=true`. Sessions are revoked on password change / role change.
- Argon2id (OWASP params), timing-equalised login, 5-attempt lockout, rate limits on auth/checkout/reviews.
- CSRF: Origin check + `X-Requested-With` header on every state-changing API call.
- Strict CSP (no inline scripts/styles); all templates escape interpolated values.
- RBAC: `CUSTOMER` / `STAFF` (products, inventory, orders, reviews) / `ADMIN` (+ settings, pages, customers, refunds,
  newsletter export). Every admin route re-checks on the server. Admin actions are audit-logged.
- Guests view/pay their order with an unguessable access token (hash stored), not just the order number.
- Open-redirect protection on `?next=`. No secrets in code — see `.env.example`.

## Production checklist
1. Managed PostgreSQL; `npx prisma migrate deploy` on release.
2. `NODE_ENV=production`, `APP_URL=https://…`, `COOKIE_SECURE=true`, `TRUST_PROXY=true` behind a proxy.
3. `MEDIA_PROVIDER=cloudinary` + `CLOUDINARY_URL`.
4. Enable a real payment provider (see the Qatar table above) and register its webhook URL.
5. Remove `dev` from `PAYMENT_PROVIDERS` (the server will refuse to start otherwise).
6. Replace seed policy text — especially the privacy policy (Qatar Law No. 13 of 2016 on personal data).
7. Running more than one instance? Move the 5-minute expiry job in `server.js` to a single scheduled job.

## Not built yet (natural next increments)
Order confirmation emails / WhatsApp notifications · password reset by email · a Qatar payment gateway adapter
(Tap or SkipCash) · discount codes & gift cards · Arabic/RTL · server-rendered product pages for stronger SEO
(currently client-rendered with clean URLs + JSON-LD) · sitemap.xml · S3 storage adapter.
