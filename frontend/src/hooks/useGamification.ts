import { useEffect, useRef, useState, useCallback } from 'react'
import { authApi } from '@/api/endpoints'
import { getToken } from '@/api/client'
import type { UserProgress } from '@/api/types'
import { celebrateAchievement } from '@/utils/confetti'

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

function fromServer(data: UserProgress): GamificationState {
  return {
    xp: data.xp,
    level: data.level,
    coins: data.coins,
    streak: data.streak,
    lastStudyDate: data.last_study_date,
    badges: data.badges ?? [],
    dailyGoalMinutes: data.daily_goal_minutes,
    dailyMinutesStudied: data.daily_minutes_studied,
    weeklyGoalDays: data.weekly_goal_days,
    weeklyDaysCompleted: data.weekly_days_completed,
  }
}

function toServer(state: GamificationState): UserProgress {
  return {
    xp: state.xp,
    level: state.level,
    coins: state.coins,
    streak: state.streak,
    last_study_date: state.lastStudyDate,
    badges: state.badges,
    daily_goal_minutes: state.dailyGoalMinutes,
    daily_minutes_studied: state.dailyMinutesStudied,
    weekly_goal_days: state.weeklyGoalDays,
    weekly_days_completed: state.weeklyDaysCompleted,
  }
}

function mergeProgress(local: GamificationState, remote: GamificationState): GamificationState {
  const badges = Array.from(new Set([...local.badges, ...remote.badges]))
  const xp = Math.max(local.xp, remote.xp)
  const level = Math.max(levelFromXp(xp).level, local.level, remote.level)
  return {
    xp,
    level,
    coins: Math.max(local.coins, remote.coins),
    streak: Math.max(local.streak, remote.streak),
    lastStudyDate: remote.lastStudyDate ?? local.lastStudyDate,
    badges,
    dailyGoalMinutes: remote.dailyGoalMinutes || local.dailyGoalMinutes,
    dailyMinutesStudied: Math.max(local.dailyMinutesStudied, remote.dailyMinutesStudied),
    weeklyGoalDays: remote.weeklyGoalDays || local.weeklyGoalDays,
    weeklyDaysCompleted: Math.max(local.weeklyDaysCompleted, remote.weeklyDaysCompleted),
  }
}

export function useGamification() {
  const [state, setState] = useState<GamificationState>(load)
  const hydrated = useRef(false)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSync = useCallback((next: GamificationState) => {
    if (!getToken()) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      authApi.patchProgress(toServer(next)).catch(() => {})
    }, 600)
  }, [])

  const persist = useCallback((next: GamificationState, sync = true) => {
    save(next)
    if (sync) scheduleSync(next)
    return next
  }, [scheduleSync])

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

  useEffect(() => {
    if (!getToken()) {
      hydrated.current = true
      return
    }
    let active = true
    authApi.getProgress()
      .then(data => {
        if (!active) return
        const remote = fromServer(data)
        setState(prev => persist(mergeProgress(prev, remote), false))
        hydrated.current = true
      })
      .catch(() => {
        hydrated.current = true
      })
    return () => { active = false }
  }, [persist])

  const update = (patch: Partial<GamificationState>) => {
    setState(prev => persist({ ...prev, ...patch }))
  }

  const addXp = useCallback((amount: number) => {
    setState(prev => {
      const xp = prev.xp + amount
      const prevLevel = levelFromXp(prev.xp).level
      const { level } = levelFromXp(xp)
      const coins = prev.coins + Math.floor(amount / 5)
      const next = { ...prev, xp, level, coins }
      if (level > prevLevel) void celebrateAchievement('level')
      return persist(next)
    })
  }, [persist])

  const recordStudy = useCallback((minutes = 5) => {
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
      if (streak === 3 || streak === 7) void celebrateAchievement('streak')
      return persist(next)
    })
    addXp(minutes * 2)
  }, [addXp, persist])

  const awardBadge = useCallback((id: string) => {
    setState(prev => {
      if (prev.badges.includes(id)) return prev
      const next = { ...prev, badges: [...prev.badges, id] }
      void celebrateAchievement('badge')
      return persist(next)
    })
  }, [persist])

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
    synced: hydrated.current,
  }
}
