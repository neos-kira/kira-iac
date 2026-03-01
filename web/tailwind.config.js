/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'ui-sans-serif', 'sans-serif'],
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

