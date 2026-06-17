import type { Config } from 'tailwindcss';

// Ported from Dana's design-system/tailwind.config.js
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── COLOR PALETTE ──────────────────────────────────────────────
      colors: {
        primary: {
          50:  '#fdf5f3',
          100: '#fbe9e4',
          200: '#f6d1c9',
          300: '#efafa3',
          400: '#e48070',
          500: '#d4614f',
          600: '#c04535',
          700: '#a0372a',
          800: '#852f25',
          900: '#6f2b23',
          950: '#3c1310',
          DEFAULT: '#d4614f',
        },
        accent: {
          50:  '#fdf8ee',
          100: '#faedd0',
          200: '#f4d89d',
          300: '#ecbd5e',
          400: '#e5a330',
          500: '#d98818',
          600: '#c16a12',
          700: '#a04e13',
          800: '#833e16',
          900: '#6c3415',
          DEFAULT: '#d98818',
        },
        background: '#faf8f6',
        surface:    '#ffffff',
        'surface-alt': '#f3ede9',
        muted: {
          DEFAULT: '#9c8e88',
          subtle:  '#c4b9b4',
          strong:  '#6b5e59',
        },
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          DEFAULT: '#16a34a',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          DEFAULT: '#d97706',
        },
        danger: {
          50:  '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          DEFAULT: '#dc2626',
        },
        text: {
          primary:   '#2c2220',
          secondary: '#6b5e59',
          tertiary:  '#9c8e88',
          inverse:   '#faf8f6',
          link:      '#c04535',
        },
        border: {
          DEFAULT: '#e8ddd9',
          strong:  '#cfc4bf',
          subtle:  '#f0ebe8',
        },
      },

      // ── TYPOGRAPHY ─────────────────────────────────────────────────
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'ui-serif', 'serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        'display-2xl': ['4rem',    { lineHeight: '1.1',  letterSpacing: '-0.02em',  fontWeight: '700' }],
        'display-xl':  ['3rem',    { lineHeight: '1.15', letterSpacing: '-0.02em',  fontWeight: '700' }],
        'display-lg':  ['2.25rem', { lineHeight: '1.2',  letterSpacing: '-0.015em', fontWeight: '600' }],
        'h1': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em',  fontWeight: '600' }],
        'h2': ['1.5rem',   { lineHeight: '1.3',  letterSpacing: '-0.008em', fontWeight: '600' }],
        'h3': ['1.25rem',  { lineHeight: '1.35', letterSpacing: '-0.005em', fontWeight: '600' }],
        'h4': ['1.125rem', { lineHeight: '1.4',  letterSpacing: '0',        fontWeight: '600' }],
        'body-lg': ['1.0625rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body':    ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.875rem',  { lineHeight: '1.5', fontWeight: '400' }],
        'label':   ['0.8125rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.01em' }],
        'caption': ['0.75rem',   { lineHeight: '1.4', fontWeight: '400', letterSpacing: '0.01em' }],
        'overline':['0.6875rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '0.1em'  }],
      },

      // ── BORDER RADIUS ──────────────────────────────────────────────
      borderRadius: {
        'none': '0',
        'xs':   '4px',
        'sm':   '6px',
        DEFAULT: '8px',
        'md':   '10px',
        'lg':   '12px',
        'xl':   '16px',
        '2xl':  '20px',
        '3xl':  '24px',
        'card': '16px',
        'pill': '999px',
        'full': '9999px',
      },

      // ── SHADOWS ────────────────────────────────────────────────────
      boxShadow: {
        'xs':          '0 1px 2px 0 rgba(44, 34, 32, 0.04)',
        'sm':          '0 1px 3px 0 rgba(44, 34, 32, 0.06), 0 1px 2px -1px rgba(44, 34, 32, 0.04)',
        DEFAULT:       '0 2px 8px 0 rgba(44, 34, 32, 0.08), 0 1px 3px -1px rgba(44, 34, 32, 0.04)',
        'md':          '0 4px 12px -2px rgba(44, 34, 32, 0.10), 0 2px 6px -2px rgba(44, 34, 32, 0.06)',
        'lg':          '0 8px 24px -4px rgba(44, 34, 32, 0.12), 0 4px 8px -4px rgba(44, 34, 32, 0.06)',
        'xl':          '0 16px 40px -8px rgba(44, 34, 32, 0.14), 0 8px 16px -8px rgba(44, 34, 32, 0.08)',
        'card':        '0 2px 8px 0 rgba(44, 34, 32, 0.08)',
        'card-hover':  '0 8px 24px -4px rgba(44, 34, 32, 0.14)',
        'sidebar':     '4px 0 16px 0 rgba(44, 34, 32, 0.06)',
        'topbar':      '0 1px 0 0 rgba(44, 34, 32, 0.08)',
        'inner':       'inset 0 2px 4px 0 rgba(44, 34, 32, 0.06)',
        'none':        'none',
      },

      // ── TRANSITIONS ────────────────────────────────────────────────
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
      },
      transitionTimingFunction: {
        'salon': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },

      // ── ANIMATION ──────────────────────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          '0%':   { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'fade-in':       'fade-in 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'slide-in-left': 'slide-in-left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'skeleton':      'skeleton-pulse 1.5s ease-in-out infinite',
        'shimmer':       'shimmer 1.5s ease-in-out infinite',
      },

      // ── SCREENS ────────────────────────────────────────────────────
      screens: {
        'xs':  '375px',
        'sm':  '640px',
        'md':  '768px',
        'lg':  '1024px',
        'xl':  '1280px',
        '2xl': '1440px',
      },

      // ── SPACING aliases ────────────────────────────────────────────
      spacing: {
        'sidebar-width':           '256px',
        'sidebar-width-collapsed': '64px',
        'topbar-height':           '64px',
        'content-max-width':       '1200px',
      },
    },
  },
  plugins: [],
};

export default config;
