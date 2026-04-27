import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Lock, ArrowRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Card } from './ui/Card'
import { Eyebrow } from './ui/Eyebrow'

interface GateProps {
  children: ReactNode
  /** Require active subscription (not just auth). Default: true. */
  requireSubscription?: boolean
  /** Page label shown in the auth wall copy. */
  label: string
  /** One-liner explaining what the gated feature does. */
  pitch: string
}

/**
 * Soft gate for protected destinations. Instead of redirecting the guest
 * straight to /login, we render a full-page wall with the page's identity
 * preserved, so they see *what they're unlocking*.
 */
export function Gate({ children, requireSubscription = true, label, pitch }: GateProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400" />
      </div>
    )
  }

  if (!user) return <AuthWall label={label} pitch={pitch} redirect={location.pathname} mode="signup" />

  if (user.is_admin) return <>{children}</>

  const hasActive =
    user.subscription_status === 'active' || Boolean((user as any).has_access)

  if (requireSubscription && !hasActive) {
    return <AuthWall label={label} pitch={pitch} redirect={location.pathname} mode="activate" />
  }

  return <>{children}</>
}

function AuthWall({
  label,
  pitch,
  redirect,
  mode,
}: {
  label: string
  pitch: string
  redirect: string
  mode: 'signup' | 'activate'
}) {
  const signup = mode === 'signup'
  return (
    <div className="mx-auto max-w-2xl px-6 pt-20 pb-14">
      <Card className="overflow-hidden p-0" grain>
        <div className="relative px-8 pt-10 pb-8 sm:px-12 sm:pt-14">
          <div className="v2-mesh" style={{ opacity: 0.45 }} />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20">
                <Lock size={16} />
              </div>
              <Eyebrow>{label}</Eyebrow>
            </div>
            <h1 className="v2-display text-[38px] leading-[1.05] tracking-tighter text-ink-0">
              {signup ? (
                <>This one's for <em className="not-italic text-emerald-300">signed-in students.</em></>
              ) : (
                <>Activate to unlock <em className="not-italic text-emerald-300">{label}.</em></>
              )}
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-300">{pitch}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              {signup ? (
                <>
                  <Link
                    to={`/signup?next=${encodeURIComponent(redirect)}`}
                    className="v2-btn v2-btn-primary"
                  >
                    Create free account <ArrowRight size={14} />
                  </Link>
                  <Link
                    to={`/login?next=${encodeURIComponent(redirect)}`}
                    className="v2-btn v2-btn-ghost"
                  >
                    I already have one
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/activate" className="v2-btn v2-btn-primary">
                    Enter access code <ArrowRight size={14} />
                  </Link>
                  <Link to="/" className="v2-btn v2-btn-ghost">Back home</Link>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 bg-[var(--bg-2)]/50 px-8 py-4 sm:px-12">
          <Eyebrow className="!text-[10px]">
            {signup ? 'Free to start · 3 AI study chats for guests' : 'GH₵ 20 for 3 months via MoMo · 0248317900'}
          </Eyebrow>
        </div>
      </Card>
    </div>
  )
}
