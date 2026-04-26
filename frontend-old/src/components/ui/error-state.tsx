import * as React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Error state — "couldn't load, tap to retry." Use instead of silent
 * failure or a spinner-that-stops. Every error gets a retry action.
 */
const errorStateVariants = cva(
  "flex flex-col items-center justify-center text-center mx-auto",
  {
    variants: {
      size: {
        sm: "gap-3 py-6 max-w-sm",
        md: "gap-4 py-12 max-w-md",
        lg: "gap-5 py-16 max-w-lg",
      },
    },
    defaultVariants: { size: "md" },
  }
)

export interface ErrorStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof errorStateVariants> {
  title?: React.ReactNode
  description?: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
  supportHref?: string
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      className,
      size,
      title = "Something didn't load",
      description = "Check your connection and try again.",
      onRetry,
      retryLabel = "Try again",
      supportHref,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      role="alert"
      aria-live="polite"
      className={cn(errorStateVariants({ size }), className)}
      {...props}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gh-ember-50 text-gh-ember dark:bg-gh-ember/20">
        <AlertTriangle className="h-7 w-7" strokeWidth={2.25} />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-bold tracking-tight text-gh-ink dark:text-gh-cream">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-gh-ink-60 dark:text-gh-chalk">
          {description}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="default"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {retryLabel}
          </Button>
        )}
        {supportHref && (
          <a
            href={supportHref}
            className="text-sm font-semibold text-gh-ink-blue underline-offset-4 hover:underline dark:text-gh-gold-glow"
          >
            Get help
          </a>
        )}
      </div>
    </div>
  )
)
ErrorState.displayName = "ErrorState"

export { ErrorState, errorStateVariants }
