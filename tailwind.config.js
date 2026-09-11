/** @type {import('tailwindcss').Config} */
// Design tokens are transcribed from DocFlow-Build-v6-Complete.md §F.
// Type colours belong to the INTERNAL type and never change with the label.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2b3fd6',
          light: '#4a60ee',
          deep: '#1a2a9e',
          tint: '#eef1ff',
        },
        navy: '#1d2452',
        page: '#eef2fb',
        invoice: { accent: '#2b3fd6', tint: '#e6ebff', deep: '#1e2fae' },
        quotation: { accent: '#534AB7', tint: '#EEEDFE', deep: '#3C3489' },
        receipt: { accent: '#0F6E56', tint: '#E1F5EE', deep: '#085041' },
        waybill: { accent: '#BA7517', tint: '#FAEEDA', deep: '#854F0B' },
        status: {
          info: '#185FA5',
          'info-tint': '#E6F1FB',
          good: '#0F6E56',
          'good-tint': '#E1F5EE',
          warn: '#854F0B',
          'warn-tint': '#FAEEDA',
          bad: '#993C1D',
          'bad-tint': '#FAECE7',
        },
      },
      fontFamily: {
        // Bundled locally — no CDN in the installed app (§F).
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '2xl': '1rem' },
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
    },
  },
  plugins: [],
}
