import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, KeyRound, User, Eye, EyeOff, ArrowRight, Phone, Hash } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout, Field } from '@/components/auth/AuthLayout'
import { cn } from '@/lib/cn'

type Tab = 'email' | 'phone'

export function SignupPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/dashboard'

  const [tab, setTab] = useState<Tab>('email')

  // Email signup state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Phone OTP state
  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [sendLoading, setSendLoading] = useState(false)

  const afterSignIn = (token: string, user: any) => {
    signIn(token, user)
    if (user.is_admin) {
      navigate('/admin', { replace: true })
    } else {
      navigate(`/activate?next=${encodeURIComponent(next)}`, { replace: true })
    }
  }

  const onEmailSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.signup({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
      })
      afterSignIn(res.access_token, res.user)
    } catch (err) {
      setError(extractError(err, 'Unable to create account.'))
    } finally {
      setLoading(false)
    }
  }

  const onSendOtp = async () => {
    if (!phone.trim()) {
      setOtpError('Enter your phone number.')
      return
    }
    setOtpError('')
    setSendLoading(true)
    try {
      await authApi.requestOtp(phone.trim())
      setOtpSent(true)
    } catch (err) {
      setOtpError(extractError(err, 'Could not send OTP.'))
    } finally {
      setSendLoading(false)
    }
  }

  const onOtpSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!otpCode.trim()) return
    setOtpError('')
    setOtpLoading(true)
    try {
      const res = await authApi.verifyOtp(phone.trim(), otpCode.trim())
      afterSignIn(res.access_token, res.user)
    } catch (err) {
      setOtpError(extractError(err, 'Invalid or expired code.'))
    } finally {
      setOtpLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Create account"
      title={<>Begin your journey.</>}
      subtitle="Ghana's sharpest WASSCE prep tools. Free study chats while you decide to upgrade."
    >
      {/* Tab switcher */}
      <div className="mb-5 flex rounded-xl border border-[var(--line)] bg-[var(--bg-2)] p-1">
        {(['email', 'phone'] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setError(''); setOtpError('') }}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all',
              tab === t
                ? 'bg-[var(--bg-0)] text-ink-0 shadow-sm'
                : 'text-ink-400 hover:text-ink-200',
            )}
          >
            {t === 'email' ? <Mail size={14} /> : <Phone size={14} />}
            {t === 'email' ? 'Email' : 'Phone OTP'}
          </button>
        ))}
      </div>

      {tab === 'email' ? (
        <form onSubmit={onEmailSubmit} className="space-y-4">
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

          {error && <div className="v2-alert v2-alert-error">{error}</div>}

          <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth trailing={<ArrowRight size={14} />}>
            Create account
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          {!otpSent ? (
            <>
              <p className="text-sm text-ink-300">
                Sign up instantly with your Ghana phone number. No password needed.
              </p>
              <Field label="Phone number">
                <Input
                  type="tel"
                  placeholder="0241234567"
                  value={phone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                  leading={<Phone size={16} />}
                  autoFocus
                />
              </Field>
              {otpError && <div className="v2-alert v2-alert-error">{otpError}</div>}
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                loading={sendLoading}
                trailing={<ArrowRight size={14} />}
                onClick={() => void onSendOtp()}
              >
                Send verification code
              </Button>
            </>
          ) : (
            <form onSubmit={onOtpSubmit} className="space-y-4">
              <p className="text-sm text-ink-300">
                A 6-digit code was sent to <strong className="text-ink-0">{phone}</strong>.
              </p>
              <Field label="Verification code">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setOtpCode(e.target.value)}
                  leading={<Hash size={16} />}
                  className="font-mono tracking-widest"
                  autoFocus
                  required
                />
              </Field>
              {otpError && <div className="v2-alert v2-alert-error">{otpError}</div>}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="lg" onClick={() => setOtpSent(false)}>
                  Back
                </Button>
                <Button type="submit" variant="primary" size="lg" fullWidth loading={otpLoading} trailing={<ArrowRight size={14} />}>
                  Verify &amp; create account
                </Button>
              </div>
              <button
                type="button"
                onClick={() => void onSendOtp()}
                className="w-full text-center text-xs text-ink-400 hover:text-ink-200"
              >
                Didn't receive it? Resend code
              </button>
            </form>
          )}
        </div>
      )}

      <div className="mt-6 text-center text-sm text-ink-300">
        Already have one?{' '}
        <Link
          to={`/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-indigo-400 hover:text-indigo-300"
        >
          Log in
        </Link>
      </div>
    </AuthLayout>
  )
}
