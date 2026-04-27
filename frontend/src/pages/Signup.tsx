import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, KeyRound, User, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthLayout, Field } from './Login'

export function SignupPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'

  const [fullName, setFullName] = useState('')
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
      const res = await authApi.signup({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
      })
      signIn(res.access_token, res.user)
      if (res.user.is_admin) {
        navigate('/admin', { replace: true })
      } else {
        navigate(`/activate?next=${encodeURIComponent(next)}`, { replace: true })
      }
    } catch (err) {
      setError(extractError(err, 'Unable to create account.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Create account"
      title={<>Begin your journey.</>}
      subtitle="Ghana's sharpest WASSCE prep tools. Free study chats while you decide to upgrade."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Full name">
          <Input
            type="text"
            autoComplete="name"
            placeholder="Ama Mensah"
            value={fullName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
            leading={<User size={16} />}
            required
            autoFocus
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            placeholder="student@example.com"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            leading={<Mail size={16} />}
            required
          />
        </Field>
        <Field label="Password" hint="At least 6 characters">
          <Input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Create a password"
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
            minLength={6}
            required
          />
        </Field>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth trailing={<ArrowRight size={14} />}>
          Create account
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-ink-300">
        Already have one?{' '}
        <Link
          to={`/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-emerald-300 hover:text-emerald-200"
        >
          Log in
        </Link>
      </div>
    </AuthLayout>
  )
}
