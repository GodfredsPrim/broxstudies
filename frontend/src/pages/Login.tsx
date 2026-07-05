import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, KeyRound, Eye, EyeOff, ArrowRight, Hash } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout, Field } from '@/components/auth/AuthLayout'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import type { AuthUser } from '@/api/types'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/dashboard'

  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; clientId: string }>({ enabled: false, clientId: '' })

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Set when login() responds with otp_required (an unverified account resuming signup)
  const [pendingPhone, setPendingPhone] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  useEffect(() => {
    authApi.config()
      .then(c => setGoogleConfig({ enabled: Boolean(c.google_enabled && c.google_client_id), clientId: c.google_client_id || '' }))
      .catch(() => {})
  }, [])

  const afterSignIn = (user: AuthUser) => {
    if (user.is_admin) {
      navigate('/admin', { replace: true })
    } else if (user.subscription_status !== 'active' && !user.has_access) {
      navigate(`/activate?next=${encodeURIComponent(next)}`, { replace: true })
    } else {
      navigate(next, { replace: true })
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login({ identifier: identifier.trim(), password: password.trim() })
      if ('status' in res && res.status === 'otp_required') {
        setPendingPhone(res.phone)
      } else if ('access_token' in res) {
        signIn(res.access_token, res.user)
        afterSignIn(res.user)
      }
    } catch (err) {
      setError(extractError(err, 'Unable to sign in.'))
    } finally {
      setLoading(false)
    }
  }

  const onOtpSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!pendingPhone || !otpCode.trim()) return
    setOtpError('')
    setOtpLoading(true)
    try {
      const res = await authApi.verifyOtp(pendingPhone, otpCode.trim())
      signIn(res.access_token, res.user)
      afterSignIn(res.user)
    } catch (err) {
      setOtpError(extractError(err, 'Invalid or expired code.'))
    } finally {
      setOtpLoading(false)
    }
  }

  const onResend = async () => {
    if (!pendingPhone) return
    setResendLoading(true)
    setOtpError('')
    try {
      await authApi.requestOtp(pendingPhone)
    } catch (err) {
      setOtpError(extractError(err, 'Could not resend code.'))
    } finally {
      setResendLoading(false)
    }
  }

  if (pendingPhone) {
    return (
      <AuthLayout
        eyebrow="Verify your phone"
        title={<>Almost there.</>}
        subtitle="Your account still needs phone verification from signup — enter the code to finish signing in."
      >
        <form onSubmit={onOtpSubmit} className="space-y-4">
          <p className="text-sm text-ink-300">
            A 6-digit code was sent to <strong className="text-ink-0">{pendingPhone}</strong>.
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
            <Button type="button" variant="ghost" size="lg" onClick={() => setPendingPhone(null)}>
              Back
            </Button>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={otpLoading} trailing={<ArrowRight size={14} />}>
              Verify &amp; sign in
            </Button>
          </div>
          <button
            type="button"
            onClick={() => void onResend()}
            disabled={resendLoading}
            className="w-full text-center text-xs text-ink-400 hover:text-ink-200"
          >
            {resendLoading ? 'Resending…' : "Didn't receive it? Resend code"}
          </button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Log in"
      title={<>Welcome back.</>}
      subtitle="Your study streak, saved questions, and exam history are waiting."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email or phone number">
          <Input
            type="text"
            autoComplete="username"
            placeholder="student@example.com or 0241234567"
            value={identifier}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setIdentifier(e.target.value)}
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

        {error && <div className="v2-alert v2-alert-error">{error}</div>}

        <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth trailing={<ArrowRight size={14} />}>
          Log in
        </Button>
      </form>

      {googleConfig.enabled && (
        <>
          <div className="relative py-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--line)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--bg-0)] px-3 text-ink-400">or</span>
            </div>
          </div>
          <GoogleSignInButton
            clientId={googleConfig.clientId}
            onSignedIn={afterSignIn}
            onError={setError}
          />
        </>
      )}

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
