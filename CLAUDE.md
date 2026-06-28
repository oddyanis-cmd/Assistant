# Repository guide (read me first)

This repo holds **three independent projects**. The **active** one is **`shiny-beauty-center/`**.

## Projects
- **`shiny-beauty-center/`** ← ACTIVE: women-only beauty-salon platform (client PWA + staff/admin portal). Built, security-hardened, **deployed and beta-live**.
- **`belza-salon/`** — earlier hair-salon booking app (Next.js + Prisma + Postgres + Stripe). Self-contained.
- **repo root** (`agent.py`, `main.py`, `tools/`, `database/`) — a Python/FastAPI personal AI assistant (WhatsApp + Claude agentic loop). Separate from the web apps.
- **`.claude/agents/`** — a 7-role "AI company" team (tech-lead-architect, full-stack-developer, product-designer, growth-marketer, data-research-analyst, finance-analyst, hr-admin-advisor) plus **Quinn** (qa-test-engineer) and **Sage** (security-reviewer). These are Claude Code subagents used to build the apps.

---

## shiny-beauty-center (the active project)
**What:** Bilingual (English/Arabic, full RTL) women's salon app — browse/book services (client PWA), staff portal, admin dashboard + reports, RBAC.
**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind + **Supabase** (Postgres/Auth/RLS) + next-intl. Tap Payments + email/WhatsApp notifications exist **behind feature flags (off by default)**. Test suite: Vitest (116 tests).

**Status:** All 6 planned phases + Reviews & Ratings done. Live.
- **Live URL:** https://shiny-beauty-centerrr.vercel.app
- **Hosting:** Vercel (Hobby plan), team `shiny2`, project `shiny-beauty-centerrr`. **Auto-deploys on push to `main`** (root directory = `shiny-beauty-center`).
- **Database:** Supabase, project ref `mzshioxeiykyuufqtrmz`. **Secrets live in Vercel env vars + the Supabase dashboard — never in this repo.**

**Setup / deploy** (see `shiny-beauty-center/`): `README.md`, `DEPLOYMENT.md`, `BETA_TESTING.md`, `QUICKSTART.md`.
- DB: paste `supabase/setup.sql` into the Supabase SQL editor (all migrations 001–007 + seeds), then `npm run db:seed:test` to create the 4 role logins.
- Env template: `.env.example`.

**Test logins** (password `ShinyTest123!`): `admin@shiny.test`, `manager@shiny.test`, `staff@shiny.test`, `client@shiny.test`.

**Commands (run inside `shiny-beauty-center/`):**
`npm run dev` · `npm run build` · `npm run type-check` · `npx vitest run` · `npm run db:seed:test`

### Conventions & gotchas (learned the hard way)
- **`NEXT_PUBLIC_*` env vars MUST be read with static `process.env.NEXT_PUBLIC_X`** (see `src/lib/config.ts`). A dynamic `process.env[key]` lookup is NOT inlined into the client bundle, so the browser Supabase client reports "Service not configured."
- **next-intl:** never call the `useTranslations` hook in an `async` server component — use `await getTranslations()`.
- Keep `messages/en.json` and `messages/ar.json` at **full key parity**.
- **RBAC** is enforced in Postgres via `has_permission(uid, perm)` with precedence **revoke > grant > role > deny**; every server action must re-check permission server-side.
- **Vercel Hobby** allows only **daily** crons — `vercel.json` uses `0 9 * * *` (bump to `*/15 * * * *` only on a Pro plan).
- RLS on every table; server-only secrets are never prefixed `NEXT_PUBLIC_`.
- Money is stored in integer minor units; default currency QAR.

**Roadmap (schema-ready, not yet built):** gift cards, promo codes, waitlist + auto-notify on cancellation, recurring appointments, custom domain, enabling Tap payments / WhatsApp reminders, optional Capacitor native iOS/Android wrap.

## Git
- Active work branch: `claude/laughing-ride-hk31di`, mirrored to `main` (the Vercel production branch). Commit + push there.
