import type { ReactNode } from 'react'
import { Card } from './card'
import { Spinner } from './Spinner'
import { cn } from '@/lib/cn'

interface LoadingBlockProps {
  label?: string
  className?: string
  compact?: boolean
  icon?: ReactNode
}

export function LoadingBlock({ label = 'Loading…', className, compact, icon }: LoadingBlockProps) {
  if (compact) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Spinner size="md" label={label} />
      </div>
    )
  }

  return (
    <Card className={cn('flex flex-col items-center gap-4 py-16 text-center', className)}>
      {icon ? (
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
          {icon}
        </div>
      ) : null}
      <Spinner size="lg" />
      <p className="text-sm text-ink-400">{label}</p>
    </Card>
  )
}
