import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Brain, FileText, TrendingUp, Zap, ArrowRight,
  Flame, Target, Trophy, Sparkles, BarChart3, Bell, Calendar, Clock,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { useGamification } from '@/hooks/useGamification'
import { useGuestChats } from '@/hooks/useGuestChats'
import { competitionsApi } from '@/api/endpoints'
import { TrackSelector } from '@/components/TrackSelector'
import { PageTransition, FadeIn } from '@/components/shared/PageTransition'
import { ProgressRing } from '@/components/shared/ProgressRing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/shadcn-card'
import { Button } from '@/components/ui/shadcn-button'
import { Progress } from '@/components/ui/progress'
import { StreakCard, BadgeGrid, LeaderboardPreview } from '@/components/gamification/GamificationWidgets'
import { WeeklyStudyChart } from '@/components/charts/WeeklyStudyChart'
import { cn } from '@/lib/cn'

const QUICK_ACTIONS = [
  { to: '/', label: 'AI Tutor', icon: Brain, color: 'from-indigo-500 to-purple-500' },
  { to: '/practice', label: 'Practice', icon: FileText, color: 'from-purple-500 to-pink-500' },
  { to: '/wassce', label: 'Likely WASSCE', icon: TrendingUp, color: 'from-blue-500 to-indigo-500' },
  { to: '/quiz', label: 'Live Quiz', icon: Zap, color: 'from-amber-500 to-orange-500' },
]

const SUBJECTS = [
  { name: 'Core Mathematics', progress: 72, color: 'indigo' as const },
  { name: 'Integrated Science', progress: 58, color: 'emerald' as const },
  { name: 'English Language', progress: 85, color: 'purple' as const },
  { name: 'Social Studies', progress: 45, color: 'amber' as const },
]

const RECENT_ACTIVITY = [
  { action: 'Completed practice set', subject: 'Core Mathematics', time: '2 hours ago', xp: 40 },
  { action: 'AI tutoring session', subject: 'Chemistry', time: '5 hours ago', xp: 20 },
  { action: 'Won live quiz', subject: 'General Knowledge', time: 'Yesterday', xp: 60 },
  { action: 'Read chapter 4', subject: 'Things Fall Apart', time: '2 days ago', xp: 15 },
]

