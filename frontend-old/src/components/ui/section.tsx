import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Page / section wrapper with consistent padding and max-width.
 * Use instead of re-declaring `max-w-7xl mx-auto px-...` per screen.
 */
const sectionVariants = cva("mx-auto w-full", {
  variants: {
    width: {
      sm:   "max-w-2xl",
      md:   "max-w-4xl",
      lg:   "max-w-6xl",
      xl:   "max-w-7xl",
      full: "max-w-none",
    },
    padding: {
      none:  "",
      sm:    "px-4 py-6 sm:px-6 sm:py-8",
      md:    "px-4 py-8 sm:px-6 sm:py-12 lg:px-8",
      lg:    "px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20",
    },
  },
  defaultVariants: {
    width: "xl",
    padding: "md",
  },
})

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {
  as?: "section" | "div" | "main" | "article"
}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, width, padding, as = "section", ...props }, ref) => {
    const Tag = as as React.ElementType
    return (
      <Tag
        ref={ref as React.Ref<HTMLElement>}
        className={cn(sectionVariants({ width, padding }), className)}
        {...props}
      />
    )
  }
)
Section.displayName = "Section"

/**
 * Section header — consistent title/subtitle layout. Pair with <Section>.
 */
export interface SectionHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, eyebrow, title, description, actions, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
      {...props}
    >
      <div className="space-y-2">
        {eyebrow && (
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-gh-ink-blue dark:text-gh-gold-glow">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-gh-ink sm:text-3xl lg:text-4xl dark:text-gh-cream">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-gh-ink-60 sm:text-base dark:text-gh-chalk">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
)
SectionHeader.displayName = "SectionHeader"

export { Section, SectionHeader, sectionVariants }
