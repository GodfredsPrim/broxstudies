/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          0: '#FFFFFF',
          50: '#F7F8FA',
          100: '#ECEEF2',
          200: '#D5D9E0',
          300: '#AFB5C1',
          400: '#818796',
          500: '#5B6271',
          600: '#3F4552',
          700: '#2A2F3A',
          800: '#1A1D26',
          900: '#111319',
          950: '#0A0C11',
        },
        emerald: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        amber: {
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        rose: {
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
        },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.025em',
      },
      boxShadow: {
        'glow-sm': '0 0 0 1px rgba(16,185,129,0.18), 0 6px 20px -4px rgba(16,185,129,0.2)',
        'glow-md': '0 0 0 1px rgba(16,185,129,0.24), 0 16px 40px -12px rgba(16,185,129,0.35)',
        'edge-sm': '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 2px 0 rgba(0,0,0,0.3)',
        'edge-md': '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 8px 24px -6px rgba(0,0,0,0.5)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
        swift: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        'drift': 'drift 14s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(8px,-12px,0) scale(1.03)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.85' },
        },
      },
    },
  },
  plugins: [],
}
