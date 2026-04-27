import { useEffect, useState, type FormEvent, type ChangeEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'

/**
 * Guards /admin. The visitor lands on an access-code form; submitting the
 * correct shared ADMIN_SECRET calls POST /api/admin/login-secret, which
 * returns an admin JWT + AuthUser. Once `user.is_admin` is true we render
 * the children.
 *
 * Dev bypass: only honored in `vite dev` builds. In production, setting
 * `localStorage.brox.admin.dev = 'true'` has no effect.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { user, signIn } = useAuth()
  const [devBypass, setDevBypass] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    try {
      setDevBypass(localStorage.getItem('brox.admin.dev') === 'true')
    } catch { /* ignore */ }
  }, [])

  if (user?.is_admin || devBypass) {
    return <>{children}</>
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const secret = code.trim()
    if (!secret) return
    setError('')
    setLoading(true)
    try {
      const res = await authApi.adminLogin(secret)
      signIn(res.access_token, res.user)
    } catch (err) {
      setError(extractError(err, 'Invalid access code.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden px-4 py-10">
      <div className="v2-mesh" style={{ opacity: 0.4 }} />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-ink-400 hover:text-ink-100">
          <ArrowLeft size={14} /> Back to Study
        </Link>

        <Card padded={false} className="overflow-hidden">
          <div className="p-7 sm:p-8">
            <div className="mb-5 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25 dark:text-emerald-300">
                <ShieldCheck size={16} />
              </div>
              <Eyebrow>Administrator access</Eyebrow>
            </div>

            <h1 className="v2-display text-[32px] leading-[1.05] tracking-tighter">
              Enter the admin access code.
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-300">
              This page manages payments, access codes, analytics and competitions for the whole platform. Only share the code with trusted administrators.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              <label className="mb-1 block text-[13px] font-medium text-ink-100">
                Access code
              </label>
              <Input
                type="password"
                placeholder="••••••••••"
                value={code}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
                leading={<KeyRound size={14} />}
                autoFocus
                required
                autoComplete="current-password"
                className="font-mono tracking-[0.15em]"
              />

              {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                fullWidth
                trailing={<ArrowRight size={14} />}
              >
                Unlock admin dashboard
              </Button>
            </form>

            {user && (
              <div className="mt-5 text-xs text-ink-400">
                Signed in as <span className="text-ink-100">{user.email}</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
