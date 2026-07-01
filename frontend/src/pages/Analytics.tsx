import { Link } from 'react-router-dom'
import {
  BarChart3, TrendingUp, TrendingDown, Target, Brain, ArrowRight,
  Calendar, Award,
} from 'lucide-react'
import { PageTransition, FadeIn } from '@/components/shared/PageTransition'
import { ProgressRing } from '@/components/shared/ProgressRing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/shadcn-card'
import { Button } from '@/components/ui/shadcn-button'
import { Progress } from '@/components/ui/progress'
import { WeeklyStudyChart } from '@/components/charts/WeeklyStudyChart'
import { PerformanceChart, StudyHeatmap } from '@/components/charts/AnalyticsCharts'
import { useGamification } from '@/hooks/useGamification'
import { cn } from '@/lib/cn'

const STRONG_TOPICS = [
  { topic: 'Algebra & Equations', subject: 'Core Mathematics', score: 92 },
  { topic: 'Organic Chemistry', subject: 'Chemistry', score: 88 },
  { topic: 'Essay Writing', subject: 'English Language', score: 85 },
  { topic: 'Cell Biology', subject: 'Biology', score: 82 },
]

const WEAK_TOPICS = [
  { topic: 'Trigonometry', subject: 'Core Mathematics', score: 42 },
  { topic: 'Electromagnetism', subject: 'Physics', score: 38 },
  { topic: 'Map Reading', subject: 'Geography', score: 45 },
  { topic: 'Inorganic Chemistry', subject: 'Chemistry', score: 48 },
]

const AI_RECOMMENDATIONS = [
  { title: 'Focus on Trigonometry', desc: 'Your weakest area in Core Maths. 15 min daily practice recommended.', action: '/practice', priority: 'high' },
  { title: 'Review Electromagnetism', desc: 'Physics score dropped 12% this week. Try the AI tutor for explanations.', action: '/', priority: 'high' },
  { title: 'Maintain English momentum', desc: 'You\'re excelling! Try harder essay prompts to push to 90%+.', action: '/practice', priority: 'low' },
]

export function AnalyticsPage() {
  const { streak, computedLevel } = useGamification()
  const examReadiness = 68

  return (
    <PageTransition className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Performance Analytics</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Your learning insights</h1>
          </div>
          <Link to="/practice">
            <Button variant="outline" className="gap-2">
              <Target size={16} /> Practice weak topics
            </Button>
          </Link>
        </div>
      </FadeIn>

      {/* Top metrics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Exam Readiness', value: `${examReadiness}%`, icon: Award, color: 'text-indigo-400' },
          { label: 'Study Streak', value: `${streak} days`, icon: Calendar, color: 'text-amber-400' },
          { label: 'Level', value: `Lv.${computedLevel}`, icon: TrendingUp, color: 'text-purple-400' },
          { label: 'Avg. Score', value: '74%', icon: BarChart3, color: 'text-emerald-400' },
        ].map((m, i) => (
          <FadeIn key={m.label} delay={i * 0.05}>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={cn('grid h-12 w-12 place-items-center rounded-2xl bg-[var(--bg-2)]', m.color)}>
                  <m.icon size={22} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-2xl font-bold">{m.value}</p>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <FadeIn delay={0.1}>
            <Card>
              <CardHeader>
                <CardTitle>Performance Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <PerformanceChart />
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.15}>
            <Card>
              <CardHeader>
                <CardTitle>Study Heatmap</CardTitle>
              </CardHeader>
              <CardContent>
                <StudyHeatmap />
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle>Weekly Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <WeeklyStudyChart />
              </CardContent>
            </Card>
          </FadeIn>
        </div>

        <div className="space-y-6">
          <FadeIn delay={0.1}>
            <Card className="text-center">
              <CardContent className="p-6">
                <ProgressRing value={examReadiness} size={140} strokeWidth={10} label={`${examReadiness}%`} sublabel="Exam Ready" color="indigo" />
                <p className="mt-4 text-sm text-muted-foreground">Based on practice scores, topic coverage, and study consistency.</p>
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.15}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-emerald-400">
                  <TrendingUp size={16} /> Strong Topics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {STRONG_TOPICS.map(t => (
                  <div key={t.topic}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{t.topic}</span>
                      <span className="font-bold text-emerald-400">{t.score}%</span>
                    </div>
                    <Progress value={t.score} className="[&>div]:bg-emerald-500" />
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.subject}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-rose-400">
                  <TrendingDown size={16} /> Weak Topics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {WEAK_TOPICS.map(t => (
                  <div key={t.topic}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{t.topic}</span>
                      <span className="font-bold text-rose-400">{t.score}%</span>
                    </div>
                    <Progress value={t.score} className="[&>div]:bg-rose-500" />
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.subject}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.25}>
            <Card className="border-indigo-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain size={16} className="text-indigo-400" /> AI Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {AI_RECOMMENDATIONS.map(r => (
                  <div key={r.title} className="rounded-xl bg-[var(--bg-2)] p-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        r.priority === 'high' ? 'bg-rose-400' : 'bg-emerald-400',
                      )} />
                      <p className="text-sm font-semibold">{r.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
                    <Link to={r.action} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:underline">
                      Take action <ArrowRight size={10} />
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </PageTransition>
  )
}
