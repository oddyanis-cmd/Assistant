# Keel — web app

A Next.js 15 (App Router) web app: one unified, trilingual (EN/FR/AR) product
called **Keel**. The homepage, the `/pro` analyzer, and `/training` all share
the same design system, and every route wraps a deterministic, unit-tested
financial-analysis engine, narrated by AI.

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

## Design system: Keel

The whole app's brand/visual language is ported from
`../keel-landing/index.html` (a self-contained trilingual marketing page —
the design source of truth). See `src/app/globals.css` for the full,
near-verbatim port: CSS custom-property tokens (dark warm-charcoal base,
amber `--accent` default palette, plus midnight/emerald/plum/onyx presets),
money-green `--pos`/`--pos-ink` tokens reserved for **computed financial
results**, and every component class (`.btn`, `.nav`, `.hero`, `.cap`,
`.tier`, `.dash-wrap`, `.paper`, `.modal`, `.kbot-*`, …). Fonts (Newsreader /
Inter / IBM Plex Mono / IBM Plex Sans Arabic / Noto Kufi Arabic) are
self-hosted via `next/font/google`, wired to the same CSS variables the
source uses. The intro "cover-doc" overlay animation was intentionally
**not** ported (optional per the design brief; it's tightly coupled to a
single-page load sequence that doesn't fit a multi-route app).

### i18n + theme (client-only, no next-intl, no locale routing)

- `src/lib/i18n/dictionaries.ts` — the EN/FR/AR dictionary, **mechanically
  extracted** from `keel-landing/index.html` (EN from the DOM text, FR/AR
  from the inline `var FR = {...}` / `var AR = {...}` objects) rather than
  hand-retyped, so the translations are guaranteed character-for-character
  identical to the source. Do not hand-edit this file — re-run the
  extraction if the source copy changes.
- `src/lib/i18n/app-strings.ts` — the *only* hand-authored translations
  (currently just the "Training" nav label), since keel-landing has no
  functional sub-pages of its own to translate. `src/lib/i18n/merged.ts`
  combines the two.
- `src/components/providers/LanguageProvider.tsx` — a small React context
  exposing `t(key)`, `lang`, `setLang()`; sets `<html lang>`/`dir` and
  persists the choice to `localStorage` (wrapped in try/catch).
- `src/components/providers/ThemeProvider.tsx` — the palette context; sets
  `data-palette` for the 5 presets, and ports keel-landing's `applyCustom()`
  math (derives `--accent-hi/-lo/-soft/-glow` and flips `--on-accent` by
  luminance) for the custom colour picker in `<PaletteDock/>`.
- A tiny inline script (`next/script`, `beforeInteractive`) in
  `src/app/layout.tsx` applies a persisted language/palette **before**
  hydration, so returning visitors don't see a flash of English/LTR or the
  default amber accent.
- **Scope note:** only the nav/footer/assistant/theme chrome and the
  homepage are translated. The `/pro` form field labels and `/training`
  practice-case copy remain English-only — they aren't part of
  keel-landing's dictionaries, and inventing new FR/AR financial
  terminology risked exactly the translation mistakes this project needed
  to avoid. Flagged for a follow-up with real translations if full coverage
  is wanted.

### "Ask Keel" assistant + other shared chrome

`src/components/layout/AskKeel.tsx` ports the scripted, trilingual chat
widget (`src/lib/i18n/kbot-data.ts`, also mechanically extracted). `Nav`,
`Footer`, `PaletteDock`, and `TncModal` (the subscription-terms modal, opened
by any `.tnc-link` element anywhere on the page via event delegation) render
once in `src/app/layout.tsx` and appear on every route.

## Routes

| Route              | Description                                                                 |
| ------------------ | ---------------------------------------------------------------------------- |
| `/`                 | The Keel landing page, ported to React: hero, ticker, how-it-works, differentiator, capabilities, animated results dashboard, sample report, pricing (Free/Basic/Pro/Unlimited), About, Contact, T&C modal. Trilingual + themed. |
| `/training`         | Open, no login — free practice cases (placeholder content; quizzes to come), restyled to the Keel design. |
| `/pro`              | The analyzer: enter an income statement + balance sheet, get verified totals, grouped ratios (money-green), and an AI-written report (rendered in dark-ink-on-light "document" style). **Not gated yet** — see TODOs below. |
| `/api/analyze`      | `POST { input, companyName }` → `{ result, report }`. Server-only; this is the only place `ANTHROPIC_API_KEY` is read. |

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — see below
npm run dev                  # http://localhost:3000
```

Other scripts:

```bash
npm run build         # production build — must pass cleanly
npm run start          # run the production build
npm run type-check     # tsc --noEmit
npm run lint            # next lint (not yet configured in this repo — first
                         # run prompts an interactive ESLint setup)
```

## Environment variables

See `.env.example`.

- `ANTHROPIC_API_KEY` — optional. Without it, `/pro` still fully works: the
  engine computes real, correct numbers, and the report is the deterministic
  sample narrative instead of a live Claude-written one. The key is only
  ever read server-side in `src/lib/engine/report.ts`; it is never sent to
  the client, and never referenced behind `NEXT_PUBLIC_`.
- `ANALYSIS_MODEL` — optional, defaults to `claude-sonnet-5`.

## What's next (not built yet — see `// TODO` comments in the code)

- **Auth** — Email + Google via Supabase.
- **Billing** — Stripe subscriptions for the four tiers shown on the
  landing page (Free · Basic $5/mo · Pro $15/mo · Unlimited $40/mo),
  including metering report usage per plan.
- Gating `/pro` behind an authenticated, subscribed user once the above
  exist (`src/app/pro/page.tsx` has a `TODO` marking exactly where).
- Wiring the pricing cards' CTAs to real Stripe checkout sessions
  (currently they all link straight to `/pro`).
- Real quizzes/scoring for the `/training` practice cases (currently
  placeholder content).
- Translating `/pro` and `/training`'s own content into FR/AR (see the
  i18n scope note above).
