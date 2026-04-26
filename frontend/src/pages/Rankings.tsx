import { useState, useEffect } from 'react'
import { Trophy, Medal, Award } from 'lucide-react'
import { competitionsApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import type { LeaderboardEntry } from '@/api/types'

export function RankingsPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setError('')
      try {
        const data = await competitionsApi.leaderboard()
        if (active) setLeaderboard(data)
      } catch (err) {
        if (active) setError(extractError(err, 'Failed to load rankings.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
        <div className="mt-10 text-center">
          <div className="pulse-loader mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading rankings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
      <div className="mt-6">
        <h1 className="text-3xl font-black text-foreground">Rankings</h1>
        <p className="mt-2 text-muted-foreground">See how you stack up against other BroxStudies students.</p>
      </div>

      {error && (
        <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-10">
        {leaderboard.length === 0 ? (
          <div className="text-center py-20">
            <Trophy size={48} className="mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No rankings available yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {leaderboard.map((entry) => (
              <div key={entry.rank} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 min-w-[60px]">
                  {entry.rank === 1 && <Trophy size={20} className="text-yellow-500" />}
                  {entry.rank === 2 && <Medal size={20} className="text-gray-400" />}
                  {entry.rank === 3 && <Award size={20} className="text-amber-600" />}
                  <span className="text-lg font-bold text-muted-foreground">#{entry.rank}</span>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{entry.player_name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>{entry.total_points} points</span>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${entry.is_online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {entry.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{entry.total_points}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}