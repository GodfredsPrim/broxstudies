import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Brain, FileText, BarChart3, Zap, Megaphone, Trophy, BookOpen, Clock,
  ArrowUpRight, Flame, Target, Sparkles
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { useGuestChats } from '@/hooks/useGuestChats'
import { TrackSelector } from '@/components/TrackSelector'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'

const DESTINATIONS = [
  { to: '/study', label: 'Study with AI', hint: 'Ask anything. Get grade-level answers.', icon: Brain, tone: 'emerald' as const },
  { to: '/practice', label: 'Practice Questions', hint: 'Generate a custom paper by subject & year.', icon: FileText, tone: 'emerald' as const },
  { to: '/quiz', label: 'Quiz Challenge', hint: 'Live, timed head-to-head with classmates.', icon: Zap, tone: 'emerald' as const },
  { to: '/news', label: 'News & Updates', hint: 'Competitions, rewards, announcements.', icon: Megaphone, tone: 'gold' as const },
  { to: '/rankings', label: 'Rankings', hint: 'See the global leaderboard.', icon: Trophy, tone: 'gold' as const },
  { to: '/library', label: 'Library', hint: 'Syllabi, textbooks, past questions.', icon: BookOpen, tone: 'emerald' as const },
  { to: '/history', label: 'History', hint: 'Review your past exams and practice sets.', icon: Clock, tone: 'emerald' as const },
]

export function HomePage() {
  const { user } = useAuth()
  const { selectedTrack, setSelectedTrack, loading: trackLoading } = useAcademicTrack()
  const { remaining, limit } = useGuestChats()
  const firstName = (user?.full_name || user?.email || '').split(/[\s@]/)[0] || 'student'

  if (trackLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4 py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
      </div>
    )
  }

  const showTrackSelection = !selectedTrack
  if (showTrackSelection) {
    return (
      <div className="relative mx-auto w-full max-w-[1240px] px-4 pb-16 pt-8 sm:px-8 lg:px-12">
        <TrackSelector selectedTrack={selectedTrack} onSelect={setSelectedTrack} />
      </div>
    )
  }

  return (
    <div className="relative mx-auto w-full max-w-[1240px] px-4 pb-16 pt-8 sm:px-8 lg:px-12">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-white/5 bg-[var(--bg-1)] px-6 py-10 sm:px-10 sm:py-14"
      >
        <div className="v2-mesh" style={{ opacity: 0.6 }} />
        <div className="v2-grain" />
        <div className="relative">
          <div className="mb-4 flex items-center gap-2">
            <span className="v2-dot" />
            <Eyebrow>Welcome{user ? ` back, ${firstName}` : ''}</Eyebrow>
          </div>
          <h1 className="v2-display text-[44px] leading-[1.02] tracking-tighter text-ink-0 sm:text-[68px]">
            Master Exams,<br />
            <span className="relative">
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-amber-300 bg-clip-text text-transparent">
                one sharp question at a time.
              </span>
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-300 sm:text-[17px]">
            Ghana's AI-powered exam prep: study with an AI tutor, drill past papers, challenge friends in live quizzes, and see which topics are most likely to show up this year.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/study" className="v2-btn v2-btn-primary h-11 !px-5">
              <Sparkles size={14} /> Start studying
            </Link>
            <Link to="/practice" className="v2-btn v2-btn-ghost h-11 !px-5">
              <FileText size={14} /> Generate a paper
            </Link>
            {!user && (
              <Badge tone="accent" className="h-8 !px-3">
                {remaining} of {limit} free chats left
              </Badge>
            )}
          </div>
        </div>
      </motion.section>

      {/* Stat row */}
      <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard
          eyebrow="Streak"
          value="0"
          caption="days in a row"
          icon={<Flame size={14} />}
          trend="flat"
          trendLabel="Start today"
        />
        <StatCard
          eyebrow="Practice"
          value="—"
          caption="questions answered"
          icon={<Target size={14} />}
        />
        <StatCard
          eyebrow="Average"
          value="—"
          caption="across all subjects"
          icon={<BarChart3 size={14} />}
        />
        <StatCard
          eyebrow="Rank"
          value="—"
          caption="global leaderboard"
          icon={<Trophy size={14} />}
        />
      </section>

      {/* Destinations grid */}
      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <Eyebrow>Start anywhere</Eyebrow>
            <h2 className="mt-2 font-display text-[28px] leading-tight text-ink-0 sm:text-[34px]">
              Your workspaces
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DESTINATIONS.map((d, idx) => (
            <motion.div
              key={d.to}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 + idx * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link to={d.to} className="group block">
                <Card interactive grain padded={false} className="h-full p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={cn(
                        'grid h-10 w-10 place-items-center rounded-xl ring-1',
                        d.tone === 'gold'
                          ? 'bg-amber-400/10 text-amber-300 ring-amber-400/20'
                          : 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/20',
                      )}
                    >
                      <d.icon size={18} />
                    </div>
                    <ArrowUpRight
                      size={16}
                      className="text-ink-400 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink-0"
                    />
                  </div>
                  <div className="mt-5">
                    <div className="text-[15px] font-semibold text-ink-0">{d.label}</div>
                    <div className="mt-1.5 text-[13px] leading-snug text-ink-400">{d.hint}</div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
