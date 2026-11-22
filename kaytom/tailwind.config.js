/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#00B4D8', hover: '#0096C7', soft: '#90E0EF', ink: '#04242C' },
        app: 'var(--bg)', panel: 'var(--panel)', line: 'var(--line)',
        ink: 'var(--text)', muted: 'var(--muted)', bubbleIn: 'var(--in)',
      },
      fontFamily: { sans: ['Manrope', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
