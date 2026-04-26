import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, Star, TrendingUp, Users } from 'lucide-react';
import { publicAPI, type LeaderboardEntry } from '../services/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { DwennimmenIcon } from '@/components/ui/adinkra';

export const GlobalLeaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await publicAPI.getLeaderboard();
        setLeaderboard(data);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="generator-shell">
      <SectionHeader
        eyebrow="Global Rankings"
        title="Hall of Fame"
        description="The top performing students in Ghana based on all-time practice scores."
        actions={
          !loading && leaderboard.length > 0 ? (
            <Badge variant="blue" size="lg" className="gap-1.5">
              <Users size={14} />
              {leaderboard.length} Ranked
            </Badge>
          ) : null
        }
      />

      <div className="mx-auto grid max-w-3xl gap-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="flex items-center justify-between gap-4 border-gh-chalk bg-gh-paper p-4 shadow-brand-sm dark:border-white/10 dark:bg-gh-night-raised sm:p-5"
            >
              <div className="flex items-center gap-4">
                <Skeleton shape="avatar" className="h-11 w-11 sm:h-12 sm:w-12" />
                <div className="space-y-2">
                  <Skeleton shape="text" className="h-4 w-32" />
                  <Skeleton shape="text" className="h-3 w-20" />
                </div>
              </div>
              <Skeleton shape="text" className="h-6 w-16" />
            </Card>
          ))
        ) : leaderboard.length === 0 ? (
          <EmptyState
            icon={<Trophy size={32} strokeWidth={1.75} />}
            title="No rankings yet"
            description="Start practicing WASSCE papers to earn points and appear on the board."
          />
        ) : (
          leaderboard.map((entry) => {
            const isTop3 = entry.rank <= 3;
            const rankStyles: Record<number, string> = {
              1: 'bg-gh-brass text-white shadow-brand-md',
              2: 'bg-gh-ink-blue-600 text-white',
              3: 'bg-gh-brass-600 text-white',
            };

            return (
              <Card
                key={entry.rank}
                className={`group relative flex items-center justify-between gap-3 overflow-hidden border p-4 transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md sm:gap-4 sm:p-5 ${
                  entry.rank === 1
                    ? 'border-gh-brass/40 bg-gh-brass-50 dark:border-gh-brass/30 dark:bg-gh-brass/10'
                    : 'border-gh-chalk bg-gh-paper dark:border-white/10 dark:bg-gh-night-raised'
                }`}
              >
                {isTop3 && (
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute -right-4 -top-4 h-24 w-24 ${
                      entry.rank === 1
                        ? 'text-gh-brass dark:text-gh-gold-glow'
                        : 'text-gh-ink-blue dark:text-gh-gold-glow'
                    }`}
                    style={{ opacity: entry.rank === 1 ? 0.14 : 0.08 }}
                  >
                    <DwennimmenIcon size="100%" />
                  </div>
                )}
                <div className="flex min-w-0 items-center gap-3 sm:gap-5">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-black tabular-nums transition-transform duration-300 ease-brand group-hover:rotate-6 sm:h-12 sm:w-12 sm:text-xl ${
                      isTop3
                        ? rankStyles[entry.rank]
                        : 'bg-gh-ink text-gh-cream dark:bg-white/10 dark:text-gh-cream'
                    }`}
                  >
                    {entry.rank === 1 ? <Crown size={20} /> : entry.rank}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base font-extrabold tracking-tight text-gh-ink dark:text-gh-cream sm:text-lg">
                        {entry.player_name}
                      </span>
                      {entry.is_online && (
                        <span
                          className="relative flex h-2 w-2 shrink-0"
                          aria-label="Online"
                          title="Online"
                        >
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gh-ink-blue opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-gh-ink-blue" />
                        </span>
                      )}
                    </div>
                    {entry.rank === 1 && (
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gh-brass-600 dark:text-gh-gold-glow">
                        <Star size={10} fill="currentColor" /> Grand Champion
                      </span>
                    )}
                    {isTop3 && entry.rank > 1 && (
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                        <Medal size={10} /> Top Tier
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1.5 text-lg font-black tabular-nums text-gh-ink dark:text-gh-cream sm:gap-2 sm:text-2xl">
                    <TrendingUp
                      size={16}
                      className="text-gh-ink-blue dark:text-gh-gold-glow sm:h-[18px] sm:w-[18px]"
                    />
                    {entry.total_points.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-gh-ink-40 dark:text-gh-chalk">
                    Total Points
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
