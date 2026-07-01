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
        'flex flex-col gap-6 border-b border-[var(--line)] pb-8 sm:flex-row sm:items-end sm:justify-between',
        tight ? 'pt-6' : 'pt-8 sm:pt-10',
        className,
      )}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow && (
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)]" />
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
        )}
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
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
