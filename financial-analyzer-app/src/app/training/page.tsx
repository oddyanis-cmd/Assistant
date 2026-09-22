"use client";

import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { DictKey } from "@/lib/i18n/types";

interface PracticeCase {
  titleKey: DictKey;
  descKey: DictKey;
  levelKey: DictKey;
  levelClass: "beginner" | "intermediate" | "advanced";
  businessKey: DictKey;
}

const PRACTICE_CASES: PracticeCase[] = [
  { titleKey: "case1_t", descKey: "case1_d", levelKey: "lvl_beginner", levelClass: "beginner", businessKey: "bt_retail" },
  { titleKey: "case2_t", descKey: "case2_d", levelKey: "lvl_intermediate", levelClass: "intermediate", businessKey: "bt_saas" },
  { titleKey: "case3_t", descKey: "case3_d", levelKey: "lvl_advanced", levelClass: "advanced", businessKey: "bt_manufacturing" },
  { titleKey: "case4_t", descKey: "case4_d", levelKey: "lvl_intermediate", levelClass: "intermediate", businessKey: "bt_restaurant" },
];

export default function TrainingPage() {
  const { t } = useLanguage();
  return (
    <div>
      <div className="wrap page-head">
        <p className="eyebrow">{t("tr_eye")}</p>
        <h1>{t("tr_h1")}</h1>
        <p className="lead">{t("tr_lead")}</p>
        <p className="lead" style={{ marginTop: 8, fontSize: 14, color: "var(--text-faint)" }}>
          {t("tr_lead2")}
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
            <Reveal as="div" className="card" key={practiceCase.titleKey} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`level-badge ${practiceCase.levelClass}`}>
                  {t(practiceCase.levelKey)}
                </span>
                <span className="eyebrow" style={{ fontSize: 11 }}>
                  {t(practiceCase.businessKey)}
                </span>
              </div>
              <h2 className="card-title" style={{ marginTop: 14, fontSize: 18 }}>
                {t(practiceCase.titleKey)}
              </h2>
              <p style={{ marginTop: 8, flex: 1, fontSize: 14, lineHeight: 1.6, color: "var(--text-dim)" }}>
                {t(practiceCase.descKey)}
              </p>
              <span
                className="btn btn-ghost"
                style={{ marginTop: 16, width: "fit-content", cursor: "not-allowed", opacity: 0.55, fontSize: 12 }}
              >
                {t("btn_quiz_soon")}
              </span>
            </Reveal>
          ))}
        </div>

        <Reveal as="div" className="cta-band" style={{ marginTop: 48 }}>
          <h2>{t("tr_cta_h2")}</h2>
          <p>{t("tr_cta_p")}</p>
          <Link className="btn btn-primary" href="/pro">
            {t("tr_cta_btn")}
          </Link>
        </Reveal>
      </div>
    </div>
  );
}
