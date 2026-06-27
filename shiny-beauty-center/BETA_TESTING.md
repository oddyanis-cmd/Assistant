# Shiny Beauty Center — Beta Testing Guide

This guide gets you from zero to a **testable beta** and tells you exactly what to
try as each role. The app is feature-complete (booking, client PWA, staff portal,
admin dashboard/reports/RBAC, payments + notifications behind flags) and has an
86-test automated suite; this is about exercising it with real logins.

> The app runs on **Supabase** (auth + database), so testing needs a Supabase
> project — there's no way around that for real auth. A free project takes ~3 minutes.

---

## A. Stand up a testable instance

### 1. Create the database (Supabase)
1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run these files **in order** (copy-paste each):
   `supabase/migrations/001 → 006`, then `supabase/seed.sql`, then
   `supabase/seed_catalog.sql`. *(All verified to apply cleanly.)*
3. Project → Settings → API: copy the **URL**, **anon** key, and **service_role** key.

### 2. Configure env
Create `shiny-beauty-center/.env.local` (see `.env.example` for the full list):
```bash
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon key>"
SUPABASE_SERVICE_ROLE_KEY="<service role key>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
# Feature flags stay OFF for beta unless you want to test them:
NEXT_PUBLIC_PAYMENTS_ENABLED="false"
NEXT_PUBLIC_NOTIFICATIONS_ENABLED="false"
```

### 3. Seed the test logins (one command)
```bash
cd shiny-beauty-center
npm install
npm run db:seed:test     # creates one confirmed user per role
```

### 4. Run it
```bash
npm run dev              # http://localhost:3000
```
- Client app: `http://localhost:3000/en` (or `/ar` for Arabic/RTL)
- Sign in: `http://localhost:3000/en/auth/signin`
- Health check: `http://localhost:3000/api/health`

*(To share a beta URL instead of localhost, follow `DEPLOYMENT.md` to deploy to
Vercel — set the project **Root Directory** to `shiny-beauty-center` and add the
same env vars.)*

---

## B. Test logins

All created by `npm run db:seed:test` (password: `ShinyTest123!`):

| Role | Email | Sees |
|---|---|---|
| **Admin** | `admin@shiny.test` | Everything, incl. user & permission management |
| **Manager** | `manager@shiny.test` | Dashboards, reports, calendar, time-off approval |
| **Staff** | `staff@shiny.test` | Only their own schedule + assigned appointments |
| **Client** | `client@shiny.test` | Browse + book + their own appointments |

---

## C. What to test (per role)

### 👩 Client — `client@shiny.test`
- [ ] Browse services by category (Massages, Facials, Lash, Mani, Pedi, Hammam).
- [ ] Book: pick a service → stylist (or "No preference") → a real time slot → confirm → see the confirmation (with "Pay at Salon").
- [ ] "My Appointments": see the upcoming booking; reschedule / cancel.
- [ ] Switch to **Arabic** (top-right) — the whole UI flips to **RTL**.
- [ ] On a phone over HTTPS: **Add to Home Screen** (installable PWA).
- [ ] Confirm you **cannot** reach `/en/admin` or `/en/staff` (redirected / access denied).

### 💇 Staff — `staff@shiny.test`
- [ ] See **My Schedule** (only your own appointments) for today; navigate days.
- [ ] Open an appointment → **confirm → check-in → complete** (or **mark no-show**).
- [ ] View the client's notes + visit history; add a private note.
- [ ] Set **availability** / request **time off**.
- [ ] **Notifications** inbox shows new-booking alerts.
- [ ] Confirm you **cannot** see other staff's calendars or the admin area.

### 📊 Manager — `manager@shiny.test`
- [ ] **Dashboard**: KPI cards (revenue, bookings, no-show rate, new vs returning), revenue chart, peak-hours heatmap.
- [ ] **Reports**: staff performance / popularity / commission; filter by date; **export CSV**.
- [ ] **All-staff calendar** (week/day).
- [ ] **Approve/reject** a staff time-off request.
- [ ] Confirm the manager **cannot** open user-permission management (lacks `manage_permissions`).

### 🛡️ Admin — `admin@shiny.test`
- [ ] **Users**: list users + roles; **assign a role**; **grant/revoke an individual permission**.
- [ ] **RBAC spot-check** (the headline feature): grant the manager `manage_permissions`, reload as manager → the Users screen now appears; revoke it → it disappears. Or **revoke** a permission a role normally has and confirm it's blocked (revoke beats role).
- [ ] **Service catalog**: add / edit / delete a service and a category (prices/durations editable, no code).
- [ ] **Client database**: open a client → profile + history + notes.
- [ ] **Invite a user** by email (needs the service-role key, which you set).

---

## D. Optionally test payments & notifications

They're **off by default**. To try them:
- **Payments**: set the `TAP_*` keys + `NEXT_PUBLIC_PAYMENTS_ENABLED="true"`, add the
  Tap webhook (`/api/payments/tap-webhook`). The booking flow then shows a deposit
  step; the appointment is confirmed **only** by Tap's verified webhook.
- **Notifications**: set email (`RESEND_*`/`SMTP_*`) + WhatsApp (`WATI_*`) keys +
  `NEXT_PUBLIC_NOTIFICATIONS_ENABLED="true"`. Confirmations send on booking; the
  reminders cron (`/api/cron/reminders`, guarded by `CRON_SECRET`) sends 24h/2h reminders.

---

## E. Beta caveats / known limitations
- **Women-only**: copy/UX is female-oriented by design.
- **Currency** defaults to **QAR** (set `TAP_CURRENCY`).
- **User invite** requires the service-role key (server-side only).
- Direct `auth.users` seeding (test users) is for beta convenience — in production,
  users self-register or are invited.
- Reviews/ratings, gift cards, waitlist, recurring appointments, and HR/inventory
  modules are **schema-ready but not fully built out** (permissions + tables exist).

## F. Reporting bugs
For each issue note: **role**, **page/URL**, **steps**, **expected vs actual**, and a
screenshot. The health endpoint (`/api/health`) confirms whether Supabase/payments/
notifications are wired.
