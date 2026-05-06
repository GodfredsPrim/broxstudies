import { useCallback } from 'react'

const STORAGE_KEY = 'brox.offline_exam_history'
const MAX_ENTRIES = 100

export interface LocalExamEntry {
  id: string           // local UUID
  exam_type: string
  subject: string
  score_obtained: number
  total_questions: number
  percentage: number
  created_at: string
  synced: boolean
}

function readLocal(): LocalExamEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LocalExamEntry[]) : []
  } catch {
    return []
  }
}

function writeLocal(entries: LocalExamEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    // storage full — ignore
  }
}

export function useOfflineHistory() {
  const saveLocal = useCallback((entry: Omit<LocalExamEntry, 'id' | 'synced'>) => {
    const existing = readLocal()
    const newEntry: LocalExamEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      synced: false,
    }
    writeLocal([newEntry, ...existing])
    return newEntry
  }, [])

  const getLocalHistory = useCallback((): LocalExamEntry[] => {
    return readLocal()
  }, [])

  const markSynced = useCallback((id: string) => {
    const entries = readLocal().map(e => e.id === id ? { ...e, synced: true } : e)
    writeLocal(entries)
  }, [])

  const clearSynced = useCallback(() => {
    writeLocal(readLocal().filter(e => !e.synced))
  }, [])

  return { saveLocal, getLocalHistory, markSynced, clearSynced }
}
