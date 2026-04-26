/**
 * BroxStudies design tokens — single source of truth.
 *
 * CSS variables in index.css drive Tailwind utilities and shadcn primitives;
 * this TS mirror is for non-CSS contexts (framer-motion configs, inline
 * styles, chart/SVG fills, canvas colors). Keep values in sync with the
 * :root block in index.css.
 */

export const colors = {
  gh: {
    inkBlue:     "#1E3A8A",
    inkBlue600:  "#172E6E",
    inkBlue50:   "#E8EDF9",

    brass:       "#C99B3A",
    brass600:    "#A67E28",
    brass50:     "#FAF1DC",

    ember:       "#B8202C",
    ember50:     "#FBE7E9",

    cream:       "#FAF7F0",
    paper:       "#FFFFFF",
    chalk:       "#F1ECE1",

    ink:         "#1A1A1A",
    ink60:       "#4A4A4A",
    ink40:       "#7A7A7A",

    night:       "#0B1226",
    nightRaised: "#141D3A",
    goldGlow:    "#E5B84B",
  },
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;

export const spacing = {
  px: 1,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
} as const;

export const shadows = {
  sm: "0 4px 12px rgba(30, 58, 138, 0.08)",
  md: "0 10px 25px rgba(30, 58, 138, 0.12)",
  lg: "0 20px 40px rgba(30, 58, 138, 0.16)",
  brandGlow: "0 0 0 4px rgba(201, 155, 58, 0.25)",
} as const;

export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  ease: [0.16, 1, 0.3, 1] as const,
} as const;

export const typography = {
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
    "5xl": 48,
  },
  lineHeight: {
    body: 1.55,
    heading: 1.2,
  },
  letterSpacing: {
    body: "0",
    heading: "-0.01em",
  },
} as const;

export const breakpoints = {
  sm: 480,
  md: 768,
  lg: 900,
  xl: 1200,
  "2xl": 1400,
} as const;

export const tokens = {
  colors,
  radii,
  spacing,
  shadows,
  motion,
  typography,
  breakpoints,
} as const;

export type Tokens = typeof tokens;
