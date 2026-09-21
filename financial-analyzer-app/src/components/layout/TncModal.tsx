"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";

/**
 * Subscription-terms modal. Ported from keel-landing's event-delegated
 * `.tnc-link` click handling: any element with class `tnc-link` anywhere on
 * the page (footer, pricing section, …) opens this modal, so no prop
 * drilling is needed between unrelated components.
 */
export function TncModal() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".tnc-link")) {
        e.preventDefault();
        setOpen(true);
      }
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown);
    };
  }, []);

  const sections = [
    ["tnc_1h", "tnc_1p"],
    ["tnc_2h", "tnc_2p"],
    ["tnc_3h", "tnc_3p"],
    ["tnc_4h", "tnc_4p"],
    ["tnc_5h", "tnc_5p"],
    ["tnc_6h", "tnc_6p"],
  ] as const;

  return (
    <div
      className={`modal${open ? " open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tncTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="modal-panel">
        <div className="modal-head">
          <h3 id="tncTitle">{t("tnc_title")}</h3>
          <button
            className="modal-close"
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>{t("tnc_intro")}</p>
          {sections.map(([h, p]) => (
            <div key={h}>
              <h4>{t(h)}</h4>
              <p>{t(p)}</p>
            </div>
          ))}
          <p className="tnote">{t("tnc_note")}</p>
        </div>
      </div>
    </div>
  );
}
