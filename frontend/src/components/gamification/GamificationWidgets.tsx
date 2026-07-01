import { motion } from 'framer-motion'
import { Flame, Star, Coins, Trophy } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useGamification, BADGES } from '@/hooks/useGamification'
import { Progress } from '@/components/ui/progress'

export function GamificationBar({ className }: { className?: string }) {
  const { streak, coins, computedLevel, levelProgress, levelNext } = useGamification()

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex items-center gap-1.5 rounded-full bg-[var(--gold-tint)] px-2.5 py-1 text-xs font-semibold text-amber-400">
        <Flame size={13} />
        {streak}
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-[var(--primary-tint)] px-2.5 py-1 text-xs font-semibold text-indigo-400">
        <Star size={13} />
        Lv.{computedLevel}
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-[var(--gold-tint)] px-2.5 py-1 text-xs font-semibold text-amber-400">
        <Coins size={13} />
        {coins}
      </div>
      <div className="hidden sm:block w-24">
        <Progress value={(levelProgress / levelNext) * 100} />
      </div>
    </div>
  )
}

export function BadgeGrid({ earned }: { earned: string[] }) {
  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
      {BADGES.map(badge => {
        const has = earned.includes(badge.id)
        return (
          <motion.div
            key={badge.id}
            whileHover={{ scale: 1.05 }}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors',
              has
                ? 'border-indigo-500/30 bg-indigo-500/10'
                : 'border-border bg-[var(--bg-2)] opacity-40 grayscale',
            )}
            title={badge.description}
          >
            <span className="text-2xl">{badge.icon}</span>
            <span className="text-[10px] font-medium leading-tight text-muted-foreground">{badge.name}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

export function StreakCard() {
  const { streak, dailyMinutesStudied, dailyGoalMinutes } = useGamification()
  const pct = Math.min(100, (dailyMinutesStudied / dailyGoalMinutes) * 100)

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Study Streak</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {streak} <span className="text-lg font-medium text-muted-foreground">days</span>
          </p>
        </div>
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
          <Flame size={28} className="text-amber-400" />
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span>Daily goal</span>
          <span>{dailyMinutesStudied}/{dailyGoalMinutes} min</span>
        </div>
        <Progress value={pct} />
      </div>
    </div>
  )
}

export function LeaderboardPreview({ entries }: { entries: { name: string; score: number; rank: number }[] }) {
  return (
    <div className="space-y-2">
      {entries.slice(0, 5).map((e, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl bg-[var(--bg-2)] px-3 py-2.5">
          <span className={cn(
            'grid h-7 w-7 place-items-center rounded-lg text-xs font-bold',
            e.rank === 1 ? 'bg-amber-500/20 text-amber-400' :
            e.rank === 2 ? 'bg-slate-400/20 text-slate-300' :
            e.rank === 3 ? 'bg-orange-700/20 text-orange-400' :
            'bg-[var(--bg-3)] text-muted-foreground',
          )}>
            {e.rank <= 3 ? <Trophy size={14} /> : e.rank}
          </span>
          <span className="flex-1 truncate text-sm font-medium">{e.name}</span>
          <span className="text-sm font-bold text-indigo-400">{e.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
