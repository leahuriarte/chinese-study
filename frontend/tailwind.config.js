/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: 'var(--color-cream)',
        paper: 'var(--color-paper)',
        stamp: {
          red: 'var(--color-stamp-red)',
          'red-dark': 'var(--color-stamp-red-dark)',
          'red-light': 'var(--color-stamp-red-light)',
        },
        'accent-contrast': 'var(--color-accent-contrast)',
        ink: {
          DEFAULT: 'var(--color-ink)',
          light: 'var(--color-ink-light)',
        },
        border: 'var(--color-border)',
        grid: 'var(--color-grid)',
      },
      fontFamily: {
        display: ['Instrument Serif', 'Noto Serif SC', 'Georgia', 'serif'],
        'display-alt': ['Cormorant Garamond', 'Noto Serif SC', 'Georgia', 'serif'],
        mono: ['Space Mono', 'Courier New', 'monospace'],
        chinese: ['Noto Serif SC', 'Songti SC', 'serif'],
        kaiti: ['KaiTi', 'STKaiti', 'AR PL UKai CN', 'Noto Serif SC', 'serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      boxShadow: {
        'document': '2px 2px 0 color-mix(in srgb, var(--color-ink) 10%, transparent)',
        'document-hover': '4px 4px 0 color-mix(in srgb, var(--color-ink) 15%, transparent)',
        'stamp': 'inset 0 0 10px color-mix(in srgb, var(--color-stamp-red) 20%, transparent)',
      },
      animation: {
        'stamp-press': 'stamp-press 0.4s ease-out forwards',
      },
      keyframes: {
        'stamp-press': {
          '0%': { transform: 'scale(1.2) rotate(-3deg)', opacity: '0' },
          '50%': { transform: 'scale(0.95) rotate(-3deg)' },
          '100%': { transform: 'scale(1) rotate(-3deg)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
