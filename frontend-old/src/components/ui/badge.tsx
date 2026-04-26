import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // brass — "earned / premium / achievement"
        brass:
          "border-transparent bg-gh-brass-50 text-gh-brass-600 dark:bg-gh-brass/20 dark:text-gh-gold-glow",
        // ink-blue — "primary / info / active"
        blue:
          "border-transparent bg-gh-ink-blue-50 text-gh-ink-blue dark:bg-gh-ink-blue/25 dark:text-gh-ink-blue-50",
        // ember — "error / warning"
        ember:
          "border-transparent bg-gh-ember-50 text-gh-ember dark:bg-gh-ember/20 dark:text-gh-ember-50",
        // neutral — "meta / tag"
        neutral:
          "border-gh-chalk bg-gh-chalk text-gh-ink-60 dark:border-white/10 dark:bg-white/5 dark:text-gh-chalk",
        // outline — minimal
        outline:
          "border-gh-chalk bg-transparent text-gh-ink-60 dark:border-white/15 dark:text-gh-chalk",
      },
      size: {
        sm: "h-5 px-2 text-[10px]",
        md: "h-6 px-2.5 text-xs",
        lg: "h-7 px-3 text-sm",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
