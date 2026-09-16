/** @type {import('tailwindcss').Config} */
// Design tokens are transcribed from DocFlow-Build-v6-Complete.md §F.
// Type colours belong to the INTERNAL type and never change with the label.
//
// THEMED tokens are CSS variables, resolved in src/index.css. That is what
// makes dark mode a palette change rather than 245 `dark:` variants bolted
// onto every surface in the app — `bg-surface/70` is one class that is right
// in both themes, and a screen written tomorrow gets dark mode for free
// instead of needing to remember it.
//
// The `<alpha-value>` form keeps Tailwind's opacity modifiers working, which
// matters here more than usual: §F's glass layer is built from them.
const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /** The page behind everything (§F: `#eef2fb` in light). */
        page: themed('page'),
        /** A glass card, pill or chip (§F: translucent white in light). */
        surface: themed('surface'),
        /** Body text, and any wash made of it (§F text-navy in light). */
        ink: themed('ink'),
        /** §F's hairline borders: black in light, white in dark. */
        edge: themed('edge'),
        // ACCENTS AND DEEPS ARE FIXED, in both themes.
        //
        // §F: "colours belong to the internal type and never change with the
        // label", and §F is marked Locked. A dark theme may not restate the
        // brand — it may only change what the brand sits ON. So every accent
        // below is the literal §F value in light and in dark alike.
        brand: {
          DEFAULT: '#2b3fd6',
          light: '#4a60ee',
          deep: '#1a2a9e',
          // A TINT is a light wash by definition, so it is the one part of a
          // palette that cannot survive inversion: the same wash on a dark
          // page is a glare. Themed.
          tint: themed('brand-tint'),
        },
        navy: '#1d2452',
        /**
         * White on a locked accent — a hero's sheen, a step bar's fill, the
         * logo holder's paper. Fixed in both themes like the accent beneath
         * it; see the note in `src/index.css`.
         */
        'on-accent': themed('on-accent'),
        invoice: { accent: '#2b3fd6', tint: themed('invoice-tint'), deep: '#1e2fae' },
        quotation: { accent: '#534AB7', tint: themed('quotation-tint'), deep: '#3C3489' },
        receipt: { accent: '#0F6E56', tint: themed('receipt-tint'), deep: '#085041' },
        waybill: { accent: '#BA7517', tint: themed('waybill-tint'), deep: '#854F0B' },
        // Status inks are themed as well as their tints: §F's warn ink is a
        // dark brown chosen to read on a pale wash, and it disappears on the
        // dark one. The HUE is kept; only the lightness moves.
        status: {
          info: themed('status-info'),
          'info-tint': themed('status-info-tint'),
          good: themed('status-good'),
          'good-tint': themed('status-good-tint'),
          warn: themed('status-warn'),
          'warn-tint': themed('status-warn-tint'),
          bad: themed('status-bad'),
          'bad-tint': themed('status-bad-tint'),
        },
      },
      fontFamily: {
        /*
         * WHAT THE APP ACTUALLY RENDERS IN, which is not what this line used
         * to say.
         *
         * §F asks for "Plus Jakarta Sans, bundled and loaded locally;
         * Inter/system as fallback", and this named both — while the repository
         * shipped neither font file and declared no `@font-face`. So every
         * screen has silently fallen back to the system UI font since the
         * design system was written, and the config described a product that
         * did not exist.
         *
         * Naming only what ships is the honest half of the fix. THE OTHER HALF
         * IS AN ASSET TASK, not a code one: Plus Jakarta Sans is OFL-licensed,
         * so bundling it means shipping the font files AND the licence notice
         * that OFL requires to travel with them. `src/web/fonts.test.ts` fails
         * the moment a family is named without a file behind it, so this
         * cannot quietly revert — and it will pass again the day the files and
         * the notice land together.
         *
         * §V's rule holds either way: no CDN, ever. A webfont link would be
         * the same bug wearing different clothes.
         */
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: { '2xl': '1rem' },
      keyframes: {
        // The prototype's slow sheen across the header band. Guarded by
        // `motion-safe:` at every call site (§F, §V).
        'header-sheen': {
          '0%': { transform: 'translateX(-130%) skewX(-18deg)' },
          '100%': { transform: 'translateX(340%) skewX(-18deg)' },
        },
      },
      animation: { 'header-sheen': 'header-sheen 3.6s linear infinite' },
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
    },
  },
  plugins: [],
}
