import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Content-shaped shimmer placeholder. Use instead of full-page spinners:
 * same real latency, feels ~3x faster because the user sees the shape of
 * the content that's loading.
 *
 * Rule of thumb: one <Skeleton> per real content element, with roughly
 * the same shape and size. Don't use it for data that fetches in <200ms.
 */
const skeletonVariants = cva(
  "relative overflow-hidden bg-gh-chalk/80 dark:bg-white/5 animate-shimmer bg-[length:200%_100%] bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.6)_50%,transparent_100%)] dark:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.08)_50%,transparent_100%)]",
  {
    variants: {
      shape: {
        text:    "h-3.5 w-full rounded-md",
        title:   "h-6 w-3/5 rounded-md",
        avatar:  "h-10 w-10 rounded-full",
        thumb:   "h-16 w-16 rounded-lg",
        button:  "h-10 w-28 rounded-lg",
        card:    "h-32 w-full rounded-xl",
        block:   "h-full w-full rounded-md",
      },
    },
    defaultVariants: {
      shape: "text",
    },
  }
)

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, shape, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(skeletonVariants({ shape }), className)}
      {...props}
    />
  )
)
Skeleton.displayName = "Skeleton"

/**
 * Convenience: render N stacked text-line skeletons. Useful for list
 * placeholders (subject list, exam history).
 */
export function SkeletonLines({
  count = 3,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          shape="text"
          className={i === count - 1 ? "w-4/5" : undefined}
        />
      ))}
    </div>
  )
}

export { Skeleton, skeletonVariants }
