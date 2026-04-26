import type { ReactNode } from 'react'
import { Eyebrow } from './Eyebrow'
import { cn } from '@/lib/cn'

interface StatCardProps {
  eyebrow: string
  value: ReactNode
  caption?: ReactNode
  icon?: ReactNode
  trend?: 'up' | 'down' | 'flat'
  trendLabel?: string
  className?: string
}

const trendCls: Record<NonNullable<StatCardProps['trend']>, string> = {
  up: 'text-emerald-300',
  down: 'text-rose-400',
  flat: 'text-ink-400',
}

export function StatCard({ eyebrow, value, caption, icon, trend, trendLabel, className }: StatCardProps) {
  return (
    <div className={cn('v2-card v2-card-interactive relative overflow-hidden p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>{eyebrow}</Eyebrow>
        {icon && (
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-ink-300">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-4 font-display text-4xl leading-none tracking-tight text-ink-0 sm:text-5xl">
        {value}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        {trendLabel && trend && (
          <span className={cn('font-mono text-[11px] font-semibold', trendCls[trend])}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendLabel}
          </span>
        )}
        {caption && <span className="text-xs text-ink-400">{caption}</span>}
      </div>
    </div>
  )
}
