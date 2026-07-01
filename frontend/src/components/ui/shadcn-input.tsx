import * as React from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leading, trailing, ...props }, ref) => {
    if (leading || trailing) {
      return (
        <div className="relative flex items-center">
          {leading && <span className="absolute left-3 text-muted-foreground">{leading}</span>}
          <input
            type={type}
            className={cn(
              'flex h-10 w-full rounded-xl border border-input bg-[var(--bg-2)] px-3 py-2 text-sm text-foreground transition-colors',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              leading && 'pl-10',
              trailing && 'pr-10',
              className,
            )}
            ref={ref}
            {...props}
          />
          {trailing && <span className="absolute right-3 text-muted-foreground">{trailing}</span>}
        </div>
      )
    }
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-xl border border-input bg-[var(--bg-2)] px-3 py-2 text-sm text-foreground transition-colors',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
