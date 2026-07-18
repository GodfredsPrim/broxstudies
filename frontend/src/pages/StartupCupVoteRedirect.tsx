import { useEffect } from 'react'
import { ArrowUpRight, LoaderCircle, Trophy } from 'lucide-react'

export const STARTUP_CUP_VOTE_URL = 'https://startup.moolre.com/leaderboard/50'

export function StartupCupVoteRedirect() {
  useEffect(() => {
    window.location.replace(STARTUP_CUP_VOTE_URL)
  }, [])

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg-0)] px-4 text-center">
      <div className="max-w-md rounded-3xl border border-amber-400/20 bg-[var(--bg-1)] p-8 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/15 text-amber-500">
          <Trophy size={28} />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-ink-0">Taking you to the voting portal</h1>
        <p className="mt-2 text-sm leading-6 text-ink-300">
          Vote for BroxStudies in the National Startup Cup on Moolre's official website.
        </p>
        <LoaderCircle className="mx-auto mt-5 animate-spin text-indigo-400" size={24} aria-hidden="true" />
        <a
          href={STARTUP_CUP_VOTE_URL}
          className="v2-btn v2-btn-primary mt-6 h-11 w-full justify-center !px-5 text-sm"
        >
          Continue to vote <ArrowUpRight size={16} />
        </a>
      </div>
    </main>
  )
}
