"use client";

/**
 * Theme/palette context — a direct port of keel-landing's `setPal` /
 * `applyCustom` logic. Five presets (amber default + midnight/emerald/plum/
 * onyx) are switched via the `data-palette` attribute on <html> (CSS in
 * globals.css does the rest). A custom colour derives --accent-hi/-lo/-soft/
 * -glow and flips --on-accent by luminance, applied as inline custom
 * properties on <html>, exactly like the source.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const PALETTES = [
  { id: "orange", hex: "#e28a4d", label: "Amber (default)" },
  { id: "midnight", hex: "#6ea8d8", label: "Midnight Ice" },
  { id: "emerald", hex: "#59c58f", label: "Deep Emerald" },
  { id: "plum", hex: "#cf8fb6", label: "Royal Plum" },
  { id: "onyx", hex: "#c3ccd6", label: "Onyx Platinum" },
] as const;

export type PresetPalette = (typeof PALETTES)[number]["id"];
export type PaletteId = PresetPalette | "custom";

const PAL_KEY = "keel_pal";
const CUSTOM_KEY = "keel_custom";

const CUSTOM_VARS = [
  "--accent",
  "--accent-hi",
  "--accent-lo",
  "--accent-soft",
  "--accent-glow",
  "--on-accent",
] as const;

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = (hex || "").replace("#", "");
  const full = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(rgb: number[]): string {
  return "#" + rgb.map((n) => clamp255(n).toString(16).padStart(2, "0")).join("");
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgba(a: RGB, alpha: number): string {
  return `rgba(${clamp255(a[0])},${clamp255(a[1])},${clamp255(a[2])},${alpha})`;
}

function relativeLuminance(a: RGB): number {
  const s = a.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}

interface ThemeContextValue {
  palette: PaletteId;
  customHex: string;
  setPalette: (id: PresetPalette) => void;
  setCustom: (hex: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function clearCustomVars(root: HTMLElement) {
  CUSTOM_VARS.forEach((v) => root.style.removeProperty(v));
}

function applyPreset(root: HTMLElement, id: PresetPalette) {
  clearCustomVars(root);
  if (id === "orange") root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", id);
}

function applyCustomColor(root: HTMLElement, hex: string) {
  const rgb = hexToRgb(hex);
  root.removeAttribute("data-palette");
  root.style.setProperty("--accent", hex);
  root.style.setProperty("--accent-hi", rgbToHex(mix(rgb, [255, 255, 255], 0.32)));
  root.style.setProperty("--accent-lo", rgbToHex(mix(rgb, [0, 0, 0], 0.16)));
  root.style.setProperty("--accent-soft", rgba(rgb, 0.14));
  root.style.setProperty("--accent-glow", rgba(rgb, 0.48));
  root.style.setProperty("--on-accent", relativeLuminance(rgb) > 0.5 ? "#141210" : "#f5efe8");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<PaletteId>("orange");
  const [customHex, setCustomHex] = useState<string>("#e28a4d");

  // Apply persisted choice after mount (server always renders the default
  // amber palette, so hydration never mismatches).
  useEffect(() => {
    try {
      const storedPal = localStorage.getItem(PAL_KEY);
      const storedCustom = localStorage.getItem(CUSTOM_KEY);
      if (storedPal === "custom" && storedCustom) {
        setCustomHex(storedCustom);
        setPaletteState("custom");
      } else if (storedPal && storedPal !== "orange") {
        setPaletteState(storedPal as PresetPalette);
      }
    } catch {
      // localStorage unavailable — stay on the default amber palette.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (palette === "custom") applyCustomColor(root, customHex);
    else applyPreset(root, palette);
  }, [palette, customHex]);

  const setPalette = useCallback((id: PresetPalette) => {
    setPaletteState(id);
    try {
      localStorage.setItem(PAL_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const setCustom = useCallback((hex: string) => {
    setCustomHex(hex);
    setPaletteState("custom");
    try {
      localStorage.setItem(PAL_KEY, "custom");
      localStorage.setItem(CUSTOM_KEY, hex);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ palette, customHex, setPalette, setCustom }),
    [palette, customHex, setPalette, setCustom]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
