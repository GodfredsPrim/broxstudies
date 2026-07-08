import { useEffect, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, BookOpenText, FileText, GraduationCap } from 'lucide-react'
import { systemApi } from '@/api/endpoints'
import type { LoadingProgress } from '@/api/types'

/**
 * Full-screen boot gate. On first mount it polls /api/questions/loading-progress
 * every 2s until is_loading === false (or we time out and give up). While
 * waiting we show a cinematic branded splash with motion graphics.
 *
 * The splash always plays for at least MIN_SPLASH_MS, even when the backend
 * is already warm, then fades out over the app.
 */
const MIN_SPLASH_MS = 5_000

export function BootGate({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<LoadingProgress | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [minTimeDone, setMinTimeDone] = useState(false)

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

    // Splash must play for at least MIN_SPLASH_MS
    const minTimer = window.setTimeout(() => {
      if (alive) setMinTimeDone(true)
    }, MIN_SPLASH_MS)

    // Hard safety valve — never hold the user behind boot for more than 20s
    const safety = window.setTimeout(() => {
      if (alive) setReady(true)
    }, 20_000)

    return () => {
      alive = false
      if (timeoutId) clearTimeout(timeoutId)
      clearTimeout(minTimer)
      clearTimeout(safety)
    }
  }, [])

  const showSplash = !((ready || failed) && minTimeDone)

  return (
    <>
      <AnimatePresence>
        {showSplash && <BootScene progress={progress} backendReady={ready || failed} />}
      </AnimatePresence>
      <div aria-hidden={showSplash || undefined} style={{ display: showSplash ? 'none' : 'contents' }}>
        {children}
      </div>
    </>
  )
}

const WORDMARK = 'BroxStudies'
const TICKER_ITEMS = ['Syllabi', 'Past Questions', 'Textbooks', "Chief Examiners' Reports", 'AI Tutor']
const PARTICLE_COUNT =
  typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches ? 10 : 22

function BootScene({ progress, backendReady }: { progress: LoadingProgress | null; backendReady: boolean }) {
  // The backend exposes percentage/loaded_files/total_files/current_category;
  // older builds used progress_percentage/loaded_count/total_count/category — accept both.
  const raw = (progress ?? {}) as Record<string, any>
  const reportedPct = Number(raw.progress_percentage ?? raw.percentage ?? 0)
  const pct = backendReady ? 100 : Math.max(0, Math.min(100, reportedPct))
  const loaded = Number(raw.loaded_count ?? raw.loaded_files ?? 0)
  const total = Number(raw.total_count ?? raw.total_files ?? 0)
  const current = (raw.current_file as string | null) ?? null
  const category = String(raw.category ?? raw.current_category ?? 'Preparing').replace(/_/g, ' ')

  const [tickerIndex, setTickerIndex] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTickerIndex(i => (i + 1) % TICKER_ITEMS.length), 1100)
    return () => clearInterval(id)
  }, [])

  return (
    <motion.div
      key="boot"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[100] overflow-hidden bg-[var(--bg-0)]"
    >
      {/* Gradient mesh */}
      <div className="v2-mesh" />

      {/* Slow-breathing radial glow behind everything */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(16,185,129,0.16), transparent 70%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Orbiting particles — fewer on small screens to keep the splash smooth */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
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
            {/* Logo tile with orbiting ring */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Spinning conic ring */}
              <motion.span
                aria-hidden
                className="absolute -inset-2 rounded-[22px]"
                style={{
                  background:
                    'conic-gradient(from 0deg, transparent 0%, rgba(52,211,153,0.9) 12%, transparent 30%)',
                  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                  padding: 2,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
              />
              {/* Floating tile */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 shadow-glow-md"
              >
                <div className="v2-mesh" style={{ inset: 0, opacity: 0.9 }} />
                {/* Shine sweep */}
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 w-8 bg-white/30 blur-md"
                  initial={{ x: -48, skewX: -18 }}
                  animate={{ x: 80 }}
                  transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
                />
                <span className="relative font-display text-3xl text-[#02180F]">Bx</span>
              </motion.div>
            </motion.div>

            {/* Letter-by-letter wordmark */}
            <h1 className="v2-display mt-5 text-5xl text-ink-0" aria-label={WORDMARK}>
              {WORDMARK.split('').map((ch, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="inline-block"
                  initial={{ y: 26, opacity: 0, rotateX: 80 }}
                  animate={{ y: 0, opacity: 1, rotateX: 0 }}
                  transition={{ delay: 0.25 + i * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                >
                  {ch}
                </motion.span>
              ))}
            </h1>
            <motion.p
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.5 }}
              className="mt-2 text-center text-sm text-ink-300"
            >
              Ghana's study companion for SHS/STEM &amp; TVET.
            </motion.p>
          </div>

          {/* Progress track */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15, duration: 0.5 }}
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
                transition={
                  backendReady
                    ? { duration: 3.6, ease: [0.22, 1, 0.36, 1] }
                    : { type: 'spring', stiffness: 140, damping: 24 }
                }
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.45)]"
              />
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-ink-400">
              <span>
                {total > 0 ? (
                  <>
                    Loaded <span className="text-ink-0">{loaded}</span> of{' '}
                    <span className="text-ink-0">{total}</span> documents
                  </>
                ) : backendReady ? (
                  'Curriculum archive ready'
                ) : (
                  'Contacting curriculum archive…'
                )}
              </span>
              {raw.remaining != null && raw.remaining > 0 && <span>{raw.remaining} pending</span>}
            </div>
          </motion.div>

          {/* Current file panel */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.5 }}
            className="v2-card relative flex items-center gap-3 overflow-hidden p-4"
          >
            <div className="v2-grain" />
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/20">
              <CategoryIcon category={category} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="v2-eyebrow mb-1">{backendReady ? 'Warming up' : category}</div>
              <div className="truncate text-[13px] font-medium text-ink-0">
                {backendReady ? (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={tickerIndex}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -10, opacity: 0 }}
                      transition={{ duration: 0.28 }}
                      className="inline-block"
                    >
                      Preparing {TICKER_ITEMS[tickerIndex]}…
                    </motion.span>
                  </AnimatePresence>
                ) : (
                  current || 'Indexing syllabus files…'
                )}
              </div>
            </div>
            <Loader2 size={16} className="shrink-0 animate-spin text-ink-400" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.45, duration: 0.5 }}
            className="text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-400"
          >
            Syllabi · past questions · textbooks · AI tutor
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
