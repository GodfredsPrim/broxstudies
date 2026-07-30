import { useEffect, useState, type ReactNode } from 'react'
import { systemApi } from '@/api/endpoints'
import type { LoadingProgress } from '@/api/types'
import { LogoMark } from '@/components/Logo'
import { useAuth } from '@/hooks/useAuth'

/*
 * Keep startup short and visually stable. Most importantly, the application is
 * mounted only after the gate is gone. Mounting Safari form controls beneath
 * display:none can leave them unable to receive input until they are remounted.
 */
const MIN_SPLASH_MS = 450
const MAX_SPLASH_MS = 5_000
const POLL_MS = 750

export function BootGate({ children }: { children: ReactNode }) {
  const { loading: authLoading } = useAuth()
  const [progress, setProgress] = useState<LoadingProgress | null>(null)
  const [backendSettled, setBackendSettled] = useState(false)
  const [minTimeDone, setMinTimeDone] = useState(false)

  useEffect(() => {
    let alive = true
    let pollTimer: number | undefined

    const poll = async () => {
      try {
        const next = await systemApi.loadingProgress()
        if (!alive) return
        setProgress(next)
        if (!next.is_loading) {
          setBackendSettled(true)
          return
        }
      } catch {
        // The tutor remains usable when this optional warm-up endpoint is down.
        if (alive) setBackendSettled(true)
        return
      }
      if (alive) pollTimer = window.setTimeout(poll, POLL_MS)
    }

    void poll()
    const minimumTimer = window.setTimeout(() => setMinTimeDone(true), MIN_SPLASH_MS)
    const safetyTimer = window.setTimeout(() => setBackendSettled(true), MAX_SPLASH_MS)

    return () => {
      alive = false
      if (pollTimer !== undefined) window.clearTimeout(pollTimer)
      window.clearTimeout(minimumTimer)
      window.clearTimeout(safetyTimer)
    }
  }, [])

  if (!backendSettled || !minTimeDone || authLoading) {
    return <BootScene progress={progress} />
  }

  return <>{children}</>
}

function BootScene({ progress }: { progress: LoadingProgress | null }) {
  const raw = (progress ?? {}) as Record<string, unknown>
  const reported = Number(raw.progress_percentage ?? raw.percentage ?? 0)
  const percentage = Number.isFinite(reported) ? Math.max(0, Math.min(100, reported)) : 0

  return (
    <div
      className="fixed inset-0 z-[100] grid min-h-[100svh] place-items-center overflow-hidden bg-[var(--bg-0)] px-6"
      role="status"
      aria-live="polite"
      aria-label="Preparing BroxStudies"
    >
      <div className="v2-mesh opacity-60" aria-hidden />
      <div className="relative z-10 w-full max-w-sm text-center">
        <div className="mx-auto w-fit rounded-[22px] shadow-[0_18px_60px_-24px_rgba(32,178,190,.7)]">
          <LogoMark size={68} />
        </div>
        <h1 className="brand-wordmark v2-display mt-5 text-4xl sm:text-5xl">BroxStudies</h1>
        <p className="mt-2 text-sm text-ink-300">Preparing your study workspace</p>
        <div className="mx-auto mt-7 h-1.5 max-w-[240px] overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-400 transition-[width] duration-300"
            style={{ width: `${percentage || 12}%` }}
          />
        </div>
      </div>
    </div>
  )
}
