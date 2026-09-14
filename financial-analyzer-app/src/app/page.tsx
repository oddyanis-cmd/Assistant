import Link from "next/link";

const STEPS: { title: string; body: string }[] = [
  {
    title: "1. Enter your financials",
    body: "Income statement, balance sheet, and your business type — retail, SaaS, restaurant, manufacturing, services, or e-commerce.",
  },
  {
    title: "2. The verified engine computes",
    body: "Every margin, ratio, and balance-sheet check is computed by a deterministic, unit-tested calculation engine. No AI arithmetic, ever.",
  },
  {
    title: "3. AI writes the report",
    body: "A senior-analyst-style narrative explains what your verified numbers mean, in plain language — grounded strictly in the figures above.",
  },
];

interface Plan {
  name: string;
  price: string;
  period: string;
  reports: string;
  features: string[];
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Basic",
    price: "$5",
    period: "/mo",
    reports: "10 reports / month",
    features: [
      "10 AI-narrated reports per month",
      "Full ratio breakdown (profitability, liquidity, solvency, efficiency)",
      "Email support",
    ],
  },
  {
    name: "Pro",
    price: "$15",
    period: "/mo",
    reports: "40 reports / month",
    features: [
      "40 AI-narrated reports per month",
      "Everything in Basic",
      "Priority report generation",
    ],
    highlighted: true,
  },
  {
    name: "Unlimited",
    price: "$40",
    period: "/mo",
    reports: "Unlimited (fair use)",
    features: [
      "Unlimited reports (fair use)",
      "Everything in Pro",
      "Priority support",
    ],
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-5xl">
          AI-powered financial analysis you can trust —{" "}
          <span className="text-gold">the math is verified</span>, the insights
          are written by AI.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-offwhite/70 sm:text-lg">
          Enter your income statement and balance sheet. A tested calculation
          engine computes every ratio; the AI only interprets those verified
          numbers and writes a clear, actionable report.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/training"
            className="rounded-md border border-white/20 px-6 py-3 text-sm font-medium text-offwhite transition hover:border-gold hover:text-gold"
          >
            Start free training
          </Link>
          <Link
            href="/pro"
            className="rounded-md bg-gold px-6 py-3 text-sm font-semibold text-navy transition hover:bg-gold-light"
          >
            Try the Pro Analyzer
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/10 bg-navy-light/40">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-center font-serif text-2xl font-semibold sm:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-offwhite/70">
            Verified engine first, AI narration second — never the other way
            around.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
              >
                <h3 className="font-serif text-lg font-semibold text-gold">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-offwhite/70">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="text-center font-serif text-2xl font-semibold sm:text-3xl">
          Pricing
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-offwhite/70">
          Simple monthly plans, billed per report allowance. Start free with
          Training, or try the full Pro Analyzer right now.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-xl border p-6 ${
                plan.highlighted
                  ? "border-gold bg-gold/[0.06]"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {plan.highlighted && (
                <span className="mb-3 inline-block w-fit rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-navy">
                  Most popular
                </span>
              )}
              <h3 className="font-serif text-xl font-semibold">{plan.name}</h3>
              <p className="mt-2">
                <span className="text-3xl font-semibold">{plan.price}</span>
                <span className="text-offwhite/60">{plan.period}</span>
              </p>
              <p className="mt-1 text-sm font-medium text-gold">
                {plan.reports}
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-offwhite/80">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-gold">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {/* TODO: wire this CTA to Stripe checkout once billing is built. */}
              <Link
                href="/pro"
                className={`mt-6 block rounded-md px-4 py-2.5 text-center text-sm font-semibold transition ${
                  plan.highlighted
                    ? "bg-gold text-navy hover:bg-gold-light"
                    : "border border-white/20 text-offwhite hover:border-gold hover:text-gold"
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-offwhite/50">
          Subscriptions and billing are launching soon. For now, every plan's
          "Get started" opens the Pro Analyzer directly.
        </p>
      </section>
    </div>
  );
}