- The intro "cover-doc" cover animation from keel-landing (intentionally
  skipped — see the Design system section).

## Project structure

```
financial-analyzer-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # fonts, providers, nav/footer/assistant chrome
│   │   ├── page.tsx                # homepage: composes src/components/home/*
│   │   ├── globals.css             # Keel design tokens + component CSS (+ Tailwind)
│   │   ├── training/page.tsx       # free, open training/practice page
│   │   ├── pro/page.tsx            # client component: the analyzer form + results
│   │   └── api/analyze/route.ts    # POST handler: analyze() + generateReport()
│   ├── components/
│   │   ├── providers/               # LanguageProvider, ThemeProvider
│   │   ├── layout/                  # Nav, Footer, PaletteDock, AskKeel, TncModal, …
│   │   ├── ui/                      # Reveal (scroll-in), CountUp (animated numbers)
│   │   └── home/                    # Hero, Ticker, Pricing, About, Contact, …
│   └── lib/
│       ├── i18n/                    # dictionaries.ts (extracted), app-strings.ts,
│       │                            # merged.ts, kbot-data.ts, types.ts
│       └── engine/                  # verbatim copy of ../financial-analyzer/src
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

Dark warm-charcoal base (`--ink #0e0d0c`), amber `--accent` (`#e28a4d`) as
the default of 5 palette presets (midnight/emerald/plum/onyx) plus a custom
colour picker, money-green `--pos` (`#4fb87e`) reserved for computed
financial results. Newsreader (display) / Inter (body) / IBM Plex Mono
(mono) fonts, with IBM Plex Sans Arabic + Noto Kufi Arabic RTL fallbacks.
All defined as CSS custom properties in `src/app/globals.css`; see the
"Design system: Keel" section above for how palette switching and RTL work.
