import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { PromoCodeButton } from '@/components/PromoCodeButton'

const DISMISS_KEY = 'brox.promo-banner-dismissed-at'
const DISMISS_HOURS = 24

/** Prominent, dismissible call-to-action so the 7-day promo code stays visible
 * to every non-premium student who lands on the dashboard. */
export function PromoBanner() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY)
      if (!raw) return false
      return Date.now() - Number(raw) < DISMISS_HOURS * 60 * 60 * 1000
    } catch {
      return false
    }
  })

  const hasActive = Boolean(user) && (user!.subscription_status === 'active' || Boolean(user!.has_access))
  if (!user || user.is_admin || hasActive || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* storage unavailable */
    }
    setDismissed(true)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-r from-indigo-600/15 via-purple-600/15 to-indigo-600/15 p-4 sm:p-5">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-indigo-400 hover:bg-white/5"
      >
        <X size={14} />
      </button>
      <div className="flex flex-col items-start gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-indigo-500 dark:text-indigo-300">
          <Sparkles size={16} className="shrink-0" />
          Unlock Practice, WASSCE prep & live quizzes free for 7 days with our promo code.
        </p>
        <PromoCodeButton className="w-full sm:w-auto" />
      </div>
    </div>
  )
}
