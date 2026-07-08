import { useEffect, useState } from 'react'
import { Timer, Clock } from 'lucide-react'

/**
 * Self-contained timers. The 1-second tick lives INSIDE these components so
 * it only re-renders this tiny clock — not the page that hosts dozens of
 * KaTeX-rendered question cards. (Keeping the tick in page state was the
 * main scroll/typing lag source on mobile during practice and exams.)
 */

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Count-up timer for practice sessions. Remount (via `key`) to reset. */
export function SessionTimer({ active, className }: { active: boolean; className?: string }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [active])

  return (
    <div className={className ?? 'flex items-center gap-2 text-sm font-mono font-semibold text-indigo-400'}>
      <Timer size={16} />
      {fmt(seconds)}
    </div>
  )
}

/** Live clock counting up from a fixed start timestamp (ms epoch). */
export function ElapsedClock({ startTime, className }: { startTime: number; className?: string }) {
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - startTime) / 1000)))

  useEffect(() => {
    const id = window.setInterval(
      () => setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000))),
      1000,
    )
    return () => clearInterval(id)
  }, [startTime])

  return (
    <div className={className ?? 'hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground'}>
      <Clock className="h-4 w-4" />
      <span className="font-mono font-bold">{fmt(elapsed)}</span>
    </div>
  )
}

/** Countdown clock for live quizzes; turns red under one minute. */
export function CountdownClock({
  createdAt,
  timeLimitMinutes,
}: {
  createdAt: number | null
  timeLimitMinutes: number | null
}) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    if (createdAt == null || timeLimitMinutes == null) {
      setTimeLeft(null)
      return
    }
    const tick = () => {
      const elapsed = Date.now() / 1000 - createdAt
      setTimeLeft(Math.ceil(Math.max(0, timeLimitMinutes * 60 - elapsed)))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [createdAt, timeLimitMinutes])

  const label =
    timeLeft === null ? '--:--' : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`

  return (
    <span
      className={`text-lg font-bold ${
        (timeLeft ?? 999) < 60 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-400 dark:text-indigo-300'
      }`}
    >
      {label}
    </span>
  )
}
