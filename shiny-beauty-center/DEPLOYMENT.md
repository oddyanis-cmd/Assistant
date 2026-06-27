# Shiny Beauty Center — Deployment Guide

A complete, copy-paste guide to take this app from zero to a **live public URL** on
**Vercel + Supabase**, with optional **Tap Payments** and **email/WhatsApp notifications**.

> The app launches fully functional with **payments and notifications OFF** — you can
> go live first and switch them on later. Nothing in this guide requires writing code.

---

## 0. Architecture

- **Next.js 15 (App Router) + TypeScript + Tailwind** — one codebase serves the public
  client **PWA** and the staff/admin **web portal**.
- **Supabase** — Postgres database, authentication, Row-Level Security, file storage.
- **Vercel** — hosting + serverless functions + cron.
- **Tap Payments** (Qatar) — optional, behind `NEXT_PUBLIC_PAYMENTS_ENABLED`.
- **Email (SMTP/Resend) + WhatsApp (WATI)** — optional, behind `NEXT_PUBLIC_NOTIFICATIONS_ENABLED`.
- Bilingual **English / Arabic** with full **RTL**.

The app lives in the **`shiny-beauty-center/`** subdirectory of the repo — this matters for
the Vercel "Root Directory" setting (Step 4).

---

## 1. Prerequisites (accounts — all have free tiers)

