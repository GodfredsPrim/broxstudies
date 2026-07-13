import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, KeyRound, User, Eye, EyeOff, ArrowRight, Phone, Hash, MessageCircle, X } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout, Field } from '@/components/auth/AuthLayout'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import type { AuthUser } from '@/api/types'

export function SignupPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/dashboard'

  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; clientId: string }>({ enabled: false, clientId: '' })

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Set once signup() sends the verification OTP
  const [pendingPhone, setPendingPhone] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [showCommunityInvite, setShowCommunityInvite] = useState(false)
  const [verifiedUser, setVerifiedUser] = useState<AuthUser | null>(null)
  const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/GDc8d4lzz8UDaVtZwqnjeI?mode=gi_t'

  useEffect(() => {
    authApi.config()
      .then(c => setGoogleConfig({ enabled: Boolean(c.google_enabled && c.google_client_id), clientId: c.google_client_id || '' }))
      .catch(() => {})
  }, [])

  const afterSignIn = (user: AuthUser) => {
    if (user.is_admin) {
      navigate('/admin', { replace: true })
    } else {
      navigate(`/activate?next=${encodeURIComponent(next)}`, { replace: true })
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.signup({
        full_name: fullName.trim(),
        phone: phone.trim(),
        password: password.trim(),
        email: email.trim() ? email.trim().toLowerCase() : undefined,
      })
      setPendingPhone(res.phone)
    } catch (err) {
      setError(extractError(err, 'Unable to create account.'))
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
      setVerifiedUser(res.user)
      setShowCommunityInvite(true)
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
      <>
      <AuthLayout
        eyebrow="Verify your phone"
        title={<>Check your messages.</>}
        subtitle="One quick step to secure your account."
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
              Verify &amp; create account
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
      {showCommunityInvite && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="community-title">
          <div className="relative w-full max-w-md rounded-2xl border border-emerald-400/20 bg-[var(--bg-1)] p-6 shadow-2xl">
            <button type="button" onClick={() => verifiedUser && afterSignIn(verifiedUser)} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-[var(--fg-3)] hover:bg-[var(--bg-2)]" aria-label="Close community invitation"><X size={16} /></button>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400"><MessageCircle size={23} /></span>
            <h2 id="community-title" className="mt-5 text-xl font-bold text-[var(--fg-0)]">Welcome to BroxStudies</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--fg-2)]">Join the official WhatsApp community for study news, product updates, competitions, and help from other BroxStudies learners.</p>
            <div className="mt-6 grid gap-2">
              <a href={WHATSAPP_COMMUNITY_URL} target="_blank" rel="noreferrer" onClick={() => setTimeout(() => verifiedUser && afterSignIn(verifiedUser), 300)} className="v2-btn v2-btn-primary h-11 w-full justify-center bg-emerald-600 hover:bg-emerald-700"><MessageCircle size={16} /> Join WhatsApp community</a>
              <button type="button" onClick={() => verifiedUser && afterSignIn(verifiedUser)} className="v2-btn v2-btn-ghost h-10 w-full justify-center">Maybe later</button>
            </div>
          </div>
        </div>
      )}
      </>
    )
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
        <Field label="Phone number" hint="We'll text you a code to verify your account">
          <Input
            type="tel"
            autoComplete="tel"
            placeholder="0241234567"
            value={phone}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
            leading={<Phone size={16} />}
            required
          />
        </Field>
        <Field label="Email" hint="Optional — lets you log in with either">
          <Input
            type="email"
            autoComplete="email"
            placeholder="student@example.com"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            leading={<Mail size={16} />}
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
