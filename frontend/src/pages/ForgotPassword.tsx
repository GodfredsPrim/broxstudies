import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Phone, Hash, KeyRound, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout, Field } from '@/components/auth/AuthLayout'

type Step = 'phone' | 'reset'

export function ForgotPasswordPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)

  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [show, setShow] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const onRequestReset = async (e: FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return
    setPhoneError('')
    setPhoneLoading(true)
    try {
      await authApi.requestPasswordReset(phone.trim())
      setStep('reset')
    } catch (err) {
      setPhoneError(extractError(err, 'Could not send a verification code.'))
    } finally {
      setPhoneLoading(false)
    }
  }

  const onResend = async () => {
    setResendLoading(true)
    setResetError('')
    try {
      await authApi.requestPasswordReset(phone.trim())
    } catch (err) {
      setResetError(extractError(err, 'Could not resend code.'))
    } finally {
      setResendLoading(false)
    }
  }

  const onConfirmReset = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !newPassword.trim()) return
    setResetError('')
    setResetLoading(true)
    try {
      const res = await authApi.confirmPasswordReset(phone.trim(), code.trim(), newPassword.trim())
      signIn(res.access_token, res.user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setResetError(extractError(err, 'Invalid or expired code.'))
    } finally {
      setResetLoading(false)
    }
  }

  if (step === 'reset') {
    return (
      <AuthLayout
        eyebrow="Reset password"
        title={<>Check your phone.</>}
        subtitle={
          <>
            A 6-digit code was sent to <strong className="text-ink-0">{phone.trim()}</strong>. Enter it below with your new password.
          </>
        }
      >
        <form onSubmit={onConfirmReset} className="space-y-4">
          <Field label="Verification code">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
              leading={<Hash size={16} />}
              className="font-mono tracking-widest"
              autoFocus
              required
            />
          </Field>
          <Field label="New password" hint="At least 6 characters.">
            <Input
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Choose a new password"
              value={newPassword}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
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

          {resetError && <div className="v2-alert v2-alert-error">{resetError}</div>}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="lg" onClick={() => setStep('phone')}>
              Back
            </Button>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={resetLoading} trailing={<ArrowRight size={14} />}>
              Reset password
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
      eyebrow="Forgot password"
      title={<>Let's get you back in.</>}
      subtitle="Enter the phone number on your account and we'll text you a code to reset your password."
    >
      <form onSubmit={onRequestReset} className="space-y-4">
        <Field label="Phone number">
          <Input
            type="tel"
            autoComplete="tel"
            placeholder="024..."
            value={phone}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
            leading={<Phone size={16} />}
            required
            autoFocus
          />
        </Field>

        {phoneError && <div className="v2-alert v2-alert-error">{phoneError}</div>}

        <Button type="submit" variant="primary" size="lg" loading={phoneLoading} fullWidth trailing={<ArrowRight size={14} />}>
          Send code
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-ink-300">
        Remember your password?{' '}
        <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
          Log in
        </Link>
      </div>
    </AuthLayout>
  )
}
