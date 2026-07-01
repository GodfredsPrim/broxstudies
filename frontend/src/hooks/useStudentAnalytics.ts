import { useEffect, useMemo, useState } from 'react'
import { questionsApi } from '@/api/endpoints'
import { useAuth } from '@/hooks/useAuth'
import { useOfflineHistory } from '@/hooks/useOfflineHistory'
import type { ExamHistoryEntry } from '@/api/types'
import type { LocalExamEntry } from '@/hooks/useOfflineHistory'

export interface SubjectProgress {
  name: string
  progress: number
  attempts: number
  color: 'indigo' | 'emerald' | 'purple' | 'amber'
}

export interface ActivityItem {
  action: string
  subject: string
  time: string
  xp: number
}

export interface TopicScore {
  topic: string
  subject: string
  score: number
}

type UnifiedEntry = {
  exam_type: string
  subject: string
  score_obtained: number
  total_questions: number
  percentage: number
  created_at: string
}

const COLORS: SubjectProgress['color'][] = ['indigo', 'emerald', 'purple', 'amber']

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(1, mins)} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })
}

function mergeHistory(server: ExamHistoryEntry[], local: LocalExamEntry[]): UnifiedEntry[] {
  const mapped = server.map(e => ({
    exam_type: e.exam_type,
    subject: e.subject,
    score_obtained: e.score_obtained,
    total_questions: e.total_questions,
    percentage: e.percentage,
    created_at: e.created_at,
  }))
  for (const l of local) {
    const dup = mapped.find(s =>
      s.subject === l.subject &&
      Math.round(s.percentage) === Math.round(l.percentage) &&
      Math.abs(new Date(s.created_at).getTime() - new Date(l.created_at).getTime()) < 120000,
    )
    if (!dup) mapped.push(l)
  }
  return mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function useStudentAnalytics() {
  const { user } = useAuth()
  const { getLocalHistory } = useOfflineHistory()
  const [entries, setEntries] = useState<UnifiedEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const local = getLocalHistory().map(l => ({
      exam_type: l.exam_type,
      subject: l.subject,
      score_obtained: l.score_obtained,
      total_questions: l.total_questions,
      percentage: l.percentage,
      created_at: l.created_at,
    }))

    if (!user) {
      setEntries(local)
      setLoading(false)
      return
    }

    questionsApi.examHistory()
      .then(server => {
        if (!active) return
        setEntries(mergeHistory(server, getLocalHistory()))
      })
      .catch(() => {
        if (active) setEntries(local)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [user, getLocalHistory])

  const analytics = useMemo(() => {
    const subjectMap = new Map<string, { total: number; count: number; questions: number }>()
    let totalQuestions = 0

    for (const e of entries) {
      totalQuestions += e.total_questions
      const cur = subjectMap.get(e.subject) || { total: 0, count: 0, questions: 0 }
      cur.total += e.percentage
      cur.count += 1
      cur.questions += e.total_questions
      subjectMap.set(e.subject, cur)
    }

    const subjects: SubjectProgress[] = [...subjectMap.entries()]
      .map(([name, v], i) => ({
        name,
        progress: Math.round(v.total / v.count),
        attempts: v.count,
        color: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.progress - a.progress)

    const examReadiness = subjects.length
      ? Math.round(subjects.reduce((a, s) => a + s.progress, 0) / subjects.length)
      : 0

    const avgScore = subjects.length
      ? Math.round(subjects.reduce((a, s) => a + s.progress, 0) / subjects.length)
      : 0

    const strongTopics: TopicScore[] = subjects.slice(0, 4).map(s => ({
      topic: s.name,
      subject: s.name,
      score: s.progress,
    }))

    const weakTopics: TopicScore[] = [...subjects].sort((a, b) => a.progress - b.progress).slice(0, 4).map(s => ({
      topic: s.name,
      subject: s.name,
      score: s.progress,
    }))

    const weeklyData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const key = d.toISOString().slice(0, 10)
      const dayLabel = d.toLocaleDateString('en-GH', { weekday: 'short' })
      const dayEntries = entries.filter(e => e.created_at.slice(0, 10) === key)
      const minutes = dayEntries.reduce((a, e) => a + e.total_questions * 2, 0)
      return { day: dayLabel, minutes: minutes || 0 }
    })

    const performanceOverTime = (() => {
      const weeks: { week: string; score: number }[] = []
      const buckets = new Map<string, number[]>()
      for (const e of entries) {
        const d = new Date(e.created_at)
        const wk = `W${Math.ceil((d.getDate()) / 7)}`
        const key = `${d.getMonth()}-${wk}`
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key)!.push(e.percentage)
      }
      let i = 1
      for (const scores of buckets.values()) {
        weeks.push({ week: `W${i}`, score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) })
        i++
      }
      if (weeks.length < 2) {
        return [
          { week: 'W1', score: Math.max(0, avgScore - 12) },
          { week: 'W2', score: Math.max(0, avgScore - 8) },
          { week: 'W3', score: Math.max(0, avgScore - 4) },
          { week: 'W4', score: avgScore || 0 },
        ]
      }
      return weeks.slice(-8)
    })()

    const recentActivity: ActivityItem[] = entries.slice(0, 6).map(e => ({
      action: e.exam_type === 'Practice' ? 'Completed practice set' : `Completed ${e.exam_type}`,
      subject: e.subject,
      time: relativeTime(e.created_at),
      xp: Math.round(e.percentage),
    }))

    const recommendations = weakTopics.slice(0, 3).map(t => ({
      title: `Focus on ${t.topic}`,
      desc: `Your average is ${t.score}%. Try a 15-minute practice session to improve.`,
      action: '/practice' as const,
      priority: (t.score < 50 ? 'high' : 'low') as 'high' | 'low',
    }))

    return {
      subjects,
      examReadiness,
      avgScore,
      totalQuestions,
      totalAttempts: entries.length,
      strongTopics,
      weakTopics,
      weeklyData,
      performanceOverTime,
      recentActivity,
      recommendations,
    }
  }, [entries])

  return { loading, entries, ...analytics }
}
