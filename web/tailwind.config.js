/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'display':     ['20px', { lineHeight: '1.3',  letterSpacing: '-0.025em', fontWeight: '700' }],
        'heading':     ['15px', { lineHeight: '1.35', letterSpacing: '-0.02em',  fontWeight: '700' }],
        'body':        ['13px', { lineHeight: '1.55', letterSpacing: '-0.01em',  fontWeight: '500' }],
        'label':       ['11px', { lineHeight: '1.4',  letterSpacing: '0.02em',   fontWeight: '500' }],
        'sublabel':    ['10px', { lineHeight: '1.4',  letterSpacing: '0.12em',   fontWeight: '600' }],
        'button':      ['13px', { lineHeight: '1',    letterSpacing: '-0.005em', fontWeight: '600' }],
        'input':       ['16px', { lineHeight: '1.5',  letterSpacing: '-0.01em'  }],
        'display-pc':  ['28px', { lineHeight: '1.25', letterSpacing: '-0.03em',  fontWeight: '700' }],
        'heading-pc':  ['20px', { lineHeight: '1.3',  letterSpacing: '-0.025em', fontWeight: '700' }],
        'body-pc':     ['15px', { lineHeight: '1.6',  letterSpacing: '-0.01em',  fontWeight: '400' }],
        'label-pc':    ['12px', { lineHeight: '1.4',  letterSpacing: '0.02em',   fontWeight: '500' }],
        'sublabel-pc': ['11px', { lineHeight: '1.4',  letterSpacing: '0.12em',   fontWeight: '600' }],
        'button-pc':   ['14px', { lineHeight: '1',    letterSpacing: '-0.005em', fontWeight: '600' }],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          900: '#0b1120',
        },
      },
      boxShadow: {
        'soft-card':
          '0 18px 45px rgba(15, 23, 42, 0.45), 0 1px 0 rgba(148, 163, 184, 0.15)',
      },
    },
  },
  plugins: [],
}

