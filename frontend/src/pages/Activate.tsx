import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ticket,
  ArrowRight,
  Check,
  Smartphone,
  Lock,
  Copy,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  ChevronRight,
  CreditCard,
  Loader2,
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
import type { AuthConfigResponse } from '@/api/types'

type Step = 'pay' | 'confirm' | 'activate'

const STEPS: { id: Step; label: string; num: string }[] = [
  { id: 'pay', label: 'Pay', num: '1' },
  { id: 'confirm', label: 'Confirm', num: '2' },
  { id: 'activate', label: 'Activate', num: '3' },
]

const DEFAULT_CONFIG: AuthConfigResponse = {
  subscription_price_ghs: '20',
  subscription_months: 3,
  momo_payment_number: '0248317900',
  sms_enabled: false,
  paystack_enabled: false,
  paystack_public_key: '',
}

export function ActivatePage() {
  const { user, refresh } = useAuth()
  const { selectedTrack, isLocked } = useAcademicTrack()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'

  const [step, setStep] = useState<Step>('pay')
  const [config, setConfig] = useState<AuthConfigResponse>(DEFAULT_CONFIG)
  const [copied, setCopied] = useState(false)

  const [momoName, setMomoName] = useState(user?.full_name || '')
  const [momoNumber, setMomoNumber] = useState('')
  const [reference, setReference] = useState('')
  const [paymentSubmitted, setPaymentSubmitted] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)

  const [paystackPhone, setPaystackPhone] = useState('')
  const [paystackLoading, setPaystackLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [paystackSuccess, setPaystackSuccess] = useState('')

  const [code, setCode] = useState('')
  const [activateError, setActivateError] = useState('')
  const [activateLoading, setActivateLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    authApi.config().then(setConfig).catch(() => {})
  }, [])

  const paystackReference = params.get('reference')

  useEffect(() => {
    if (!paystackReference) return
    let cancelled = false
    setVerifyLoading(true)
    setPaymentError('')
    paymentsApi
      .paystackVerify(paystackReference)
      .then(res => {
        if (cancelled) return
        if (res.status === 'success' && res.access_code) {
          setCode(res.access_code)
          setStep('activate')
          setPaystackSuccess(
            res.sms_sent
              ? 'Payment confirmed! Your access code was sent by SMS — it’s also filled in below.'
              : 'Payment confirmed! Enter your access code below to activate.',
          )
        } else if (res.status === 'success') {
          setStep('activate')
          setPaystackSuccess('Payment confirmed! Enter the access code you received.')
        } else {
          setPaymentError(res.sms_message || 'Payment not completed yet. Try again or contact support.')
        }
      })
      .catch(err => {
        if (!cancelled) {
          setPaymentError(extractError(err, 'Could not verify payment.'))
        }
      })
      .finally(() => {
        if (!cancelled) setVerifyLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [paystackReference])

  const price = config.subscription_price_ghs || '20'
  const paystackEnabled = Boolean(config.paystack_enabled && config.paystack_public_key)
  const months = config.subscription_months || 3
  const momoNumber_display = config.momo_payment_number || '0248317900'

  const copyMomo = async () => {
    try {
      await navigator.clipboard.writeText(momoNumber_display)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const onPaystackPay = async () => {
    if (!paystackPhone.trim()) {
      setPaymentError('Enter your MoMo number so we can text your access code.')
      return
    }
    setPaymentError('')
    setPaystackLoading(true)
    try {
      const callbackUrl = `${window.location.origin}/activate?next=${encodeURIComponent(next)}`
      const res = await paymentsApi.paystackInitialize({
        momo_number: paystackPhone.trim(),
        callback_url: callbackUrl,
      })
      window.location.href = res.authorization_url
    } catch (err) {
      setPaymentError(extractError(err, 'Could not start online payment.'))
      setPaystackLoading(false)
    }
  }

  const onPaymentSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPaymentError('')
    setPaymentLoading(true)
    try {
      await authApi.paymentRequest({
        momo_name: momoName.trim(),
        momo_number: momoNumber.trim(),
        reference: reference.trim(),
      })
      setPaymentSubmitted(true)
      setStep('activate')
    } catch (err) {
      setPaymentError(extractError(err, 'Could not submit payment details.'))
    } finally {
      setPaymentLoading(false)
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
      <div className="pointer-events-none absolute inset-0">
        <div className="v2-mesh" style={{ opacity: 0.55 }} />
        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-2xl"
      >
        <Link to="/" className="mb-8 flex items-center gap-3">
          <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 shadow-glow-sm">
            <span className="relative font-display text-[18px] text-[#02180F]">Bx</span>
          </div>
          <div>
            <div className="font-display text-lg leading-none text-ink-0">BroxStudies</div>
            <div className="mt-0.5 text-xs text-ink-400">Premium for SHS & TVET</div>
          </div>
        </Link>

        <Card padded={false} className="overflow-hidden border-[var(--line-strong)] shadow-xl shadow-black/5">
          {/* Hero */}
          <div className="border-b border-[var(--line)] bg-gradient-to-br from-emerald-500/8 via-transparent to-amber-400/8 px-7 py-8 sm:px-9">
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
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-300">
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
                  (s.id === 'pay' && (step === 'confirm' || step === 'activate')) ||
                  (s.id === 'confirm' && (paymentSubmitted || step === 'activate'))
                return (
                  <div key={s.id} className="flex flex-1 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setStep(s.id)}
                      className={cn(
                        'flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all',
                        active
                          ? 'bg-emerald-500/15 ring-1 ring-emerald-500/25'
                          : done
                            ? 'bg-[var(--bg-2)] opacity-80'
                            : 'bg-[var(--bg-2)]/60 opacity-60',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                          active || done
                            ? 'bg-emerald-500 text-white'
                            : 'bg-[var(--bg-3)] text-ink-400',
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
              {step === 'pay' && (
                <motion.div
                  key="pay"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  {verifyLoading && (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                      <Loader2 size={18} className="shrink-0 animate-spin" />
                      Verifying your payment…
                    </div>
                  )}

                  {paystackEnabled && (
                    <>
                      <div>
                        <h2 className="font-display text-xl text-ink-0">Pay online</h2>
                        <p className="mt-1 text-sm text-ink-400">
                          Pay <strong className="text-ink-100">GH₵ {price}</strong> with card or MoMo via Paystack.
                          {config.sms_enabled && ' Your access code is sent by SMS automatically.'}
                        </p>
                      </div>

                      <label className="block">
                        <span className="mb-1.5 block text-[13px] font-medium text-ink-100">
                          MoMo number (for SMS delivery)
                        </span>
                        <Input
                          type="tel"
                          value={paystackPhone}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setPaystackPhone(e.target.value)}
                          placeholder="0241234567"
                        />
                      </label>

                      {paymentError && !verifyLoading && (
                        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
                          {paymentError}
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        fullWidth
                        loading={paystackLoading}
                        leading={<CreditCard size={16} />}
                        onClick={() => void onPaystackPay()}
                      >
                        Pay GH₵ {price} with Paystack
                      </Button>

                      <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-[var(--line)]" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="bg-[var(--bg-0)] px-3 text-ink-400">or pay manually</span>
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <h2 className="font-display text-xl text-ink-0">
                      {paystackEnabled ? 'Manual Mobile Money' : 'Send Mobile Money'}
                    </h2>
                    <p className="mt-1 text-sm text-ink-400">
                      Pay exactly <strong className="text-ink-100">GH₵ {price}</strong> to the number below.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-amber-600/5 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">
                          MoMo number
                        </p>
                        <p className="mt-1 font-display text-3xl tracking-tight text-ink-0">{momoNumber_display}</p>
                        <p className="mt-1 text-xs text-ink-400">Name: BroxStudies</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void copyMomo()}
                        leading={copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                      >
                        {copied ? 'Copied!' : 'Copy number'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <FeatureChip icon={<Smartphone size={14} />} title={`Pay GH₵ ${price}`} body="Use any MoMo wallet" />
                    <FeatureChip icon={<MessageSquare size={14} />} title="Get your code" body={config.sms_enabled ? 'Delivered by SMS' : 'Sent after admin confirms'} />
                    <FeatureChip icon={<Sparkles size={14} />} title="Unlock all" body={`${months} months premium`} />
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                    Try promo code <strong className="font-mono text-emerald-800 dark:text-emerald-200">BROX</strong>{' '}
                    for 7 days free — skip payment and go straight to activation.
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    fullWidth
                    trailing={<ArrowRight size={14} />}
                    onClick={() => setStep('confirm')}
                  >
                    I've sent the payment
                  </Button>
                </motion.div>
              )}

              {step === 'confirm' && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="mb-5">
                    <h2 className="font-display text-xl text-ink-0">Confirm your payment</h2>
                    <p className="mt-1 text-sm text-ink-400">
                      Tell us which MoMo number you paid from. We'll verify and
                      {config.sms_enabled ? ' text your access code to that number.' : ' send your access code.'}
                    </p>
                  </div>

                  <form onSubmit={onPaymentSubmit} className="space-y-4">
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-ink-100">MoMo account name</span>
                      <Input
                        value={momoName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setMomoName(e.target.value)}
                        placeholder="Name on your MoMo wallet"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-ink-100">MoMo number (for SMS)</span>
                      <Input
                        type="tel"
                        value={momoNumber}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setMomoNumber(e.target.value)}
                        placeholder="0241234567"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-ink-100">
                        Transaction reference <span className="font-normal text-ink-400">(optional)</span>
                      </span>
                      <Input
                        value={reference}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setReference(e.target.value)}
                        placeholder="MoMo transaction ID"
                      />
                    </label>

                    {paymentError && (
                      <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
                        {paymentError}
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
                        loading={paymentLoading}
                        fullWidth
                        trailing={<ArrowRight size={14} />}
                      >
                        Submit for verification
                      </Button>
                    </div>
                  </form>
                </motion.div>
              )}

              {step === 'activate' && (
                <motion.div
                  key="activate"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25 }}
                >
                  {paystackSuccess && (
                    <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Payment confirmed!</p>
                        <p className="mt-0.5 text-emerald-600/90 dark:text-emerald-300/90">{paystackSuccess}</p>
                      </div>
                    </div>
                  )}

                  {paymentSubmitted && !paystackSuccess && (
                    <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Payment submitted!</p>
                        <p className="mt-0.5 text-emerald-600/90 dark:text-emerald-300/90">
                          {config.sms_enabled
                            ? 'Once approved, your access code will arrive by SMS. Enter it below when you receive it.'
                            : 'Once approved, enter the access code you receive.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedTrack && (
                    <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
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
                      <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
                        <Check size={16} /> Activated — redirecting…
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="ghost" size="lg" onClick={() => setStep(paymentSubmitted ? 'confirm' : 'pay')}>
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
                Signed in as <span className="text-ink-100">{user?.email}</span>
              </span>
              <Link to="/" className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-300">
                Skip — continue with limited access
              </Link>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

function FeatureChip({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-2)]/80 p-3.5">
      <div className="mb-2 text-emerald-600 dark:text-emerald-300">{icon}</div>
      <div className="text-[13px] font-semibold text-ink-100">{title}</div>
      <div className="mt-0.5 text-xs text-ink-400">{body}</div>
    </div>
  )
}
