import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'brox.v2.guestChatsUsed'
export const GUEST_CHAT_LIMIT = 3

function read(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

/**
 * Guest chat meter. Returns remaining free chats and a consume() fn that
 * increments the counter and returns `true` if the chat should be allowed.
 * Synced across tabs via the `storage` event.
 */
export function useGuestChats() {
  const [used, setUsed] = useState<number>(() => read())

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setUsed(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const remaining = Math.max(0, GUEST_CHAT_LIMIT - used)

  const consume = useCallback((): boolean => {
    if (used >= GUEST_CHAT_LIMIT) return false
    const next = used + 1
    setUsed(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
    return true
  }, [used])

  const reset = useCallback(() => {
    setUsed(0)
    try { localStorage.setItem(STORAGE_KEY, '0') } catch {}
  }, [])

  return { used, remaining, limit: GUEST_CHAT_LIMIT, consume, reset }
}
