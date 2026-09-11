/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          900: '#0d2b22',
          800: '#123b2e',
          700: '#1b5240',
        },
        cream: '#f1e8d6',
        chip: {
          red: '#b5443a',
          blue: '#2f5f7a',
          gold: '#c79a4b',
        },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
