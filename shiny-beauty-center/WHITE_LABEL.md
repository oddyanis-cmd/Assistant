# White-Label Guide — spin up a new salon from this template

This app is built to be **resold to different salons**, each with their **own
database, login, branding, services, and staff**. The model here is
**one copy per salon** (a "silo"): every client gets their own Supabase project
and their own deployment, fully isolated from every other client.

> This is the "template per salon" model. It needs **no code changes** to stand
> up a new client — only a new database, new environment values, and a few
> branding tweaks. (A future single-app "multi-tenant" version is possible but
> is a separate, larger project.)

Time per new salon: **~30–45 minutes**.

---

## Step 1 — Create the salon's database (Supabase)
1. Go to https://supabase.com → **New project** (one per salon).
2. Name it for the client (e.g. `bloom-beauty`), set a strong DB password, pick
   the nearest region.
3. **SQL Editor → New query** → paste the entire contents of
   `supabase/setup.sql` → **Run**. This creates every table, security rule, the
   services menu, staff, **and all Phase-7 features** (finance, HR, manual
   payments, service photos, custom roles, QAR currency).
4. **Project Settings → API** → copy the **Project URL**, the **anon** key, and
   the **service_role** key (keep service_role secret).

## Step 2 — Deploy the salon's app (Vercel)
1. Import this repo in Vercel as a **new project** (one per salon).
2. Set **Root Directory** = `shiny-beauty-center`.
3. Add the environment variables from Step 3 below.
4. Deploy. You'll get a `https://<client>.vercel.app` link (add a custom domain
   later if the client wants one).

## Step 3 — Environment values (per salon)
Set these in Vercel (Project → Settings → Environment Variables), or in
`.env.local` for local testing:

```bash
# --- Database (from Step 1) ---
NEXT_PUBLIC_SUPABASE_URL="https://<their-project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<their-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<their-service-role-key>"   # secret, server-only

# --- Branding (per salon) ---
NEXT_PUBLIC_APP_NAME="Bloom Beauty Lounge"
NEXT_PUBLIC_APP_TAGLINE="Where every woman shines"
NEXT_PUBLIC_APP_URL="https://bloom-beauty.vercel.app"

# --- Currency (server-only; defaults to QAR) ---
TAP_CURRENCY="QAR"     # e.g. AED, SAR, KWD, USD …

# --- Optional paid features (off by default) ---
NEXT_PUBLIC_PAYMENTS_ENABLED="false"
NEXT_PUBLIC_NOTIFICATIONS_ENABLED="false"
```

`NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_TAGLINE` re-label the app without
touching code. (A handful of footers still say the original name — see the
"Deeper branding" checklist below to fully rebrand.)

## Step 4 — Create the salon's logins
Locally (once, against their database), run:
```bash
npm run db:seed:test
```
…to create the 4 starter role logins, **or** create the owner's real admin
account in Supabase → Authentication → Users, then assign the **Admin** role in
the app under **Users & Roles**. Change/disable the default test logins before
handing over.

## Step 5 — Customize for the client (in-app, no code)
Log in as Admin and set up their business — all from the UI:
- **Manage Services**: add their real services, prices, durations, and **upload
  a photo** for each (managers can change these any time).
- **Users & Roles**: create staff accounts; assign roles. Use **Roles &
  Positions** to create custom positions with exactly the permissions you want.
- **HR**: add employee details (job title, salary, hire date), attendance, payroll.
- **Finance**: track expenses; record manual (cash/card) payments on bookings.
- Currency shows as whatever `TAP_CURRENCY` is set to.

---

## Deeper branding (optional, code)
For a full re-skin beyond name/tagline, edit these in `shiny-beauty-center/`:
- **Logo**: `src/components/ui/Logo.tsx` — swap the inline SVG + the wordmark.
- **Brand colors**: `tailwind.config.ts` (the `rose` / `nude` / `charcoal` /
  `cream` palettes) and any CSS variables in `src/app/globals.css`.
- **Fonts / metadata**: `src/app/[locale]/layout.tsx` (title template + description).
- **PWA name & icons**: `public/manifest.webmanifest` and the icons in `public/`.
- **Remaining name strings**: search the repo for `Shiny Beauty` and replace the
  few remaining footers (`error.tsx`, `not-found.tsx`, `page.tsx`, the two
  portal layouts, and `src/app/api/cron/reminders/route.ts`).

## Turning on paid features (optional, per client)
- **Online payments (Tap):** set `NEXT_PUBLIC_PAYMENTS_ENABLED=true` plus the
  client's Tap keys (see `DEPLOYMENT.md`).
- **Email / WhatsApp reminders:** set `NEXT_PUBLIC_NOTIFICATIONS_ENABLED=true`
  plus the SMTP / WATI credentials (see `DEPLOYMENT.md`).

## Keeping clients up to date
Because each salon is its own deployment of this one codebase, shipping an
improvement means redeploying each client's Vercel project from the latest code
(and, if the update includes a new `supabase/migrations/NNN_*.sql`, pasting that
migration into each client's Supabase SQL editor). Keep a simple list of your
clients, their Supabase project ref, and their Vercel project so updates are a
quick checklist.

---
*Data isolation: each salon's data lives in its own Supabase project, so no
client can ever see another's data. This is the simplest and safest model to
start reselling with.*
