import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";

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

export default function TrainingPage() {
  return (
    <div>
      <div className="wrap page-head">
        <p className="eyebrow">Free &amp; open</p>
        <h1>Free training &amp; practice</h1>
        <p className="lead">
          Sharpen your financial-analysis skills with practice cases built on
          the same verified engine that powers the Pro Analyzer. No account
          required — this area is free for everyone.
        </p>
        <p className="lead" style={{ marginTop: 8, fontSize: 14, color: "var(--text-faint)" }}>
          Scored quizzes and guided walkthroughs for each practice case are
          coming soon. For now, browse the case library below.
        </p>
      </div>

      <div className="wrap" style={{ paddingBottom: 64 }}>
        <div
          style={{
            marginTop: 24,
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          {PRACTICE_CASES.map((practiceCase) => (
            <Reveal as="div" className="card" key={practiceCase.title} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`level-badge ${practiceCase.level.toLowerCase()}`}>
                  {practiceCase.level}
                </span>
                <span className="eyebrow" style={{ fontSize: 11 }}>
                  {practiceCase.business}
                </span>
              </div>
              <h2 className="card-title" style={{ marginTop: 14, fontSize: 18 }}>
                {practiceCase.title}
              </h2>
              <p style={{ marginTop: 8, flex: 1, fontSize: 14, lineHeight: 1.6, color: "var(--text-dim)" }}>
                {practiceCase.description}
              </p>
              <span
                className="btn btn-ghost"
                style={{ marginTop: 16, width: "fit-content", cursor: "not-allowed", opacity: 0.55, fontSize: 12 }}
              >
                Quiz coming soon
              </span>
            </Reveal>
          ))}
        </div>

        <Reveal as="div" className="cta-band" style={{ marginTop: 48 }}>
          <h2>Want to analyze your own numbers?</h2>
          <p>
            The Pro Analyzer runs the exact same verified engine on your real
            income statement and balance sheet, then writes a full AI report.
          </p>
          <Link className="btn btn-primary" href="/pro">
            Open the Pro Analyzer
          </Link>
        </Reveal>
      </div>
    </div>
  );
}
