"use client";

import { useRef } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PALETTES, useTheme, type PresetPalette } from "@/components/providers/ThemeProvider";

/** Fixed theme dock — 5 presets + a custom colour picker, verbatim UI from keel-landing. */
export function PaletteDock() {
  const { t } = useLanguage();
  const { palette, setPalette, setCustom, customHex } = useTheme();
  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="pal-dock" role="group" aria-label="Colour theme">
      <span className="pl">{t("theme_label")}</span>
      {PALETTES.map((p) => (
        <button
          key={p.id}
          type="button"
          className={palette === p.id ? "on" : undefined}
          style={{ background: p.hex }}
          title={p.label}
          aria-label={p.label}
          onClick={() => setPalette(p.id as PresetPalette)}
        />
      ))}
      <button
        type="button"
        className={`pal-custom${palette === "custom" ? " on" : ""}`}
        title="Custom colour"
        aria-label="Choose a custom colour"
        onClick={() => colorInputRef.current?.click()}
      />
      <input
        ref={colorInputRef}
        type="color"
        value={customHex}
        aria-label="Pick a custom colour"
        tabIndex={-1}
        onChange={(e) => setCustom(e.target.value)}
      />
    </div>
  );
}
