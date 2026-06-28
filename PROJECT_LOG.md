# Project Log — build journal & decisions

A distilled, **secrets-free** record of what was built and why. For the operational
guide (commands, conventions, live URL, logins), see **`CLAUDE.md`**.

## Summary
Built **Shiny Beauty Center** — a bilingual (English/Arabic, RTL) women-only beauty-salon
platform — from scratch using a Claude Code subagent team, and **deployed it live**
(Vercel + Supabase). The repo also contains an earlier Belza hair-salon app and a
Python/FastAPI AI assistant.

## What was built (shiny-beauty-center), by phase
1. **Setup + Auth + RBAC** — Supabase auth; 8 roles, 78 permissions, per-user grant/revoke;
   `has_permission` precedence revoke > grant > role > deny. i18n EN/AR + RTL. Installable PWA.
2. **Catalog + booking engine + client PWA** — services menu, availability RPCs, conflict-safe
   booking (advisory lock), My Appointments, loyalty points.
3. **Staff portal** — day schedule, confirm/check-in/complete/no-show, client notes & history,
   availability + time-off requests, in-app notifications.
4. **Admin/Manager portal** — dashboard (KPIs, revenue chart, peak-hours heatmap), reports +
   CSV export, user & permission management, all-staff calendar, time-off approval.
5. **Payments + Notifications (behind flags, off by default)** — Tap Payments (deposit,
   webhook-confirmed), email/WhatsApp confirmations + 24h/2h reminders.
6. **Deployment** — DEPLOYMENT.md, BETA_TESTING.md, QUICKSTART.md, one-paste `setup.sql`,
   test-user seeder.
   - **+ Reviews & Ratings** — post-appointment stars/comments, admin moderation, feeds the
     staff-performance report. 116 Vitest tests.

## Key decisions
- **Supabase** over a custom backend (auth + Postgres + RLS in one).
- **RBAC enforced in the database** (SECURITY DEFINER functions re-check `has_permission`),
  so it can't be bypassed from the client; server actions re-check too.
- **Feature flags** for payments/notifications so the salon can launch without them.
- **next-intl** for EN/AR + full RTL.
- Verified the full migration/seed path **and** the RBAC + booking logic against a **real
  Postgres**, not just the build.

## Bugs found & fixed (the lessons)
- **`NEXT_PUBLIC_*` must be read statically.** A dynamic `process.env[key]` lookup is NOT
  inlined into the client bundle → the browser Supabase client reported "Service not
  configured" (failed locally and on Vercel despite vars being set). Fixed `config.ts` to use
  static `process.env.NEXT_PUBLIC_X`.
- **Seed bugs** (only found by running the real migrations): a `$$` dollar-quote collision in a
  `DO` block zeroed out `role_permissions` (admin would have no perms); several invalid
  non-hex UUIDs; a CHECK-constraint violation on the "day off" availability rows. All fixed.
- **next-intl:** the `useTranslations` hook can't be used in an `async` server component —
  use `await getTranslations()` (caused a 500 on the sign-in page).
- **Vercel Hobby plan** allows only **daily** cron jobs → `vercel.json` uses `0 9 * * *`.
- **Security audit (Sage)** found + fixed: a **critical** money-path bug (charge amount taken
  from client input), webhook amount/currency verification, HTML/markdown injection in
  notification templates, a vulnerable `nodemailer`, and CSV formula-injection in exports.

## Outcome
Live on **Vercel** (auto-deploys on push to `main`) backed by **Supabase**. Four seeded role
logins (admin/manager/staff/client) for testing. Beta-ready and installable on phone.

## Roadmap (schema-ready, not yet built)
Gift cards, promo codes, waitlist + auto-notify on cancellation, recurring appointments,
custom domain, turning on Tap payments / WhatsApp reminders, optional Capacitor native wrap.
