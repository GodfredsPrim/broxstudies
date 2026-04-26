import { useEffect, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, BookOpenText, FileText, GraduationCap } from 'lucide-react'
import { systemApi } from '@/api/endpoints'
import type { LoadingProgress } from '@/api/types'

/**
 * Full-screen boot gate. On first mount it polls /api/questions/loading-progress
 * every 2s until is_loading === false (or we time out and give up). While
 * waiting we show a cinematic loading scene with real document names.
 *
 * If the endpoint is already "loaded" on first ping, we unmount immediately
 * and the child app takes over — no flash.
 */
export function BootGate({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<LoadingProgress | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    let timeoutId: number | null = null
    let attempts = 0

    const tick = async () => {
      try {
        const p = await systemApi.loadingProgress()
        if (!alive) return
        setProgress(p)
        if (!p.is_loading) {
          setReady(true)
          return
        }
      } catch {
        attempts++
        if (attempts > 8) {
          // Backend may be down or slow; let the user in anyway
          if (alive) setFailed(true)
        }
      }
      if (alive) timeoutId = window.setTimeout(tick, 2000)
    }

    // Kick immediately
    void tick()

    // Hard safety valve — never hold the user behind boot for more than 20s
    const safety = window.setTimeout(() => {
      if (alive) setReady(true)
    }, 20_000)

    return () => {
      alive = false
      if (timeoutId) clearTimeout(timeoutId)
      clearTimeout(safety)
    }
  }, [])

  if (ready || failed) return <>{children}</>

  return (
    <>
      <AnimatePresence>
        <BootScene progress={progress} />
      </AnimatePresence>
      <div aria-hidden="true" style={{ display: 'none' }}>
        {children}
      </div>
    </>
  )
}

function BootScene({ progress }: { progress: LoadingProgress | null }) {
  const pct = Math.max(0, Math.min(100, progress?.progress_percentage ?? 0))
  const loaded = progress?.loaded_count ?? 0
  const total = progress?.total_count ?? 0
  const current = progress?.current_file ?? null
  const category = (progress?.category ?? 'Preparing').replace(/_/g, ' ')

  return (
    <motion.div
      key="boot"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[100] overflow-hidden bg-[var(--bg-0)]"
    >
      {/* Gradient mesh */}
      <div className="v2-mesh" />

      {/* Orbiting particles */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 18 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute block h-1 w-1 rounded-full bg-emerald-300/70"
            initial={{
              x: `${Math.random() * 100}vw`,
              y: `${Math.random() * 100}vh`,
              opacity: 0,
            }}
            animate={{
              x: [`${Math.random() * 100}vw`, `${Math.random() * 100}vw`],
              y: [`${Math.random() * 100}vh`, `${Math.random() * 100}vh`],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: 8 + Math.random() * 8,
              repeat: Infinity,
              delay: Math.random() * 4,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-lg place-items-center px-6">
        <div className="w-full space-y-8">
          {/* Wordmark */}
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 shadow-glow-md"
            >
              <div className="v2-mesh" style={{ inset: 0, opacity: 0.9 }} />
              <span className="relative font-display text-3xl text-[#02180F]">Bx</span>
            </motion.div>
            <motion.h1
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="v2-display mt-5 text-5xl text-ink-0"
            >
              BroxStudies
            </motion.h1>
            <motion.p
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.18, duration: 0.5 }}
              className="mt-2 text-center text-sm text-ink-300"
            >
              Loading your curriculum archive. One moment.
            </motion.p>
          </div>

          {/* Progress track */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.5 }}
            className="space-y-3"
          >
            <div className="flex items-end justify-between">
              <span className="v2-eyebrow">Archive</span>
              <span className="font-mono text-[13px] font-semibold tabular-nums text-ink-0">
                {pct.toFixed(0)}%
              </span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 24 }}
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.45)]"
              />
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-ink-400">
              <span>
                Loaded <span className="text-ink-0">{loaded}</span>
                {total > 0 && (
                  <>
                    {' '}
                    of <span className="text-ink-0">{total}</span>
                  </>
                )}{' '}
                documents
              </span>
              {progress?.remaining != null && progress.remaining > 0 && (
                <span>{progress.remaining} pending</span>
              )}
            </div>
          </motion.div>

          {/* Current file panel */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.5 }}
            className="v2-card v2-grain relative flex items-center gap-3 p-4"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/20">
              <CategoryIcon category={category} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="v2-eyebrow mb-1">{category}</div>
              <div className="truncate text-[13px] font-medium text-ink-0">
                {current || 'Indexing syllabus files…'}
              </div>
            </div>
            <Loader2 size={16} className="shrink-0 animate-spin text-ink-400" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-400"
          >
            Preparing syllabi · past questions · textbooks
          </motion.p>
        </div>
      </div>
    </motion.div>
  )
}

function CategoryIcon({ category }: { category: string }) {
  const lc = category.toLowerCase()
  if (lc.includes('past')) return <FileText size={18} />
  if (lc.includes('textbook')) return <BookOpenText size={18} />
  return <GraduationCap size={18} />
}
