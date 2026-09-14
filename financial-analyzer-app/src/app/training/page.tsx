import Link from "next/link";

interface PracticeCase {
  title: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  business: string;
  description: string;
}

const PRACTICE_CASES: PracticeCase[] = [
  {
    title: "Diagnose a liquidity squeeze",
    level: "Beginner",
    business: "Retail",
    description:
      "A retail chain's current ratio has been sliding for two quarters. Read the balance sheet and work out what's driving it.",
  },
  {
    title: "Read a growth-stage balance sheet",
    level: "Intermediate",
    business: "SaaS",
    description:
      "High revenue growth, negative net margin. Separate the metrics that matter for a SaaS business from the ones that don't — yet.",
  },
  {
    title: "Spot the leverage risk",
    level: "Advanced",
    business: "Manufacturing",
    description:
      "Interest coverage is thinning and debt-to-equity is climbing. Decide whether this manufacturer can safely fund its next expansion.",
  },
  {
    title: "Working capital under pressure",
    level: "Intermediate",
    business: "Restaurant",
    description:
      "Inventory turnover looks healthy, but payables are stretching out. Trace the cash-conversion cycle to find the real story.",
  },
];

const LEVEL_STYLES: Record<PracticeCase["level"], string> = {
  Beginner: "bg-emerald-400/10 text-emerald-300",
  Intermediate: "bg-gold/10 text-gold",
  Advanced: "bg-rose-400/10 text-rose-300",
};

export default function TrainingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
        Free training &amp; practice
      </h1>
      <p className="mt-4 max-w-2xl text-offwhite/70">
        Sharpen your financial-analysis skills with practice cases built on
        the same verified engine that powers the Pro Analyzer. No account
        required — this area is free for everyone.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-offwhite/50">
        Scored quizzes and guided walkthroughs for each practice case are
        coming soon. For now, browse the case library below.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {PRACTICE_CASES.map((practiceCase) => (
          <div
            key={practiceCase.title}
            className="flex flex-col rounded-xl border border-white/10 bg-white/[0.03] p-6"
          >
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEVEL_STYLES[practiceCase.level]}`}
              >
                {practiceCase.level}
              </span>
              <span className="text-xs uppercase tracking-wide text-offwhite/50">
                {practiceCase.business}
              </span>
            </div>
            <h2 className="mt-3 font-serif text-lg font-semibold">
              {practiceCase.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-offwhite/70">
              {practiceCase.description}
            </p>
            <span className="mt-4 inline-flex w-fit cursor-not-allowed rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-offwhite/40">
              Quiz coming soon
            </span>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-gold/30 bg-gold/[0.05] p-6 text-center">
        <h2 className="font-serif text-xl font-semibold">
          Want to analyze your own numbers?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-offwhite/70">
          The Pro Analyzer runs the exact same verified engine on your real
          income statement and balance sheet, then writes a full AI report.
        </p>
        <Link
          href="/pro"
          className="mt-4 inline-block rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-gold-light"
        >
          Open the Pro Analyzer
        </Link>
      </div>
    </div>
  );
}
