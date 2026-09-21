import { Ticker } from "@/components/home/Ticker";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Differentiator } from "@/components/home/Differentiator";
import { Capabilities } from "@/components/home/Capabilities";
import { ResultsDashboard } from "@/components/home/ResultsDashboard";
import { SampleReportShowcase } from "@/components/home/SampleReportShowcase";
import { Pricing } from "@/components/home/Pricing";
import { About } from "@/components/home/About";
import { Contact } from "@/components/home/Contact";
import { CtaBand } from "@/components/home/CtaBand";

export default function HomePage() {
  return (
    <>
      <Ticker />
      <div id="top">
        <Hero />
        <HowItWorks />
        <Differentiator />
        <Capabilities />
        <ResultsDashboard />
        <SampleReportShowcase />
        <Pricing />
        <About />
        <Contact />
        <CtaBand />
      </div>
    </>
  );
}
