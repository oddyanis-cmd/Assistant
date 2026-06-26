import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Shiny Beauty Center brand palette — soft rose/blush luxury
        rose: {
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
          950: "#4c0519",
        },
        blush: {
          50: "#fef7f0",
          100: "#fdeee0",
          200: "#fbd9bc",
          300: "#f8be8f",
          400: "#f49860",
          500: "#f07a38",
          600: "#e15f1e",
          700: "#bb4a18",
          800: "#953d1b",
          900: "#783519",
        },
        nude: {
          50: "#fdf8f6",
          100: "#f9ede8",
          200: "#f2d9d0",
          300: "#e8bfb0",
          400: "#d99f8b",
          500: "#c97e6a",
          600: "#b36251",
          700: "#944f40",
          800: "#794337",
          900: "#633930",
        },
        cream: {
          50: "#fefdfb",
          100: "#fdf8f0",
          200: "#faeedd",
          300: "#f5e0c0",
          400: "#eecb96",
          500: "#e4b06b",
          600: "#d4924a",
          700: "#b2753a",
          800: "#8f5e32",
          900: "#744d2b",
        },
        charcoal: {
          50: "#f6f6f7",
          100: "#e2e3e6",
          200: "#c5c6cc",
          300: "#a0a1aa",
          400: "#7c7e89",
          500: "#62636e",
          600: "#4e4f5a",
          700: "#41424b",
          800: "#37383f",
          900: "#2d2e35",
          950: "#1a1b20",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "Noto Sans Arabic", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #fecdd3 0%, #fdf8f0 50%, #fbd9bc 100%)",
        "gradient-hero": "linear-gradient(160deg, #fff1f2 0%, #fdf8f0 40%, #fef7f0 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
