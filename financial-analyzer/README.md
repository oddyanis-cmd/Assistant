# Financial Analyzer — calculation engine (prototype)

The **deterministic core** of Pro Analyzing Mode. This is the "bulletproof math"
layer: **every financial number is computed and unit-tested here.** The AI layer
(added later) only *reads these outputs and writes the narrative report* — it
never performs arithmetic. That separation is what guarantees the figures are
always correct.

## What it computes
- **Statements & subtotals** — gross profit, EBITDA, EBIT, pre-tax, net income;
  current/total assets & liabilities, working capital — with a **balance-sheet
  reconciliation check** (Assets = Liabilities + Equity).
- **Ratios** — profitability (margins, ROA, ROE, ROIC), liquidity (current,
  quick, cash), solvency (D/E, debt ratio, interest coverage, net debt),
  efficiency (turnovers, DIO/DSO/DPO, cash-conversion cycle).
- **CapEx vs OpEx** — classification (capitalize vs expense) + straight-line and
  double-declining depreciation schedules.
- **Valuation** — NPV, IRR, payback period, CAGR.
- **Business-type focus** — surfaces the metrics each business model cares about
  (retail, restaurant, SaaS, manufacturing, services, e-commerce).

Every ratio is **null-safe**: a zero denominator yields `null` ("n/a"), never
`Infinity`/`NaN`.

## Use
```bash
npm install
npm test          # run the full test suite (golden-number verified)
npm run demo      # print a sample analysis
npm run type-check
```

## Why this design
LLMs are excellent at explanation and unreliable at arithmetic. By computing all
numbers in tested code and letting the AI only interpret them, Pro Analyzing Mode
gets both **provably correct figures** and an **expert-quality written report**.

> Prototype scope: the engine + tests. Next: the AI report agent on top, auth
> (email + Google), Stripe tiers (Basic/Pro/Unlimited), and the full app.
