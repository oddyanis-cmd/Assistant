# Financial Analyzer — web app

A Next.js 15 (App Router) web app that wraps a deterministic, unit-tested
financial-analysis engine in a bilingual-free, professional-finance UI, and
narrates the results with AI.

## Design: verified engine + AI narrator

**Every number is computed by tested code. The AI never does arithmetic —**
**it only interprets already-calculated figures.**

```
 Your financials  →  lib/engine (pure functions, no AI)  →  verified numbers
                                                                    │
                                                                    ▼
                                          lib/engine/report.ts (AI) writes
                                          a narrative FROM those numbers
```

- `src/lib/engine/*` computes statement totals (gross profit, EBITDA, EBIT,
  net income, balance-sheet check), ratios (profitability, liquidity,
  solvency, efficiency), CapEx/OpEx classification, and valuation math
  (NPV/IRR/payback/CAGR). Every ratio is null-safe: a zero denominator
  yields `null` ("n/a"), never `Infinity`/`NaN`.
- `src/lib/engine/report.ts` sends those verified numbers to Claude with a
  system prompt that forbids it from inventing or recalculating anything —
  it may only explain what the numbers mean. If `ANTHROPIC_API_KEY` is not
  set, it returns a deterministic **sample** report built from the same
  numbers, so the UI and report format work before any AI billing is wired
  up (`report.source` is `"ai"` or `"sample"`).

> **Provenance:** the engine under `src/lib/engine/` is currently a
> **verbatim copy** of `../financial-analyzer/src/` (checksummed identical
> at copy time). It is not yet extracted into a shared package — that
> unification is a follow-up so both projects can consume one source of
> truth instead of two copies.

## Routes

| Route              | Description                                                                 |
| ------------------ | ---------------------------------------------------------------------------- |
| `/`                 | Landing page: hero, "how it works", pricing (Basic/Pro/Unlimited).          |
| `/training`         | Open, no login — free practice cases (placeholder content; quizzes to come). |
| `/pro`              | The analyzer: enter an income statement + balance sheet, get verified totals, grouped ratios, and an AI-written report. **Not gated yet** — see TODOs below. |
| `/api/analyze`      | `POST { input, companyName }` → `{ result, report }`. Server-only; this is the only place `ANTHROPIC_API_KEY` is read. |

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — see below
npm run dev                  # http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build — must pass cleanly
npm run start         # run the production build
npm run type-check    # tsc --noEmit
npm run lint           # next lint
```

## Environment variables

See `.env.example`.

- `ANTHROPIC_API_KEY` — optional. Without it, `/pro` still fully works: the
  engine computes real, correct numbers, and the report is the deterministic
  sample narrative instead of a live Claude-written one. The key is only
  ever read server-side in `src/lib/engine/report.ts`; it is never sent to
  the client.
- `ANALYSIS_MODEL` — optional, defaults to `claude-sonnet-5`.

## What's next (not built yet — see `// TODO` comments in the code)

- **Auth** — Email + Google via Supabase.
- **Billing** — Stripe subscriptions for the three tiers shown on the
  landing page (Basic $5/mo · Pro $15/mo · Unlimited $40/mo), including
  metering report usage per plan.
- Gating `/pro` behind an authenticated, subscribed user once the above
  exist (`src/app/pro/page.tsx` has a `TODO` marking exactly where).
- Wiring the pricing cards' "Get started" buttons to real Stripe checkout
  sessions (currently they link straight to `/pro`).
- Real quizzes/scoring for the `/training` practice cases (currently
  placeholder content).

## Project structure

```
financial-analyzer-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # root layout: nav, theme, fonts
│   │   ├── page.tsx              # landing page
│   │   ├── globals.css           # Tailwind + theme + markdown-report styles
│   │   ├── training/page.tsx     # free, open training/practice page
│   │   ├── pro/page.tsx          # client component: the analyzer form + results
│   │   └── api/analyze/route.ts  # POST handler: analyze() + generateReport()
│   └── lib/
│       └── engine/                # verbatim copy of ../financial-analyzer/src
│           ├── types.ts
│           ├── util.ts
│           ├── statements.ts
│           ├── ratios.ts
│           ├── valuation.ts
│           ├── capexOpex.ts
│           ├── analyze.ts
│           └── report.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.mjs
├── tsconfig.json
└── .env.example
```

## Theme

Deep navy background (`#0b111c`), warm gold accent (`#c79a44`), off-white
text (`#f5f1e8`); serif headings, sans body. Defined in
`tailwind.config.ts` and `src/app/globals.css`.
