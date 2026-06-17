/** @type {import('tailwindcss').Config} */

// ─────────────────────────────────────────────────────────────────
// BELZA SALON — Design System Tokens
// Theme extension for tailwind.config.js
// Author: Dana (Designer)
// ─────────────────────────────────────────────────────────────────

const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ─── COLOR PALETTE ───────────────────────────────────────────
      // Rationale: Rosy-gold primary evokes luxury without feeling
      // dated. Warm cream backgrounds prevent clinical coldness.
      // Charcoal text keeps WCAG AA contrast on all surfaces.
      colors: {
        // Brand primary: dusty rose-gold — warm, feminine, refined
        primary: {
          50:  '#fdf5f3',
          100: '#fbe9e4',
          200: '#f6d1c9',
          300: '#efafa3',
          400: '#e48070',
          500: '#d4614f', // main CTA
          600: '#c04535',
          700: '#a0372a',
          800: '#852f25',
          900: '#6f2b23',
          950: '#3c1310',
          DEFAULT: '#d4614f',
        },

        // Accent: warm antique gold — used for highlights, stars, badges
        accent: {
          50:  '#fdf8ee',
          100: '#faedd0',
          200: '#f4d89d',
          300: '#ecbd5e',
          400: '#e5a330',
          500: '#d98818', // main accent
          600: '#c16a12',
          700: '#a04e13',
          800: '#833e16',
          900: '#6c3415',
          DEFAULT: '#d98818',
        },

        // Background: warm off-white — keeps the space airy and warm
        background: '#faf8f6',

        // Surface: pure white card backgrounds
        surface: '#ffffff',

        // Surface-alt: very subtle warm tint for sidebar, dividers
        'surface-alt': '#f3ede9',

        // Muted: warm mid-gray for secondary text, placeholders, labels
        muted: {
          DEFAULT: '#9c8e88',
          subtle: '#c4b9b4',
          strong: '#6b5e59',
        },

        // Semantic states
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

        // Text hierarchy
        text: {
          primary:   '#2c2220', // near-black with warmth — 15.2:1 on white
          secondary: '#6b5e59', // warm dark gray — 5.5:1 on white (AA)
          tertiary:  '#9c8e88', // muted labels — use on surface-alt only
          inverse:   '#faf8f6', // on dark/colored backgrounds
          link:      '#c04535', // primary-600, meets AA on white
        },

        // Border
        border: {
          DEFAULT: '#e8ddd9',
          strong:  '#cfc4bf',
          subtle:  '#f0ebe8',
        },
      },

      // ─── TYPOGRAPHY ──────────────────────────────────────────────
      // Body: Inter — clean geometric sans, excellent at small sizes
      // Display: Playfair Display — editorial serif for hero headlines
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'ui-serif', 'serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        // Display — hero headlines (Playfair)
        'display-2xl': ['4rem',    { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-xl':  ['3rem',    { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg':  ['2.25rem', { lineHeight: '1.2',  letterSpacing: '-0.015em',fontWeight: '600' }],
        // Headings (Inter, semibold)
        'h1':  ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em',  fontWeight: '600' }],
        'h2':  ['1.5rem',   { lineHeight: '1.3',  letterSpacing: '-0.008em', fontWeight: '600' }],
        'h3':  ['1.25rem',  { lineHeight: '1.35', letterSpacing: '-0.005em', fontWeight: '600' }],
        'h4':  ['1.125rem', { lineHeight: '1.4',  letterSpacing: '0',        fontWeight: '600' }],
        // Body
        'body-lg': ['1.0625rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body':    ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.875rem',  { lineHeight: '1.5', fontWeight: '400' }],
        // Small / labels
        'label':   ['0.8125rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.01em' }],
        'caption': ['0.75rem',   { lineHeight: '1.4', fontWeight: '400', letterSpacing: '0.01em' }],
        'overline':['0.6875rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '0.1em'  }],
      },

      // ─── SPACING ─────────────────────────────────────────────────
      // 4px base — standard 4pt grid
      // Named aliases for semantic use alongside Tailwind numeric scale
      spacing: {
        '0.5': '2px',
        '1':   '4px',
        '1.5': '6px',
        '2':   '8px',
        '2.5': '10px',
        '3':   '12px',
        '3.5': '14px',
        '4':   '16px',
        '5':   '20px',
        '6':   '24px',
        '7':   '28px',
        '8':   '32px',
        '9':   '36px',
        '10':  '40px',
        '11':  '44px',
        '12':  '48px',
        '14':  '56px',
        '16':  '64px',
        '18':  '72px',
        '20':  '80px',
        '24':  '96px',
        '28':  '112px',
        '32':  '128px',
        '36':  '144px',
        '40':  '160px',
        '48':  '192px',
        '56':  '224px',
        '64':  '256px',
        '72':  '288px',
        '80':  '320px',
        '96':  '384px',
        // Semantic aliases
        'sidebar-width':       '256px',
        'sidebar-width-collapsed': '64px',
        'topbar-height':       '64px',
        'content-max-width':   '1200px',
      },

      // ─── BORDER RADIUS ───────────────────────────────────────────
      // Generous rounding is a core part of the Belza aesthetic
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
        'card': '16px',   // card default
        'pill': '999px',  // badges, chips
        'full': '9999px',
      },

      // ─── SHADOWS ─────────────────────────────────────────────────
      // Soft, diffused — no harsh drop shadows
      boxShadow: {
        'xs':     '0 1px 2px 0 rgba(44, 34, 32, 0.04)',
        'sm':     '0 1px 3px 0 rgba(44, 34, 32, 0.06), 0 1px 2px -1px rgba(44, 34, 32, 0.04)',
        DEFAULT:  '0 2px 8px 0 rgba(44, 34, 32, 0.08), 0 1px 3px -1px rgba(44, 34, 32, 0.04)',
        'md':     '0 4px 12px -2px rgba(44, 34, 32, 0.10), 0 2px 6px -2px rgba(44, 34, 32, 0.06)',
        'lg':     '0 8px 24px -4px rgba(44, 34, 32, 0.12), 0 4px 8px -4px rgba(44, 34, 32, 0.06)',
        'xl':     '0 16px 40px -8px rgba(44, 34, 32, 0.14), 0 8px 16px -8px rgba(44, 34, 32, 0.08)',
        'card':   '0 2px 8px 0 rgba(44, 34, 32, 0.08)',
        'card-hover': '0 8px 24px -4px rgba(44, 34, 32, 0.14)',
        'sidebar':'4px 0 16px 0 rgba(44, 34, 32, 0.06)',
        'topbar': '0 1px 0 0 rgba(44, 34, 32, 0.08)',
        'inner':  'inset 0 2px 4px 0 rgba(44, 34, 32, 0.06)',
        'none':   'none',
      },

      // ─── TRANSITIONS ─────────────────────────────────────────────
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
      },
      transitionTimingFunction: {
        'salon': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },

      // ─── ANIMATION ───────────────────────────────────────────────
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
        'spin-slow': {
          'from': { transform: 'rotate(0deg)' },
          'to':   { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in':       'fade-in 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'slide-in-left': 'slide-in-left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'skeleton':      'skeleton-pulse 1.5s ease-in-out infinite',
        'spin-slow':     'spin-slow 1.2s linear infinite',
      },

      // ─── SCREENS (breakpoints) ───────────────────────────────────
      screens: {
        'xs':  '375px',
        'sm':  '640px',
        'md':  '768px',
        'lg':  '1024px',
        'xl':  '1280px',
        '2xl': '1440px',
      },
    },
  },

  plugins: [
    // Variant: .focus-visible for accessible focus rings
    plugin(function ({ addBase, addComponents, addVariant, theme }) {

      // ── Global base styles ──────────────────────────────────────
      addBase({
        ':root': {
          // Color tokens as CSS custom properties
          '--color-primary':        theme('colors.primary.500'),
          '--color-primary-dark':   theme('colors.primary.600'),
          '--color-primary-light':  theme('colors.primary.100'),
          '--color-accent':         theme('colors.accent.500'),
          '--color-accent-dark':    theme('colors.accent.600'),
          '--color-background':     theme('colors.background'),
          '--color-surface':        theme('colors.surface'),
          '--color-surface-alt':    theme('colors.surface-alt'),
          '--color-muted':          theme('colors.muted.DEFAULT'),
          '--color-muted-subtle':   theme('colors.muted.subtle'),
          '--color-muted-strong':   theme('colors.muted.strong'),
          '--color-success':        theme('colors.success.DEFAULT'),
          '--color-warning':        theme('colors.warning.DEFAULT'),
          '--color-danger':         theme('colors.danger.DEFAULT'),
          '--color-text-primary':   theme('colors.text.primary'),
          '--color-text-secondary': theme('colors.text.secondary'),
          '--color-text-tertiary':  theme('colors.text.tertiary'),
          '--color-text-inverse':   theme('colors.text.inverse'),
          '--color-text-link':      theme('colors.text.link'),
          '--color-border':         theme('colors.border.DEFAULT'),
          '--color-border-strong':  theme('colors.border.strong'),
          '--color-border-subtle':  theme('colors.border.subtle'),
          // Spacing tokens
          '--sidebar-width':        theme('spacing.sidebar-width'),
          '--topbar-height':        theme('spacing.topbar-height'),
          // Typography
          '--font-sans':            theme('fontFamily.sans').join(', '),
          '--font-display':         theme('fontFamily.display').join(', '),
          // Radii
          '--radius-card':          theme('borderRadius.card'),
          '--radius-pill':          theme('borderRadius.pill'),
        },
        '*': { boxSizing: 'border-box' },
        'body': {
          backgroundColor: theme('colors.background'),
          color:           theme('colors.text.primary'),
          fontFamily:      theme('fontFamily.sans').join(', '),
          fontSize:        '15px',
          lineHeight:      '1.6',
          '-webkit-font-smoothing': 'antialiased',
          '-moz-osx-font-smoothing': 'grayscale',
        },
        // Global focus ring — visible and on-brand
        ':focus-visible': {
          outline:       `2px solid ${theme('colors.primary.500')}`,
          outlineOffset: '2px',
          borderRadius:  '4px',
        },
        // Remove default focus for mouse users
        ':focus:not(:focus-visible)': {
          outline: 'none',
        },
      });
    }),
  ],
};
