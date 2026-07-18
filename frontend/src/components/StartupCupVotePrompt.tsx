import { useState } from 'react'
import { ArrowUpRight, ShieldCheck, Trophy, X } from 'lucide-react'

const VOTE_ROUTE = '/vote'
const DISMISS_KEY = 'brox.startup-cup-vote-dismissed-at'
const DISMISS_HOURS = 12

export function StartupCupVotePrompt() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY))
      return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_HOURS * 60 * 60 * 1000
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // The prompt can still be dismissed for this session when storage is unavailable.
    }
    setDismissed(true)
  }

  return (
    <aside
      aria-label="Vote for BroxStudies in the National Startup Cup"
      className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-xl overflow-hidden rounded-2xl border border-amber-300/30 bg-[var(--bg-1)]/95 shadow-2xl shadow-black/30 backdrop-blur-xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[430px]"
    >
      <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-indigo-500" />
      <div className="p-4 sm:p-5">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss voting prompt"
          className="absolute right-3 top-3.5 grid h-8 w-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-white/5 hover:text-ink-0"
        >
          <X size={16} />
        </button>

        <div className="flex gap-3 pr-8">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500 ring-1 ring-amber-400/25">
            <Trophy size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-500">National Startup Cup</p>
            <h2 className="mt-1 text-lg font-extrabold text-ink-0">BroxStudies has been nominated!</h2>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-ink-300">
          Support us with a free vote. On the official Moolre page, enter your own phone number and use the OTP sent to you to confirm your vote.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href={VOTE_ROUTE}
            target="_blank"
            rel="noopener noreferrer"
            className="v2-btn v2-btn-primary h-11 flex-1 justify-center !px-5 text-sm"
          >
            Vote for BroxStudies <ArrowUpRight size={16} />
          </a>
          <span className="flex items-center justify-center gap-1.5 text-[11px] text-ink-400">
            <ShieldCheck size={14} className="text-emerald-500" />
            OTP stays on Moolre
          </span>
        </div>
      </div>
    </aside>
  )
}
