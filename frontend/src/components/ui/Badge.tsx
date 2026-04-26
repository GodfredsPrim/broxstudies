import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'accent' | 'gold' | 'danger'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  children: ReactNode
}

export function Badge({ tone = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn('v2-badge', className)}
      data-tone={tone === 'neutral' ? undefined : tone}
      {...rest}
    >
      {children}
    </span>
  )
}
