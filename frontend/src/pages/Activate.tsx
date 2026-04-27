import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Ticket, ArrowRight, Check, Smartphone } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/eyebrow'
import { Badge } from '@/components/ui/badge'

export function ActivatePage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setError('')
    setLoading(true)
    try {
      await authApi.verifyCode(code.trim())
      await refresh()
      setSuccess(true)
      setTimeout(() => navigate(next, { replace: true }), 900)
    } catch (err) {
      setError(extractError(err, 'Invalid code. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="v2-mesh" style={{ opacity: 0.5 }} />
      <div className="relative w-full max-w-lg">
        <Link to="/" className="mb-8 flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 shadow-glow-sm">
            <span className="relative font-display text-[18px] text-[#02180F]">Bx</span>
          </div>
           <div>
             <div className="font-display text-lg leading-none text-ink-0">BroxStudies</div>
           </div>
        </Link>

        <Card padded={false} className="overflow-hidden">
          <div className="relative p-7 sm:p-9">
            <div className="mb-5 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/20">
                <Ticket size={16} />
              </div>
              <Eyebrow>Premium activation</Eyebrow>
            </div>

            <h1 className="v2-display text-[36px] leading-[1.05] tracking-tighter text-ink-0">
              Unlock everything for <span className="text-amber-300">GH₵ 10</span>.
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-300">
               Pay via MoMo to <strong className="text-ink-0">0248317900</strong>, then enter the access
               code we send you to unlock Practice, Quiz, Library, and more for a full month.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniStep num="1" icon={<Smartphone size={14} />} label="Send GH₵ 10 via MoMo" />
              <MiniStep num="2" icon={<Ticket size={14} />} label="Receive BROX-XXXX code" />
              <MiniStep num="3" icon={<Check size={14} />} label="Paste code to unlock" />
            </div>

            <form onSubmit={onSubmit} className="mt-7 space-y-3">
              <label className="mb-1.5 block text-[13px] font-medium text-ink-100">Access code</label>
              <Input
                type="text"
                placeholder="BROX-XXXX"
                value={code}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.toUpperCase())}
                className="font-mono text-base tracking-[0.2em]"
                autoFocus
                required
                disabled={success}
              />

              {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  <Check size={16} /> Activated — redirecting…
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={success}
                fullWidth
                trailing={<ArrowRight size={14} />}
              >
                Activate Premium
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-400">
              <span>Signed in as <span className="text-ink-100">{user?.email}</span></span>
              <Link to="/" className="font-medium text-emerald-300 hover:text-emerald-200">
                Skip — continue with limited access
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/5 bg-[var(--bg-2)]/50 px-7 py-4 sm:px-9">
            <Eyebrow>Pricing</Eyebrow>
            <div className="flex items-center gap-2">
              <Badge tone="gold">GH₵ 10</Badge>
              <span className="text-xs text-ink-400">per month · unlimited practice</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function MiniStep({ num, icon, label }: { num: string; icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[var(--bg-2)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/15 font-mono text-[10px] font-bold text-emerald-300">
          {num}
        </span>
        <span className="text-emerald-300/80">{icon}</span>
      </div>
      <div className="text-[13px] font-medium text-ink-100">{label}</div>
    </div>
  )
}
