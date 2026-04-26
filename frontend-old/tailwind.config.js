/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        ghana: {
          red: '#c61f1f',
          gold: '#e1a310',
          green: '#0b7a4b',
        },
        // BroxStudies Ghana-education palette.
        // Scholarly ink-blue + brass gold + cream surfaces. Use these for
        // new screens; legacy `ghana.*` kept for backward compat only.
        gh: {
          'ink-blue':      '#1E3A8A',
          'ink-blue-600':  '#172E6E',
          'ink-blue-50':   '#E8EDF9',
          brass:           '#C99B3A',
          'brass-600':     '#A67E28',
          'brass-50':      '#FAF1DC',
          ember:           '#B8202C',
          'ember-50':      '#FBE7E9',
          cream:           '#FAF7F0',
          paper:           '#FFFFFF',
          chalk:           '#F1ECE1',
          ink:             '#1A1A1A',
          'ink-60':        '#4A4A4A',
          'ink-40':        '#7A7A7A',
          night:           '#0B1226',
          'night-raised':  '#141D3A',
          'gold-glow':     '#E5B84B',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'brand-sm':   '0 4px 12px rgba(30, 58, 138, 0.08)',
        'brand-md':   '0 10px 25px rgba(30, 58, 138, 0.12)',
        'brand-lg':   '0 20px 40px rgba(30, 58, 138, 0.16)',
        'brand-glow': '0 0 0 4px rgba(201, 155, 58, 0.25)',
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        hand: ['"Patrick Hand"', '"Caveat"', 'cursive'],
      },
      transitionTimingFunction: {
        'brand': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "rise": "rise 0.25s ease-out",
        "shimmer": "shimmer 1.6s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}