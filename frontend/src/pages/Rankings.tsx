import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Medal, Award, Zap } from 'lucide-react'
import { competitionsApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { PageLayout } from '@/components/ui/PageLayout'
import { LoadingBlock } from '@/components/ui/LoadingBlock'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { LeaderboardEntry } from '@/api/types'

const PODIUM_META = [
  { rank: 1, icon: Trophy, ring: 'ring-amber-400/40', bg: 'bg-gradient-to-b from-amber-400/20 to-transparent', text: 'text-amber-600 dark:text-amber-300', height: 'h-28' },
  { rank: 2, icon: Medal, ring: 'ring-slate-400/30', bg: 'bg-gradient-to-b from-slate-400/15 to-transparent', text: 'text-slate-600 dark:text-slate-300', height: 'h-20' },
  { rank: 3, icon: Award, ring: 'ring-orange-400/30', bg: 'bg-gradient-to-b from-orange-400/15 to-transparent', text: 'text-orange-600 dark:text-orange-300', height: 'h-16' },
] as const

export function RankingsPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    competitionsApi.leaderboard()
      .then(data => { if (active) setLeaderboard(data) })
      .catch(err => { if (active) setError(extractError(err, 'Failed to load rankings.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const topThree = leaderboard.filter(e => e.rank <= 3)
  const rest = leaderboard.filter(e => e.rank > 3)

  return (
    <PageLayout
      eyebrow="Compete"
      title="Rankings"
      subtitle="See how you stack up against other BroxStudies students. Climb the board by joining live quizzes and competitions."
      width="wide"
    >
      {error && <div className="v2-alert v2-alert-error mb-6">{error}</div>}

      {loading ? (
        <LoadingBlock label="Loading leaderboard…" icon={<Trophy size={22} />} />
      ) : leaderboard.length === 0 ? (
        <EmptyState
          icon={<Trophy size={22} />}
          title="No rankings yet"
          body="Be the first on the board. Join a live quiz challenge or enter a competition to earn points."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/quiz">
                <Button variant="primary" leading={<Zap size={14} />}>Join a quiz</Button>
              </Link>
              <Link to="/news">
                <Button variant="ghost">View competitions</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="space-y-8">
          {topThree.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-xl text-ink-0">Top performers</h2>
              <div className="grid grid-cols-3 items-end gap-3 sm:gap-5">
                {[2, 1, 3].map(displayRank => {
                  const entry = topThree.find(e => e.rank === displayRank)
                  const meta = PODIUM_META.find(p => p.rank === displayRank)!
                  const Icon = meta.icon
                  return (
                    <Card
                      key={displayRank}
                      className={cn(
                        'relative flex flex-col items-center px-3 pb-4 pt-5 text-center',
                        meta.bg,
                        displayRank === 1 && 'order-2 sm:scale-[1.03]',
                        displayRank === 2 && 'order-1',
                        displayRank === 3 && 'order-3',
                      )}
                    >
                      <div className={cn('mb-3 grid h-12 w-12 place-items-center rounded-2xl ring-2', meta.ring, meta.text)}>
                        <Icon size={22} />
                      </div>
                      {entry ? (
                        <>
                          <div className="font-display text-lg text-ink-0 line-clamp-1">{entry.player_name}</div>
                          <div className="mt-1 font-mono text-2xl font-bold text-ink-0">{entry.total_points}</div>
                          <div className="text-xs text-ink-400">points</div>
                          <Badge tone={entry.is_online ? 'accent' : undefined} className="mt-2">
                            {entry.is_online ? 'Online' : 'Offline'}
                          </Badge>
                        </>
                      ) : (
                        <div className="text-sm text-ink-400">—</div>
                      )}
                      <div className={cn('absolute bottom-0 left-0 right-0 rounded-b-[inherit] bg-[var(--bg-2)]/50', meta.height)} />
                    </Card>
                  )
                })}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-xl text-ink-0">Everyone else</h2>
              <Card padded={false}>
                <ul className="divide-y divide-[var(--line)]">
                  {rest.map(entry => (
                    <li key={entry.rank} className="flex items-center gap-4 px-5 py-4">
                      <span className="w-10 font-mono text-sm font-bold text-ink-400">#{entry.rank}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink-0">{entry.player_name}</div>
                        <div className="mt-0.5 text-xs text-ink-400">
                          {entry.is_online ? 'Online now' : 'Offline'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-xl text-ink-0">{entry.total_points}</div>
                        <div className="text-[11px] uppercase tracking-wide text-ink-400">pts</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>
      )}
    </PageLayout>
  )
}
