"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import type { DictKey } from "@/lib/i18n/types";

const ITEMS: { key: DictKey; value: string }[] = [
  { key: "t_gm", value: "40%" },
  { key: "t_nm", value: "9.75%" },
  { key: "t_roe", value: "24.38%" },
  { key: "t_roic", value: "18.44%" },
  { key: "t_cur", value: "2.0×" },
  { key: "t_inv", value: "5×" },
  { key: "t_ccc", value: "47.45d" },
  { key: "t_ni", value: "97,500 QAR" },
];

export function Ticker() {
  const { t } = useLanguage();
  // Rendered twice back-to-back so the CSS marquee (`translateX(-50%)`) loops seamlessly.
  const doubled = [...ITEMS, ...ITEMS];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {doubled.map((item, i) => (
          <span className="tick" key={`${item.key}-${i}`}>
            <span>{t(item.key)}</span> <b>{item.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
