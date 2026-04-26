import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Adinkra symbol set — BroxStudies identity layer.
 *
 * Stylized inline SVGs inheriting `currentColor`. Use sparingly:
 * - One symbol per surface
 * - 10–20% opacity when decorative (watermark)
 * - Full opacity only as a brand anchor
 *
 * Meanings (abridged):
 * - Sankofa:    "go back and fetch it" — learn from the past
 * - Nyansapo:   the wisdom knot — learning, ingenuity, problem solving
 * - Dwennimmen: ram's horns — strength, humility, discipline
 */

type SvgProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string
  title?: string
}

function base({
  size = 24,
  className,
  title,
  children,
  ...props
}: SvgProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={4.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

/** Sankofa — stylized heart with inward-curling hooks.
 *  "Return and get it" — perfect for history / past work surfaces. */
export function SankofaIcon(props: SvgProps) {
  return base({
    ...props,
    children: (
      <>
        {/* Outer heart silhouette */}
        <path d="M50 85 C 18 65, 10 38, 28 24 C 42 14, 50 28, 50 38 C 50 28, 58 14, 72 24 C 90 38, 82 65, 50 85 Z" />
        {/* Inward spiral hook — left */}
        <path d="M 32 34 C 26 34, 26 44, 34 44 C 40 44, 40 36, 36 36" />
        {/* Inward spiral hook — right */}
        <path d="M 68 34 C 74 34, 74 44, 66 44 C 60 44, 60 36, 64 36" />
      </>
    ),
  })
}

/** Nyansapo — wisdom knot. Four interlocking loops arranged as a cross.
 *  Use for StudyCoach / tutor surfaces. */
export function NyansapoIcon(props: SvgProps) {
  return base({
    ...props,
    children: (
      <>
        {/* Four corner loops — arranged in a knotted cross */}
        <path d="M 30 30 C 20 20, 20 10, 30 10 C 40 10, 40 20, 30 30" />
        <path d="M 70 30 C 80 20, 80 10, 70 10 C 60 10, 60 20, 70 30" />
        <path d="M 30 70 C 20 80, 20 90, 30 90 C 40 90, 40 80, 30 70" />
        <path d="M 70 70 C 80 80, 80 90, 70 90 C 60 90, 60 80, 70 70" />
        {/* Crossed diagonals that bind the knot */}
        <path d="M 30 30 L 70 70" />
        <path d="M 70 30 L 30 70" />
        {/* Center square bind */}
        <rect x="42" y="42" width="16" height="16" rx="2" />
      </>
    ),
  })
}

/** Dwennimmen — paired ram's horns. Two symmetric spirals.
 *  Use for leaderboard / competition — "strength with humility". */
export function DwennimmenIcon(props: SvgProps) {
  return base({
    ...props,
    children: (
      <>
        {/* Left horn — spiral curling inward */}
        <path d="M 42 80 C 20 80, 10 60, 18 42 C 24 28, 38 26, 44 36 C 48 42, 42 50, 36 48 C 32 46, 32 40, 36 40" />
        {/* Right horn — mirrored spiral */}
        <path d="M 58 80 C 80 80, 90 60, 82 42 C 76 28, 62 26, 56 36 C 52 42, 58 50, 64 48 C 68 46, 68 40, 64 40" />
        {/* Central ridge connecting the pair */}
        <path d="M 42 80 C 45 72, 55 72, 58 80" />
      </>
    ),
  })
}

/** Convenience — renders the symbol filling its container at low opacity.
 *  Use as a background watermark behind content. */
export function AdinkraWatermark({
  symbol: Symbol,
  className,
  opacity = 0.08,
}: {
  symbol: React.ComponentType<SvgProps>
  className?: string
  opacity?: number
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        className
      )}
      style={{ opacity }}
    >
      <Symbol size="70%" />
    </div>
  )
}