export function DashboardPage() {
  const { user } = useAuth()
  const { selectedTrack, setSelectedTrack, loading: trackLoading } = useAcademicTrack()
  const { streak, computedLevel, levelProgress, levelNext, dailyMinutesStudied, dailyGoalMinutes, badges } = useGamification()
  const { remaining, limit } = useGuestChats()
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number; rank: number }[]>([])

  const firstName = (user?.full_name || user?.email || 'student').split(/[\s@]/)[0]

  useEffect(() => {
    competitionsApi.leaderboard().then(lb => {
      setLeaderboard(lb.slice(0, 5).map(e => ({
        name: e.player_name || 'Student',
        score: e.total_points || 0,
        rank: e.rank,
      })))
    }).catch(() => {
      setLeaderboard([
        { name: 'Ama K.', score: 2450, rank: 1 },
        { name: 'Kwame O.', score: 2180, rank: 2 },
        { name: 'Efua M.', score: 1920, rank: 3 },
        { name: 'Kofi A.', score: 1750, rank: 4 },
        { name: 'Abena S.', score: 1680, rank: 5 },
      ])
    })
  }, [])

  if (trackLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-400" />
      </div>
    )
  }

  if (!selectedTrack) {
    return (
      <PageTransition className="mx-auto max-w-4xl px-4 py-8">
        <TrackSelector selectedTrack={selectedTrack} onSelect={setSelectedTrack} />
      </PageTransition>
    )
  }

  const dailyPct = Math.min(100, (dailyMinutesStudied / dailyGoalMinutes) * 100)
  const examReadiness = Math.round(SUBJECTS.reduce((a, s) => a + s.progress, 0) / SUBJECTS.length)

  return (
    <PageTransition className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      {/* Welcome header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {new Date().toLocaleDateString('en-GH', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
              Welcome back, <span className="gradient-text">{firstName}</span>
            </h1>
            {!user && (
              <p className="mt-1 text-sm text-muted-foreground">{remaining} of {limit} free AI chats remaining</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Notifications">
              <Bell size={18} />
            </Button>
            <Link to="/">
              <Button className="gap-2">
                <Sparkles size={16} /> Start studying
              </Button>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* Top stats row */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FadeIn delay={0.05}>
          <Card className="overflow-hidden">
            <CardContent className="flex items-center gap-4 p-5">
              <ProgressRing value={dailyPct} size={72} strokeWidth={6} label={`${Math.round(dailyPct)}%`} sublabel="daily" color="emerald" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily Goal</p>
                <p className="text-lg font-bold">{dailyMinutesStudied}/{dailyGoalMinutes} min</p>
                <Progress value={dailyPct} className="mt-2 w-24" />
              </div>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.1}>
          <StreakCard />
        </FadeIn>
        <FadeIn delay={0.15}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Level & XP</p>
                  <p className="mt-1 text-3xl font-bold">Lv.{computedLevel}</p>
                  <p className="text-xs text-muted-foreground">{levelProgress}/{levelNext} XP</p>
                </div>
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                  <Target size={28} className="text-indigo-400" />
                </div>
              </div>
              <Progress value={(levelProgress / levelNext) * 100} className="mt-3" />
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.2}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exam Readiness</p>
                  <p className="mt-1 text-3xl font-bold">{examReadiness}%</p>
                  <p className="text-xs text-muted-foreground">Across all subjects</p>
                </div>
                <ProgressRing value={examReadiness} size={72} strokeWidth={6} color="indigo" />
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Quick actions */}
      <FadeIn delay={0.1} className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map(a => (
            <Link key={a.to} to={a.to}>
              <motion.div whileHover={{ y: -2 }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-indigo-500/30">
                <div className={cn('grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white', a.color)}>
                  <a.icon size={18} />
                </div>
                <span className="text-sm font-semibold">{a.label}</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </FadeIn>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Continue learning */}
          <FadeIn delay={0.15}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Continue Learning</CardTitle>
                <Link to="/history" className="text-xs font-medium text-indigo-400 hover:underline flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {SUBJECTS.slice(0, 2).map(s => (
                  <div key={s.name} className="flex items-center gap-4 rounded-xl bg-[var(--bg-2)] p-4">
                    <ProgressRing value={s.progress} size={48} strokeWidth={4} color={s.color} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{s.name}</p>
                      <Progress value={s.progress} className="mt-2" />
                    </div>
                    <Link to="/practice">
                      <Button variant="ghost" size="sm">Resume</Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          </FadeIn>

          {/* Weekly chart */}
          <FadeIn delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-indigo-400" />
                  Weekly Study Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WeeklyStudyChart />
              </CardContent>
            </Card>
          </FadeIn>

          {/* Subjects grid */}
          <FadeIn delay={0.25}>
            <Card>
              <CardHeader>
                <CardTitle>Subject Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SUBJECTS.map(s => (
                    <div key={s.name} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="text-sm font-bold text-indigo-400">{s.progress}%</span>
                      </div>
                      <Progress value={s.progress} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Motivational card */}
          <FadeIn delay={0.3}>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-indigo-600/20 border border-indigo-500/20 p-6">
              <div className="v2-mesh opacity-50" />
              <div className="relative flex items-center gap-4">
                <Flame size={32} className="text-amber-400 shrink-0" />
                <div>
                  <p className="font-bold">Keep your {streak}-day streak alive!</p>
                  <p className="mt-1 text-sm text-muted-foreground">Study for just {Math.max(0, dailyGoalMinutes - dailyMinutesStudied)} more minutes today to hit your daily goal and earn bonus XP.</p>
                </div>
                <Link to="/" className="ml-auto shrink-0">
                  <Button size="sm">Study now</Button>
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          {/* AI Tutor shortcut */}
          <FadeIn delay={0.15}>
            <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
                    <Brain size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold">AI Tutor</p>
                    <p className="text-xs text-muted-foreground">Ask anything</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Get instant explanations with math rendering, file uploads, and curriculum-aligned answers.</p>
                <Link to="/">
                  <Button className="w-full gap-2"><Sparkles size={14} /> Open AI Tutor</Button>
                </Link>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Upcoming exams */}
          <FadeIn delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar size={16} className="text-purple-400" />
                  Upcoming
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { title: 'WASSCE Core Maths Mock', date: 'Mar 15', type: 'Exam' },
                  { title: 'Weekly Quiz Challenge', date: 'Mar 8', type: 'Quiz' },
                  { title: 'Science Practical Review', date: 'Mar 12', type: 'Study' },
                ].map(e => (
                  <div key={e.title} className="flex items-center justify-between rounded-lg bg-[var(--bg-2)] px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.date}</p>
                    </div>
                    <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">{e.type}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </FadeIn>

          {/* Leaderboard */}
          <FadeIn delay={0.25}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy size={16} className="text-amber-400" />
                  Leaderboard
                </CardTitle>
                <Link to="/rankings" className="text-xs text-indigo-400 hover:underline">View all</Link>
              </CardHeader>
              <CardContent>
                <LeaderboardPreview entries={leaderboard} />
              </CardContent>
            </Card>
          </FadeIn>

          {/* Recent activity */}
          <FadeIn delay={0.3}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock size={16} />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {RECENT_ACTIVITY.map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.action}</p>
                      <p className="text-xs text-muted-foreground">{a.subject} · {a.time}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">+{a.xp} XP</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </FadeIn>

          {/* Badges */}
          <FadeIn delay={0.35}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Achievement Badges</CardTitle>
              </CardHeader>
              <CardContent>
                <BadgeGrid earned={badges} />
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </PageTransition>
  )
}
