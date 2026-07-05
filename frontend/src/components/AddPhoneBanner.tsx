import { useState } from 'react'
import { Phone, X } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'

const DISMISS_KEY = 'brox.add-phone-dismissed-at'
const DISMISS_HOURS = 24

export function AddPhoneBanner() {
  const { user, refresh } = useAuth()
  const [dismissed, setDismissed] = useState(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY)
      if (!raw) return false
      return Date.now() - Number(raw) < DISMISS_HOURS * 60 * 60 * 1000
    } catch {
      return false
    }
  })
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!user || user.phone || user.is_admin || dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* storage unavailable */
    }
    setDismissed(true)
  }

  const cancel = () => {
    setOpen(false)
    setStep('phone')
    setError('')
  }

  const onSendCode = async () => {
    if (!phone.trim()) {
      setError('Enter your phone number.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await authApi.addPhone(phone.trim())
      setStep('otp')
    } catch (err) {
      setError(extractError(err, 'Could not send code.'))
    } finally {
      setLoading(false)
    }
  }

  const onVerify = async () => {
    if (!code.trim()) return
    setError('')
    setLoading(true)
    try {
      await authApi.verifyPhone(phone.trim(), code.trim())
      await refresh()
      setOpen(false)
      setStep('phone')
      setPhone('')
      setCode('')
    } catch (err) {
      setError(extractError(err, 'Invalid or expired code.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 sm:px-8">
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
            <Phone size={14} className="shrink-0" />
            Add a phone number to secure your account and receive access codes by SMS.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Add phone
            </button>
            <button
              onClick={dismiss}
              className="grid h-7 w-7 place-items-center rounded-lg text-amber-500 hover:bg-white/5"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {step === 'phone' ? (
            <>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0241234567"
                autoFocus
                className="rounded-lg border border-amber-500/30 bg-[var(--bg-0)] px-3 py-1.5 text-sm text-ink-0 outline-none focus:border-amber-500/60"
              />
              <button
                disabled={loading}
                onClick={() => void onSendCode()}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Send code
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-amber-700 dark:text-amber-300">Code sent to {phone}</span>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="123456"
                autoFocus
                className="rounded-lg border border-amber-500/30 bg-[var(--bg-0)] px-3 py-1.5 text-sm font-mono tracking-widest text-ink-0 outline-none focus:border-amber-500/60"
              />
              <button
                disabled={loading}
                onClick={() => void onVerify()}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Verify
              </button>
            </>
          )}
          <button onClick={cancel} className="text-xs font-medium text-amber-600 underline underline-offset-2 dark:text-amber-400">
            Cancel
          </button>
          {error && <span className="text-xs text-rose-500">{error}</span>}
        </div>
      )}
    </div>
  )
}
