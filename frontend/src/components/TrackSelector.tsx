import { motion } from 'framer-motion'
import { GraduationCap, Wrench } from 'lucide-react'
import { cn } from '@/lib/cn'

export type TrackChoice = 'shs' | 'tvet'

interface TrackSelectorProps {
  selectedTrack: TrackChoice | null
  onSelect: (track: TrackChoice) => void
}

const TRACK_OPTIONS: Array<{
  id: TrackChoice
  label: string
  subtitle: string
  description: string
  icon: typeof GraduationCap
  tone: 'emerald' | 'sky'
}> = [
  {
    id: 'shs',
    label: 'Senior High School',
    subtitle: 'SHS curriculum',
    description: 'Exam-focused SHS materials, WASSCE practice, and school subjects.',
    icon: GraduationCap,
    tone: 'emerald',
  },
  {
    id: 'tvet',
    label: 'Technical & TVET',
    subtitle: 'TVET curriculum',
    description: 'Skills-based NC II resources, technical subjects, and vocational training.',
    icon: Wrench,
    tone: 'sky',
  },
]

export function TrackSelector({ selectedTrack, onSelect }: TrackSelectorProps) {
  return (
    <section className="mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-[var(--bg-1)] p-6 shadow-sm sm:p-8">
      <div className="mb-8 text-center lg:px-16">
        <p className="text-sm font-semibold uppercase tracking-[0.32em] text-emerald-300">Select your track</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink-0 sm:text-4xl">
          Choose SHS or TVET to continue
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-ink-300">
          Pick the learning path you want. Your choice will persist in your browser and tailor the app experience for your curriculum.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TRACK_OPTIONS.map((option) => {
          const Icon = option.icon
          const active = selectedTrack === option.id
          return (
            <motion.button
              key={option.id}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(option.id)}
              className={cn(
                'group relative overflow-hidden rounded-3xl border p-6 text-left transition-all duration-200',
                active
                  ? 'border-emerald-400/40 bg-emerald-500/10 shadow-lg shadow-emerald-500/5'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10',
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-300">{option.subtitle}</p>
                  <h3 className="mt-3 text-2xl font-semibold text-ink-0">{option.label}</h3>
                </div>
                <span
                  className={cn(
                    'grid h-12 w-12 place-items-center rounded-2xl text-white',
                    option.tone === 'emerald' ? 'bg-emerald-500' : 'bg-sky-500',
                  )}
                >
                  <Icon size={20} />
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-300">{option.description}</p>
              {active && (
                <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  Selected
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}
