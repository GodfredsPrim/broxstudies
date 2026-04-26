import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Eyebrow({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('v2-eyebrow', className)} {...rest} />
}
