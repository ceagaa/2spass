/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FF4103',
          50: '#FFF1EC',
          100: '#FFE0D3',
          200: '#FFBFA6',
          300: '#FF9A73',
          400: '#FF6D3B',
          500: '#FF4103',
          600: '#E03602',
          700: '#B82C02',
          800: '#8F2201',
          900: '#661800',
        },
        base: 'var(--base)',
        surface: 'var(--surface)',
        elevated: 'var(--elevated)',
        ink: {
          DEFAULT: 'var(--ink)',
          secondary: 'var(--ink-secondary)',
          tertiary: 'var(--ink-tertiary)',
        },
        line: 'var(--line)',
        hover: 'rgb(var(--c-hover) / <alpha-value>)',
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          strong: 'var(--danger-strong)',
          soft: 'var(--danger-soft)',
          'soft-strong': 'var(--danger-soft-strong)',
          line: 'var(--danger-line)',
          solid: 'var(--danger-solid)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        md: '0.5rem',
        lg: '0.75rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,65,3,.35), 0 8px 30px -10px rgba(255,65,3,.45)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        'scale-in': 'scale-in .16s ease-out',
      },
    },
  },
  plugins: [],
}
