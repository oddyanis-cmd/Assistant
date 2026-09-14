import { describe, it, expect } from "vitest";
import { analyze } from "../analyze";
import { generateReport, buildSampleReport } from "../report";
import { SAMPLE } from "./fixture";

const result = analyze(SAMPLE);

describe("report agent (sample path — no live API call)", () => {
  it("falls back to a sample report when forced / no key", async () => {
    const r = await generateReport(result, { forceSample: true, companyName: "Acme" });
    expect(r.source).toBe("sample");
    expect(r.markdown).toContain("Executive summary");
    expect(r.markdown).toContain("Acme");
  });

  it("uses the engine's verified numbers verbatim", () => {
    const md = buildSampleReport(result, { companyName: "Acme" });
    expect(md).toContain("Profitability");
    expect(md).toContain("Liquidity");
    expect(md).toContain("40%"); // gross margin, from the engine
    expect(md).toContain("97,500"); // net income, from the engine
  });

  it("shows n/a instead of fabricating a missing metric", () => {
    const noRev = analyze({ ...SAMPLE, income: { ...SAMPLE.income, revenue: 0 } });
    const md = buildSampleReport(noRev);
    expect(md).toContain("n/a");
  });
});
