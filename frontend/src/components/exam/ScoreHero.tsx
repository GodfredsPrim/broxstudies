import type { ReactNode } from 'react'
import { GraduationCap } from 'lucide-react'
import { gradeInfo } from '@/lib/gradeInfo'
import { cn } from '@/lib/cn'

interface ScoreHeroProps {
  percentage: number
  score: number
  total: number
  subtitle?: string
  icon?: ReactNode
  className?: string
}

export function ScoreHero({
  percentage,
  score,
  total,
  subtitle,
  icon,
  className,
}: ScoreHeroProps) {
  const pct = Math.round(percentage)
  const { label, color, bg } = gradeInfo(pct)

  return (
    <div className={cn('rounded-2xl border p-8 text-center', bg, className)}>
      {icon ?? <GraduationCap className={cn('mx-auto mb-3 h-10 w-10', color)} />}
      <div className={cn('font-display text-5xl leading-none', color)}>{pct}%</div>
      <div className="mt-1 text-base font-semibold text-ink-300">{label}</div>
      <div className="mt-2 text-sm text-ink-400">
        {Math.round(score)} of {total} correct
      </div>
      {subtitle && <p className="mt-2 text-xs text-ink-400">{subtitle}</p>}
    </div>
  )
}
