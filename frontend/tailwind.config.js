/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#f7f3eb',
        paper: '#faf6ee',
        stamp: {
          red: '#c54b3c',
          'red-dark': '#a33d31',
          'red-light': '#e8d4d0',
        },
        ink: {
          DEFAULT: '#2c2420',
          light: '#5c5450',
        },
        border: '#d4c8b8',
        grid: '#e8e0d4',
      },
      fontFamily: {
        display: ['Playfair Display', 'Noto Serif SC', 'serif'],
        mono: ['Space Mono', 'Courier New', 'monospace'],
        chinese: ['Noto Serif SC', 'Songti SC', 'serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      boxShadow: {
        'document': '2px 2px 0 rgba(44, 36, 32, 0.1)',
        'document-hover': '4px 4px 0 rgba(44, 36, 32, 0.15)',
        'stamp': 'inset 0 0 10px rgba(197, 75, 60, 0.2)',
      },
      animation: {
        'stamp-press': 'stamp-press 0.4s ease-out forwards',
      },
      keyframes: {
        'stamp-press': {
          '0%': { transform: 'scale(1.2) rotate(-5deg)', opacity: '0' },
          '50%': { transform: 'scale(0.95) rotate(-5deg)' },
          '100%': { transform: 'scale(1) rotate(-5deg)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
