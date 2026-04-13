import type { MockExamCreateResponse } from './api'

const PRACTICE_QUEUE_KEY = 'bisame.practice.sync.queue'
const EXAM_PACKS_KEY = 'bisame.mock.exam.packs'
export const OFFLINE_SYNC_EVENT = 'bisame:offline-sync-updated'

export interface OfflinePracticePayload {
  studentId?: string
  subject?: string
  items: Array<{
    question_text: string
    question_type: string
    correct_answer: string
    explanation?: string
    options?: string[]
    student_answer: string
  }>
  createdAt: number
}

export interface SavedExamPack extends MockExamCreateResponse {
  savedAt: number
}

function emitChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFFLINE_SYNC_EVENT))
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return fallback
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(key, JSON.stringify(value))
  emitChange()
}

export function getPendingPracticeSyncCount(): number {
  return readJson<OfflinePracticePayload[]>(PRACTICE_QUEUE_KEY, []).length
}

export function queuePracticeSync(payload: OfflinePracticePayload) {
  const queue = readJson<OfflinePracticePayload[]>(PRACTICE_QUEUE_KEY, [])
  queue.push(payload)
  writeJson(PRACTICE_QUEUE_KEY, queue)
}

export async function flushPracticeSyncQueue(
  send: (payload: OfflinePracticePayload) => Promise<unknown>
): Promise<number> {
  const queue = readJson<OfflinePracticePayload[]>(PRACTICE_QUEUE_KEY, [])
  if (!queue.length) {
    return 0
  }

  const remaining: OfflinePracticePayload[] = []
  let flushed = 0
  for (const item of queue) {
    try {
      await send(item)
      flushed += 1
    } catch {
      remaining.push(item)
    }
  }
  writeJson(PRACTICE_QUEUE_KEY, remaining)
  return flushed
}

export function getSavedExamPacks(): SavedExamPack[] {
  return readJson<SavedExamPack[]>(EXAM_PACKS_KEY, [])
}

export function saveExamPack(pack: MockExamCreateResponse) {
  const packs = getSavedExamPacks().filter((item) => item.session_id !== pack.session_id)
  packs.unshift({ ...pack, savedAt: Date.now() })
  writeJson(EXAM_PACKS_KEY, packs.slice(0, 12))
}

export function removeExamPack(sessionId: string) {
  const packs = getSavedExamPacks().filter((item) => item.session_id !== sessionId)
  writeJson(EXAM_PACKS_KEY, packs)
}