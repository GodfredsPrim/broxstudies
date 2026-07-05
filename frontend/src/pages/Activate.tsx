import { useCallback, useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ticket,
  ArrowRight,
  Check,
  Smartphone,
  Lock,
  CheckCircle2,
  MessageSquare,
  ChevronRight,
  Loader2,
  Phone,
} from 'lucide-react'
import { authApi, paymentsApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/Logo'
import { PhotoBackdrop } from '@/components/PhotoBackdrop'
import type { AuthConfigResponse } from '@/api/types'

type Step = 'pay' | 'otp' | 'activate'

const STEPS: { id: Step; label: string; num: string }[] = [
  { id: 'pay', label: 'Pay', num: '1' },
  { id: 'otp', label: 'Confirm', num: '2' },
  { id: 'activate', label: 'Activate', num: '3' },
]

const DEFAULT_CONFIG: AuthConfigResponse = {
  subscription_price_ghs: '20',
  subscription_months: 3,
  momo_payment_number: '0248317900',
  sms_enabled: false,
  moolre_payment_enabled: false,
}

const POLL_INTERVAL_MS = 4000
const POLL_MAX_ATTEMPTS = 30 // ~2 minutes

export function ActivatePage() {
  const { user, refresh } = useAuth()
  const { selectedTrack, isLocked } = useAcademicTrack()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'

  const [step, setStep] = useState<Step>('pay')
  const [config, setConfig] = useState<AuthConfigResponse>(DEFAULT_CONFIG)

  // Moolre payment state
  const [momoNumber, setMomoNumber] = useState('')
  const [moolreLoading, setMoolreLoading] = useState(false)
  const [moolreError, setMoolreError] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'otp_required' | 'success' | 'failed' | ''>('')
  const [paymentMessage, setPaymentMessage] = useState('')

  // OTP confirmation state
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')

  // Polling
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollAttempts = useRef(0)

  // Activation state
  const [code, setCode] = useState('')
  const [activateError, setActivateError] = useState('')
  const [activateLoading, setActivateLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    authApi.config().then(setConfig).catch(() => {})
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const handlePaymentSuccess = useCallback((accessCode?: string | null, smsSent?: boolean) => {
    stopPolling()
    setPaymentStatus('success')
    if (accessCode) setCode(accessCode)
    setPaymentMessage(
      smsSent
        ? 'Payment confirmed! Your access code was sent by SMS — it\'s also filled in below.'
        : 'Payment confirmed! Enter your access code below to activate.',
    )
    setStep('activate')
  }, [stopPolling])

  const startPolling = useCallback((ref: string) => {
    pollAttempts.current = 0
    pollRef.current = setInterval(async () => {
      pollAttempts.current++
      if (pollAttempts.current > POLL_MAX_ATTEMPTS) {
        stopPolling()
        setMoolreError('Payment is taking longer than expected. Check your phone and try refreshing.')
        return
      }
      try {
        const res = await paymentsApi.moolreStatus(ref)
        if (res.status === 'success') {
          handlePaymentSuccess(res.access_code, res.sms_sent)
        } else if (res.status === 'failed') {
          stopPolling()
          setPaymentStatus('failed')
          setMoolreError('Payment failed or was declined. Please try again.')
        }
      } catch {
        // network hiccup — keep polling
      }
    }, POLL_INTERVAL_MS)
  }, [stopPolling, handlePaymentSuccess])

  useEffect(() => () => stopPolling(), [stopPolling])

  const price = config.subscription_price_ghs || '20'
  const months = config.subscription_months || 3
  const moolreEnabled = Boolean(config.moolre_payment_enabled)

  const onMoolrePay = async () => {
    if (!momoNumber.trim()) {
      setMoolreError('Enter your MoMo number so we can collect payment.')
      return
    }
    setMoolreError('')
    setMoolreLoading(true)
    try {
      const res = await paymentsApi.moolreInitiate(momoNumber.trim())
      setExternalRef(res.external_ref)
      if (res.status === 'otp_required') {
        setPaymentStatus('otp_required')
        setStep('otp')
      } else if (res.status === 'pending') {
        setPaymentStatus('pending')
        setPaymentMessage('Approve the payment prompt on your phone, then wait here.')
        setStep('otp')
        startPolling(res.external_ref)
      } else {
        setMoolreError(res.message || 'Could not start payment. Please try again.')
      }
    } catch (err) {
      setMoolreError(extractError(err, 'Could not start payment.'))
    } finally {
      setMoolreLoading(false)
    }
  }

  const onOtpSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!otpCode.trim()) return
    setOtpError('')
    setOtpLoading(true)
    try {
      const res = await paymentsApi.moolreSubmitOtp(externalRef, otpCode.trim())
      if (res.status === 'pending') {
        setPaymentStatus('pending')
        setPaymentMessage('OTP accepted. Approve the payment prompt on your phone, then wait here.')
        startPolling(externalRef)
      } else if (res.status === 'otp_required') {
        setOtpError(res.message || 'Incorrect OTP. Please try again.')
      } else if (res.status === 'already_paid') {
        handlePaymentSuccess()
      } else {
        setOtpError('Something went wrong. Please try again.')
      }
    } catch (err) {
      setOtpError(extractError(err, 'Could not submit OTP.'))
    } finally {
      setOtpLoading(false)
    }
  }

  const onActivate = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setActivateError('')
    setActivateLoading(true)
    try {
      await authApi.verifyCode(code.trim(), selectedTrack)
      await refresh()
      setSuccess(true)
      setTimeout(() => navigate(next, { replace: true }), 900)
    } catch (err) {
      setActivateError(extractError(err, 'Invalid code. Please try again.'))
    } finally {
      setActivateLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <PhotoBackdrop seed={2} />
      <div className="pointer-events-none absolute inset-0">
        <div className="v2-mesh" style={{ opacity: 0.55 }} />
        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-2xl"
      >
        <Link to="/" className="mb-8 flex items-center gap-3">
          <Logo size={44} subtitle="Premium for SHS & TVET" />
        </Link>

        <Card padded={false} className="overflow-hidden border-[var(--line-strong)] shadow-xl shadow-black/5">
          {/* Hero */}
          <div className="border-b border-[var(--line)] bg-gradient-to-br from-indigo-500/8 via-transparent to-amber-400/8 px-7 py-8 sm:px-9">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Eyebrow className="mb-2">Go Premium</Eyebrow>
                <h1 className="v2-display text-[34px] leading-[1.05] tracking-tighter text-ink-0 sm:text-[40px]">
                  Unlock everything for{' '}
                  <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                    GH₵ {price}
                  </span>
                </h1>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-300">
                  Practice, WASSCE/NAPTEX prep, live quizzes, and the full library —{' '}
                  <strong className="text-ink-100">{months} months</strong> of unlimited access.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone="gold">GH₵ {price}</Badge>
                {config.sms_enabled && (
                  <span className="inline-flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400">
                    <MessageSquare size={12} /> Code sent by SMS
                  </span>
                )}
              </div>
            </div>

            {/* Step indicator */}
            <div className="mt-8 flex items-center gap-1">
              {STEPS.map((s, i) => {
                const active = step === s.id
                const done =
                  (s.id === 'pay' && (step === 'otp' || step === 'activate')) ||
                  (s.id === 'otp' && step === 'activate')
                return (
                  <div key={s.id} className="flex flex-1 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => { if (done) setStep(s.id) }}
                      className={cn(
                        'flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all',
                        active
                          ? 'bg-indigo-500/15 ring-1 ring-indigo-500/25'
                          : done
                            ? 'bg-[var(--bg-2)] opacity-80'
                            : 'bg-[var(--bg-2)]/60 opacity-60',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                          active || done ? 'bg-indigo-500 text-white' : 'bg-[var(--bg-3)] text-ink-400',
                        )}
                      >
                        {done && !active ? <Check size={12} /> : s.num}
                      </span>
                      <span className={cn('text-[13px] font-medium', active ? 'text-ink-0' : 'text-ink-300')}>
                        {s.label}
                      </span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <ChevronRight size={14} className="shrink-0 text-ink-500" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="p-7 sm:p-9">
            <AnimatePresence mode="wait">
              {/* ── Step 1: Pay ────────────────────────────────────────────── */}
              {step === 'pay' && (
                <motion.div
                  key="pay"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  {moolreEnabled ? (
                    <>
                      <div>
                        <h2 className="font-display text-xl text-ink-0">Pay with Mobile Money</h2>
                        <p className="mt-1 text-sm text-ink-400">
                          Pay <strong className="text-ink-100">GH₵ {price}</strong> directly from your MoMo wallet.
                          {config.sms_enabled && ' Your access code is sent by SMS automatically.'}
                        </p>
                      </div>

                      <label className="block">
                        <span className="mb-1.5 block text-[13px] font-medium text-ink-100">
                          Your MoMo number
                        </span>
                        <div className="relative">
                          <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                          <Input
                            type="tel"
                            value={momoNumber}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setMomoNumber(e.target.value)}
                            placeholder="0241234567"
                            className="pl-9"
                          />
                        </div>
                      </label>

                      {moolreError && (
                        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
                          {moolreError}
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        fullWidth
                        loading={moolreLoading}
                        leading={<Smartphone size={16} />}
                        onClick={() => void onMoolrePay()}
                      >
                        Pay GH₵ {price} with MoMo
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
                      MoMo payment isn't available right now. If you have a promo or access code, use the option below.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setStep('activate')}
                    className="w-full rounded-xl border border-indigo-500/20 bg-indigo-500/8 px-4 py-3 text-left text-sm text-indigo-400 transition-colors hover:bg-indigo-500/12 dark:text-indigo-400"
                  >
                    Have a promo code? Try <strong className="font-mono text-indigo-400 dark:text-indigo-300">BROX</strong>{' '}
                    for 7 days free — skip payment and go straight to activation.
                  </button>
                </motion.div>
              )}

              {/* ── Step 2: OTP / Confirm ─────────────────────────────────── */}
              {step === 'otp' && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  {paymentStatus === 'pending' && (
                    <div className="flex items-center gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-400">
                      <Loader2 size={18} className="shrink-0 animate-spin" />
                      <span>{paymentMessage || 'Waiting for payment confirmation…'}</span>
                    </div>
                  )}

                  {paymentStatus === 'otp_required' && (
                    <>
                      <div>
                        <h2 className="font-display text-xl text-ink-0">Enter your network OTP</h2>
                        <p className="mt-1 text-sm text-ink-400">
                          Your network (MTN / Telecel / AT) sent a one-time PIN to{' '}
                          <strong className="text-ink-100">{momoNumber}</strong>. Enter it to confirm the payment.
                        </p>
                      </div>

                      <form onSubmit={onOtpSubmit} className="space-y-4">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={otpCode}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setOtpCode(e.target.value)}
                          placeholder="e.g. 123456"
                          className="font-mono text-lg tracking-widest text-center"
                          autoFocus
                          required
                        />

                        {otpError && (
                          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
                            {otpError}
                          </div>
                        )}

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button type="button" variant="ghost" size="lg" onClick={() => { stopPolling(); setStep('pay') }}>
                            Back
                          </Button>
                          <Button type="submit" variant="primary" size="lg" fullWidth loading={otpLoading} trailing={<ArrowRight size={14} />}>
                            Confirm Payment
                          </Button>
                        </div>
                      </form>
                    </>
                  )}
                </motion.div>
              )}

              {/* ── Step 3: Activate ─────────────────────────────────────── */}
              {step === 'activate' && (
                <motion.div
                  key="activate"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25 }}
                >
                  {paymentMessage && (
                    <div className="mb-5 flex items-start gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-400">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Payment confirmed!</p>
                        <p className="mt-0.5 text-indigo-500/90 dark:text-indigo-400/90">{paymentMessage}</p>
                      </div>
                    </div>
                  )}

                  {selectedTrack && (
                    <div className="mb-5 flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-400">
                      <Lock size={14} className="shrink-0" />
                      <span>
                        Locks account to <strong>{selectedTrack.toUpperCase()}</strong>
                        {isLocked ? ' (already locked)' : ''}.
                      </span>
                    </div>
                  )}

                  <form onSubmit={onActivate} className="space-y-4">
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400/15 text-amber-600 dark:text-amber-300">
                          <Ticket size={16} />
                        </div>
                        <div>
                          <h2 className="font-display text-xl text-ink-0">Enter access code</h2>
                          <p className="text-sm text-ink-400">BROX promo or your 6-character code</p>
                        </div>
                      </div>
                      <Input
                        type="text"
                        placeholder="BROX or 6-character code"
                        value={code}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.toUpperCase())}
                        className="font-mono text-lg tracking-[0.25em] text-center"
                        autoFocus
                        required
                        disabled={success}
                      />
                    </div>

                    {activateError && (
                      <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
                        {activateError}
                      </div>
                    )}
                    {success && (
                      <div className="flex items-center gap-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-500 dark:text-indigo-400">
                        <Check size={16} /> Activated — redirecting…
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="ghost" size="lg" onClick={() => setStep('pay')}>
                        Back
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        loading={activateLoading}
                        disabled={success}
                        fullWidth
                        trailing={<ArrowRight size={14} />}
                      >
                        Activate Premium
                      </Button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-5 text-xs text-ink-400">
              <span>
                Signed in as <span className="text-ink-100">{user?.email || user?.phone}</span>
              </span>
              <Link to="/" className="font-medium text-indigo-500 hover:text-indigo-400 dark:text-indigo-400">
                Skip — continue with limited access
              </Link>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
