import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Keel design tokens, mirrored as Tailwind colors for convenience
        // (e.g. `bg-ink`, `text-accent-hi`). Opacity modifiers (`/10` etc.)
        // are avoided on these in practice since the CSS custom properties
        // are plain hex/rgba strings, not Tailwind's rgb-tuple format —
        // prefer the verbatim Keel component classes (`.btn`, `.card`, …)
        // in globals.css for anything that needs alpha blending.
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        line: "var(--line)",
        text: "var(--text)",
        "text-dim": "var(--text-dim)",
        "text-faint": "var(--text-faint)",
        accent: {
          DEFAULT: "var(--accent)",
          lo: "var(--accent-lo)",
          hi: "var(--accent-hi)",
        },
        pos: "var(--pos)",
        neg: "var(--neg)",
        paper: "var(--paper)",
        "paper-ink": "var(--paper-ink)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
        // Back-compat aliases used by a couple of existing classNames.
        serif: ["var(--font-display)"],
      },
    },
  },
  plugins: [],
};

export default config;
