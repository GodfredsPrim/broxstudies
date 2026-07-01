import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, KeyRound, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout, Field } from '@/components/auth/AuthLayout'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/dashboard'

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
          <div className="v2-alert v2-alert-error">
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
          className="font-semibold text-indigo-400 hover:text-indigo-300"
        >
          Create an account
        </Link>
      </div>
    </AuthLayout>
  )
}

export { AuthLayout, Field } from '@/components/auth/AuthLayout'
