import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Empty state — "nothing here yet." Every screen that can legitimately
 * be empty (exam history, no subjects matched, no leaderboard entries)
 * should render this instead of a silent blank.
 *
 * Rule: every EmptyState has a next action. No dead ends.
 */
const emptyStateVariants = cva(
  "flex flex-col items-center justify-center text-center mx-auto",
  {
    variants: {
      size: {
        sm: "gap-3 py-8 max-w-sm",
        md: "gap-4 py-14 max-w-md",
        lg: "gap-5 py-20 max-w-lg",
      },
    },
    defaultVariants: { size: "md" },
  }
)

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof emptyStateVariants> {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, size, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      className={cn(emptyStateVariants({ size }), className)}
      {...props}
    >
      {icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gh-ink-blue-50 text-gh-ink-blue dark:bg-white/5 dark:text-gh-gold-glow">
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <h3 className="text-lg font-bold tracking-tight text-gh-ink dark:text-gh-cream">
          {title}
        </h3>
        {description && (
          <p className="text-sm leading-relaxed text-gh-ink-60 dark:text-gh-chalk">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
)
EmptyState.displayName = "EmptyState"

export { EmptyState, emptyStateVariants }
