import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, KeyRound, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/Eyebrow'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login({ email: email.trim().toLowerCase(), password: password.trim() })
      signIn(res.access_token, res.user)
      if (res.user.is_admin) {
        navigate('/admin', { replace: true })
      } else if (res.user.subscription_status !== 'active' && !(res.user as any).has_access) {
        navigate(`/activate?next=${encodeURIComponent(next)}`, { replace: true })
      } else {
        navigate(next, { replace: true })
      }
    } catch (err) {
      setError(extractError(err, 'Unable to sign in.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Log in"
      title={<>Welcome back.</>}
      subtitle="Your study streak, saved questions, and exam history are waiting."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            placeholder="student@example.com"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            leading={<Mail size={16} />}
            required
            autoFocus
          />
        </Field>
        <Field label="Password">
          <Input
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            leading={<KeyRound size={16} />}
            trailing={
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                className="text-ink-400 transition-colors hover:text-ink-0"
                tabIndex={-1}
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            required
          />
        </Field>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth trailing={<ArrowRight size={14} />}>
          Log in
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-ink-300">
        New to BroxStudies?{' '}
        <Link
          to={`/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-emerald-300 hover:text-emerald-200"
        >
          Create an account
        </Link>
      </div>
    </AuthLayout>
  )
}

/* ─────────────────────────────── shared pieces ────────────────────────────── */

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string
  title: React.ReactNode
  subtitle: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="v2-mesh" style={{ opacity: 0.5 }} />
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <Link to="/" className="mb-8 flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 shadow-glow-sm">
            <div className="v2-mesh" style={{ inset: 0, filter: 'blur(8px)', opacity: 0.8 }} />
            <span className="relative font-display text-[18px] text-[#02180F]">Bx</span>
          </div>
           <div>
             <div className="font-display text-lg leading-none text-ink-0">BroxStudies</div>
           </div>
        </Link>

        <Card padded={false} className="overflow-hidden">
          <div className="relative p-7 sm:p-9">
            <Eyebrow className="mb-3 block">{eyebrow}</Eyebrow>
            <h1 className="v2-display text-[38px] leading-[1.05] tracking-tighter text-ink-0">{title}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-300">{subtitle}</p>

            <div className="mt-8">{children}</div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-100">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}
