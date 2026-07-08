import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Ticket, Check } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { cn } from '@/lib/cn'

export const PROMO_CODE = 'BROX'

interface PromoCodeButtonProps {
  className?: string
  /** Where to land after a successful redemption. Defaults to the dashboard. */
  next?: string
}

/** One-click redemption of the promo code for 7 days of free premium access. */
export function PromoCodeButton({ className, next }: PromoCodeButtonProps) {
  const { refresh } = useAuth()
  const { selectedTrack } = useAcademicTrack()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const redeem = async () => {
    if (loading || done) return
    setError('')
    setLoading(true)
    try {
      await authApi.verifyCode(PROMO_CODE, selectedTrack)
      await refresh()
      setDone(true)
      setTimeout(() => navigate(next || '/dashboard', { replace: true }), 700)
    } catch (err) {
      setError(extractError(err, "Couldn't activate the promo code. Try again."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void redeem()}
        disabled={loading || done}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-glow-sm transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100',
          className,
        )}
      >
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Activating…
          </>
        ) : done ? (
          <>
            <Check size={15} /> Premium unlocked!
          </>
        ) : (
          <>
            <Ticket size={15} /> Try {PROMO_CODE} — 7 days free
          </>
        )}
      </button>
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </div>
  )
}
