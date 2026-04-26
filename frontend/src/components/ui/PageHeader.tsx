import type { ReactNode } from 'react'
import { Eyebrow } from './Eyebrow'
import { cn } from '@/lib/cn'

interface PageHeaderProps {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
  tight?: boolean
}

export function PageHeader({ eyebrow, title, subtitle, actions, className, tight }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-6 border-b border-white/5 pb-8 sm:flex-row sm:items-end sm:justify-between',
        tight ? 'pt-6' : 'pt-10 sm:pt-14',
        className,
      )}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow && (
          <div className="mb-3 flex items-center gap-2">
            <span className="v2-dot" />
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
        )}
        <h1 className="v2-display text-[40px] leading-[1.04] tracking-tighter text-ink-0 sm:text-[52px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-300">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