| Service | Needed for | Required at launch? |
|---|---|---|
| [Supabase](https://supabase.com) | Database + auth | **Yes** |
| [Vercel](https://vercel.com) | Hosting | **Yes** |
| [Tap Payments](https://www.tap.company) | Online deposits/prepay | No (flag) |
| [WATI](https://www.wati.io) or Twilio | WhatsApp messages | No (flag) |
| SMTP mailbox or [Resend](https://resend.com) | Email | No (flag) |

Local tooling: **Node 20+** and **npm**.

---

## 2. Environment variables

Create `shiny-beauty-center/.env.local` for local dev, and add the same keys in the
**Vercel project settings** for production. `.env*` is gitignored — never commit secrets.

> ⚠️ Keys prefixed `NEXT_PUBLIC_` are shipped to the browser — only **non-secret** values
> go there. All other keys are **server-only**.

```bash
# ── Supabase (required) ──────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon public key>"
SUPABASE_SERVICE_ROLE_KEY="<service role key>"   # server-only — admin ops, seeding, invites

# ── App ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"      # prod: https://yourdomain.com

# ── Feature flags (default OFF) ──────────────────────────────────────
NEXT_PUBLIC_PAYMENTS_ENABLED="false"
NEXT_PUBLIC_NOTIFICATIONS_ENABLED="false"

# ── Tap Payments (only when payments ON) ─────────────────────────────
NEXT_PUBLIC_TAP_PUBLIC_KEY="pk_test_..."         # publishable (safe for browser)
TAP_SECRET_KEY="sk_test_..."                     # server-only
TAP_WEBHOOK_SECRET="..."                         # server-only — verifies webhook
TAP_CHARGE_MODE="deposit"                        # "deposit" | "full"
TAP_DEPOSIT_PERCENT="25"
TAP_CURRENCY="QAR"

# ── Email (only when notifications ON) ───────────────────────────────
EMAIL_FROM="Shiny Beauty Center <bookings@yourdomain.com>"
RESEND_API_KEY="re_..."                          # OR use SMTP below
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""

# ── WhatsApp via WATI (only when notifications ON) ───────────────────
WATI_API_ENDPOINT="https://live-server-xxxx.wati.io"
WATI_ACCESS_TOKEN="..."                          # server-only

# ── Cron (reminders) ─────────────────────────────────────────────────
CRON_SECRET="run: openssl rand -base64 32"
```

---

## 3. Supabase project + database

1. **Create a project** at supabase.com → New Project. Pick a region near Qatar
   (e.g. `eu-central` or `me-central` if available). Save the database password.
2. **Get your keys**: Project → Settings → API → copy the **Project URL**, the **anon**
   key, and the **service_role** key into your env vars.
3. **Run the migrations in order.** Open Project → **SQL Editor** and run each file's
   contents, in this exact order:
   1. `supabase/migrations/001_schema.sql`
   2. `supabase/migrations/002_rls_and_has_permission.sql`
   3. `supabase/migrations/003_booking_functions.sql`
   4. `supabase/migrations/004_staff_functions.sql`
   5. `supabase/migrations/005_admin_metrics.sql`
   6. `supabase/migrations/006_payments.sql`

   *(Or, with the Supabase CLI: `supabase link --project-ref <ref>` then
   `supabase db push`.)*
4. **Seed roles, permissions, and the catalog** — run in the SQL Editor:
   1. `supabase/seed.sql` — 8 roles + all 78 permissions + default role bundles.
   2. `supabase/seed_catalog.sql` — service categories, services, staff, sample data.
5. **Create your first Admin login:**
   1. Supabase → Authentication → **Add user** → create your admin email + password
      (or use “Invite”). Copy the new user's **UUID**.
   2. Bootstrap the admin profile + role. Either run `supabase/seed-admin.ts` locally
      with the service-role key:
      ```bash
      cd shiny-beauty-center
      SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
        npx tsx supabase/seed-admin.ts <that-user-uuid>
      ```
      …or run the equivalent SQL snippet noted at the top of `seed-admin.ts` in the
      SQL Editor (inserts the `profiles` row and assigns the Admin role).

---

## 4. Run locally

```bash
cd shiny-beauty-center
npm install
# create .env.local from Section 2
npm run dev          # http://localhost:3000
```
- Client app: `/en` or `/ar`. Sign in at `/en/auth/signin`.
- Admin portal: `/en/admin` · Staff portal: `/en/staff` (RBAC-gated).

---

## 5. Deploy to Vercel

1. Push the repo to GitHub, then Vercel → **New Project** → import it.
2. **Set Root Directory to `shiny-beauty-center`** (Project → Settings → General →
   Root Directory). *This is the most common cause of a failed first deploy.*
3. Framework preset: **Next.js** (auto-detected). Build command `next build`, output auto.
4. Add **all** env vars from Section 2 (Production + Preview). Set `NEXT_PUBLIC_APP_URL`
   to your Vercel URL (then your custom domain later).
5. Deploy. Visit the URL — the client app and portals should load; sign in with the
   admin you seeded.

---

## 6. Reminders cron

`vercel.json` already defines:
```json
{ "crons": [ { "path": "/api/cron/reminders", "schedule": "*/15 * * * *" } ] }
```
Vercel runs it every 15 minutes. The route is protected by `CRON_SECRET` — set that env
var; Vercel Cron automatically sends the project's deployment auth, and the route also
accepts `Authorization: Bearer <CRON_SECRET>`. Reminders only send when
`NEXT_PUBLIC_NOTIFICATIONS_ENABLED="true"`.

---

## 7. Turn ON payments (when ready)

1. Tap Dashboard → API keys → fill `NEXT_PUBLIC_TAP_PUBLIC_KEY`, `TAP_SECRET_KEY`.
2. Tap Dashboard → Webhooks → add `https://yourdomain.com/api/payments/tap-webhook`;
   copy its signing secret into `TAP_WEBHOOK_SECRET`.
3. Choose `TAP_CHARGE_MODE` (`deposit` + `TAP_DEPOSIT_PERCENT`, or `full`).
4. Set `NEXT_PUBLIC_PAYMENTS_ENABLED="true"` and redeploy.
5. Test a booking with a Tap test card → the appointment stays **pending** until Tap's
   **verified webhook** confirms it (never confirmed from the browser).

---

## 8. Turn ON notifications (when ready)

1. Email: set `RESEND_API_KEY` (+ verify your sending domain) **or** the `SMTP_*` block,
   and `EMAIL_FROM`.
2. WhatsApp (WATI): set `WATI_API_ENDPOINT` + `WATI_ACCESS_TOKEN` and approve your
   message templates in WATI.
3. Set `NEXT_PUBLIC_NOTIFICATIONS_ENABLED="true"` and redeploy.
4. Book a test appointment → confirmation sends; the cron sends 24h/2h reminders (deduped).

---

## 9. PWA — Add to Home Screen

Already included: `public/manifest.webmanifest`, `public/sw.js`, and
`public/icons/icon-192.png` + `icon-512.png`. To verify on a real deploy:
- Open the site on a phone over **HTTPS** (Vercel provides it).
- Chrome/Android: ⋮ → **Add to Home screen**; iOS Safari: Share → **Add to Home Screen**.
- DevTools → Application → Manifest / Service Workers should show no errors and an
  "installable" check.

---

## 10. Custom domain

Vercel → Project → **Domains** → add `yourdomain.com` (+ `www`); set the DNS records
Vercel shows at your registrar (TLS is automatic). Then update `NEXT_PUBLIC_APP_URL`,
the Tap webhook URL, and your email sending domain to the custom domain.

---

## 11. Go-live checklist

- [ ] Migrations 001–006 ran cleanly; `seed.sql` + `seed_catalog.sql` loaded.
- [ ] First Admin can sign in; roles/permissions visible in `/admin/users`.
- [ ] Vercel **Root Directory = `shiny-beauty-center`**; all env vars set.
- [ ] `NEXT_PUBLIC_APP_URL` = production URL; `CRON_SECRET` strong & set.
- [ ] Client can book end-to-end (payments off → "Pay at Salon", CONFIRMED instantly).
- [ ] Staff portal shows assigned bookings; admin dashboard shows real metrics.
- [ ] PWA installs on a phone (manifest + SW + icons OK).
- [ ] (If charging) Tap live keys + webhook verified; test booking confirmed by webhook.
- [ ] (If messaging) confirmation + reminders deliver; reminders don't duplicate.
- [ ] Secrets are server-only (no `NEXT_PUBLIC_` secret); `.env*` not committed.

---

## 12. Future: native iOS/Android (Capacitor)

The frontend is a standard PWA, so it can be wrapped with **Capacitor** without changing
the Supabase backend: add `@capacitor/core` + `@capacitor/cli`, point the Capacitor
`server.url` at the deployed site (or export a static client shell), and build the iOS/
Android projects. Auth, booking, and data continue to flow through the same Supabase APIs.
