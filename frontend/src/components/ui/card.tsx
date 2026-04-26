import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  grain?: boolean
  padded?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive, grain, padded = true, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'v2-card relative',
        interactive && 'v2-card-interactive cursor-pointer',
        grain && 'v2-grain overflow-hidden',
        padded && 'p-5 sm:p-6',
        className,
      )}
      {...rest}
    />
  )
})
