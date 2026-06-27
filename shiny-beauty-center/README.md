# Shiny Beauty Center

A bilingual (English / Arabic, full RTL) management + booking platform for a
**female-only beauty salon** — a client **PWA** and a staff/admin **web portal** in
one Next.js codebase.

## Stack
**Next.js 15 (App Router) + TypeScript + Tailwind** · **Supabase** (Postgres, Auth,
Row-Level Security, storage) · **Tap Payments** (Qatar, behind a flag) · **Email +
WhatsApp** notifications (behind a flag) · deploys to **Vercel + Supabase**.

## What's inside
- **Client PWA** — browse services, book (service → stylist → real-time slot →
  confirm), "My Appointments", loyalty points; installable, offline-aware.
- **Staff portal** — personal schedule, confirm/check-in/complete/no-show, client
  notes & history, availability + time-off, notifications inbox.
- **Admin/Manager portal** — dashboard (KPIs, revenue chart, peak-hours heatmap),
  reports + CSV export, all-staff calendar, service catalog CRUD, client database.
- **RBAC** — 8 roles, **78 permissions**, plus per-user grant/revoke overrides,
  enforced in Postgres (`has_permission`: revoke > grant > role > deny) and re-checked
  in every server action.
- **Payments & notifications** — Tap deposits (webhook-confirmed) and email/WhatsApp
  confirmations + 24h/2h reminders, both shipped **off** behind feature flags.

## Quick start
```bash
cd shiny-beauty-center && npm install
cp .env.example .env.local        # add Supabase URL + keys
# run migrations 001-006 + seed.sql + seed_catalog.sql in the Supabase SQL editor
npm run db:seed:test              # create one test login per role
npm run dev                       # http://localhost:3000
```

## Docs
- **[BETA_TESTING.md](./BETA_TESTING.md)** — fastest path to a testable beta, test
  logins, and per-role test checklists.
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — full Vercel + Supabase deployment, env-var
  reference, payments/notifications setup, go-live checklist.

## Quality
`npm run type-check` (tsc, clean) · `npx vitest run` (86 tests) ·
`npm run build` (48 routes). The full migration + seed path and the RBAC/booking
logic are verified against a real Postgres.

## Roadmap (schema-ready, not fully built)
Reviews & ratings, gift cards, promo codes, waitlist with auto-notify, recurring
appointments, and the HR/inventory modules. Architected for a later **Capacitor**
native iOS/Android wrap without backend changes.
