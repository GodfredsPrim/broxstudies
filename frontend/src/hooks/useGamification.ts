import { useEffect, useState } from 'react'

const STORAGE_KEY = 'brox.gamification'

export interface GamificationState {
  xp: number
  level: number
  coins: number
  streak: number
  lastStudyDate: string | null
  badges: string[]
  dailyGoalMinutes: number
  dailyMinutesStudied: number
  weeklyGoalDays: number
  weeklyDaysCompleted: number
}

const DEFAULT: GamificationState = {
  xp: 0,
  level: 1,
  coins: 0,
  streak: 0,
  lastStudyDate: null,
  badges: [],
  dailyGoalMinutes: 30,
  dailyMinutesStudied: 0,
  weeklyGoalDays: 5,
  weeklyDaysCompleted: 0,
}

export const BADGES = [
  { id: 'first-chat', name: 'First Steps', icon: '🌱', description: 'Complete your first AI chat' },
  { id: 'streak-3', name: 'On Fire', icon: '🔥', description: '3-day study streak' },
  { id: 'streak-7', name: 'Week Warrior', icon: '⚡', description: '7-day study streak' },
  { id: 'practice-10', name: 'Practice Pro', icon: '📝', description: 'Answer 10 practice questions' },
  { id: 'quiz-win', name: 'Quiz Champion', icon: '🏆', description: 'Win a live quiz' },
  { id: 'library-5', name: 'Bookworm', icon: '📚', description: 'Read 5 library books' },
  { id: 'level-5', name: 'Rising Star', icon: '⭐', description: 'Reach level 5' },
  { id: 'wassce-ready', name: 'Exam Ready', icon: '🎯', description: 'Score 80%+ on practice' },
] as const

export function xpForLevel(level: number) {
  return level * 250
}

export function levelFromXp(xp: number) {
  let level = 1
  let remaining = xp
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level++
  }
  return { level, progress: remaining, next: xpForLevel(level) }
}

function load(): GamificationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) }
  } catch { /* noop */ }
  return { ...DEFAULT }
}

function save(state: GamificationState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function useGamification() {
  const [state, setState] = useState<GamificationState>(load)

  useEffect(() => {
    const s = load()
    const t = today()
    if (s.lastStudyDate && s.lastStudyDate !== t) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yStr = yesterday.toISOString().slice(0, 10)
      if (s.lastStudyDate !== yStr) {
        s.streak = 0
      }
      s.dailyMinutesStudied = 0
      save(s)
      setState(s)
    }
  }, [])

  const update = (patch: Partial<GamificationState>) => {
    setState(prev => {
      const next = { ...prev, ...patch }
      save(next)
      return next
    })
  }

  const addXp = (amount: number) => {
    setState(prev => {
      const xp = prev.xp + amount
      const { level } = levelFromXp(xp)
      const coins = prev.coins + Math.floor(amount / 5)
      const next = { ...prev, xp, level, coins }
      save(next)
      return next
    })
  }

  const recordStudy = (minutes = 5) => {
    setState(prev => {
      const t = today()
      let streak = prev.streak
      if (prev.lastStudyDate !== t) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        streak = prev.lastStudyDate === yesterday.toISOString().slice(0, 10) ? prev.streak + 1 : 1
      }
      const dailyMinutesStudied = (prev.lastStudyDate === t ? prev.dailyMinutesStudied : 0) + minutes
      const next = { ...prev, streak, lastStudyDate: t, dailyMinutesStudied }
      save(next)
      return next
    })
    addXp(minutes * 2)
  }

  const awardBadge = (id: string) => {
    setState(prev => {
      if (prev.badges.includes(id)) return prev
      const next = { ...prev, badges: [...prev.badges, id] }
      save(next)
      return next
    })
  }

  const { level, progress, next } = levelFromXp(state.xp)

  return {
    ...state,
    computedLevel: level,
    levelProgress: progress,
    levelNext: next,
    addXp,
    recordStudy,
    awardBadge,
    update,
  }
}
