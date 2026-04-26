import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  BarChart3,
  Banknote,
  Ticket,
  Trophy,
  RefreshCw,
  Copy,
  Check,
  X,
  Plus,
  Image as ImageIcon,
  ShieldAlert,
  Users,
  Activity,
  Percent,
  FileText,
} from 'lucide-react'
import { adminApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import type {
  AccessCodeRecord,
  AdminAnalytics,
  Competition,
  PendingPayment,
} from '@/api/types'
import { cn } from '@/lib/cn'

type Tab = 'overview' | 'payments' | 'codes' | 'competitions'

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview',     label: 'Overview',     icon: BarChart3 },
  { id: 'payments',     label: 'Payments',     icon: Banknote },
  { id: 'codes',        label: 'Access Codes', icon: Ticket },
  { id: 'competitions', label: 'Competitions', icon: Trophy },
]

export function AdminPage() {
  const { user, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')

  const isDev = import.meta.env.DEV && typeof window !== 'undefined'
    && window.localStorage.getItem('brox.admin.dev') === 'true'

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 lg:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="v2-dot" />
            <span className="v2-eyebrow">Administrator</span>
            {isDev && (
              <Badge tone="gold">DEV BYPASS</Badge>
            )}
          </div>
          <h1 className="v2-display mt-2 text-[40px] leading-[1.05] tracking-tighter">
            Control room.
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-300">
            Every tab here hits a live backend endpoint. Confirm payments, mint access codes, and run competitions for BroxStudies students.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <span className="hidden text-xs text-ink-400 sm:inline">
              Signed in as <span className="text-ink-100">{user.email}</span>
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={signOut} leading={<ShieldAlert size={13} />}>
            Sign out admin
          </Button>
        </div>
      </header>

      <nav className="mt-7 flex flex-wrap gap-2 border-b border-[var(--line)] pb-3">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            data-active={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'v2-chip !h-9 !px-3.5 !text-[12.5px]',
              tab === id && 'shadow-sm',
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </nav>

      <section className="mt-6">
        {tab === 'overview'     && <OverviewPanel />}
        {tab === 'payments'     && <PaymentsPanel />}
        {tab === 'codes'        && <CodesPanel />}
        {tab === 'competitions' && <CompetitionsPanel />}
      </section>
    </div>
  )
}

/* ============================================================
   OVERVIEW
   ============================================================ */

function OverviewPanel() {
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const { loading, error, reload } = useAsyncLoad(
    () => adminApi.analytics(),
    setData,
  )

  if (loading && !data) return <LoadingBlock label="Loading analytics…" />
  if (error) return <ErrorBlock message={error} onRetry={reload} />
  if (!data) return null

  const stats: StatTile[] = [
    { label: 'Total users',         value: formatNumber(data.total_users),         icon: <Users size={14} /> },
    { label: 'Active subscriptions',value: formatNumber(data.active_subscriptions),icon: <Activity size={14} /> },
    { label: 'Expiring soon',       value: formatNumber(data.expiring_subscriptions), icon: <Percent size={14} /> },
    { label: 'Revenue (GH₵)',       value: formatCurrency(data.total_revenue_ghs), icon: <Banknote size={14} /> },
    { label: 'Codes generated',     value: formatNumber(data.total_codes_generated), icon: <Ticket size={14} /> },
    { label: 'Codes redeemed',      value: formatNumber(data.total_codes_used),    icon: <Check size={14} /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={reload} leading={<RefreshCw size={13} />}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <StatCardView key={s.label} {...s} />
        ))}
      </div>

      <Card>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg">Recent activity</h2>
          <span className="text-xs text-ink-400">
            {data.recent_activity.length} event{data.recent_activity.length === 1 ? '' : 's'}
          </span>
        </header>
        {data.recent_activity.length === 0 ? (
          <p className="text-sm text-ink-400">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {data.recent_activity.slice(0, 15).map((row, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                {Object.entries(row).map(([k, v]) => (
                  <span key={k} className="text-ink-300">
                    <span className="text-ink-400">{k}:</span>{' '}
                    <span className="font-medium text-ink-100">{formatCell(v)}</span>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

interface StatTile {
  label: string
  value: string
  icon: ReactNode
}

function StatCardView({ label, value, icon }: StatTile) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-ink-400">
        {icon}
        <span className="v2-eyebrow !text-[10px]">{label}</span>
      </div>
      <div className="mt-3 font-display text-[32px] leading-none text-ink-0">{value}</div>
    </Card>
  )
}

/* ============================================================
   PAYMENTS
   ============================================================ */

function PaymentsPanel() {
  const [rows, setRows] = useState<PendingPayment[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const { loading, error, reload } = useAsyncLoad(
    () => adminApi.pendingPayments(),
    setRows,
  )

  const act = async (id: number, action: 'confirm' | 'reject') => {
    setBusyId(id)
    setActionError('')
    try {
      if (action === 'confirm') await adminApi.confirmPayment(id)
      else await adminApi.rejectPayment(id)
      await reload()
    } catch (err) {
      setActionError(extractError(err, `Failed to ${action} payment.`))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <PanelHeader
        title="Pending MoMo payments"
        subtitle="Confirm or reject student activation requests."
        onRefresh={reload}
      />

      {actionError && <InlineError message={actionError} />}
      {error && <InlineError message={error} />}

      {loading && rows.length === 0 ? (
        <LoadingBlock label="Loading payments…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Banknote size={20} />}
          title="Nothing pending."
          body="All payment requests have been processed."
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <Th>User</Th>
                  <Th>MoMo</Th>
                  <Th>Reference</Th>
                  <Th>Requested</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <div className="font-medium text-ink-0">{p.full_name || '—'}</div>
                      <div className="text-xs text-ink-400">{p.email || '—'}</div>
                    </Td>
                    <Td>
                      <div className="text-ink-100">{p.momo_name || '—'}</div>
                      <div className="text-xs text-ink-400">{p.momo_number || '—'}</div>
                    </Td>
                    <Td className="font-mono text-[12.5px]">{p.reference || '—'}</Td>
                    <Td className="text-xs text-ink-300">{formatDate(p.created_at)}</Td>
                    <Td className="text-right">
                      <div className="inline-flex gap-1.5">
                        <Button
                          variant="primary"
                          size="sm"
                          loading={busyId === p.id}
                          onClick={() => void act(p.id, 'confirm')}
                          leading={<Check size={12} />}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busyId === p.id}
                          onClick={() => void act(p.id, 'reject')}
                          leading={<X size={12} />}
                        >
                          Reject
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

/* ============================================================
   ACCESS CODES
   ============================================================ */

function CodesPanel() {
  const [inventory, setInventory] = useState<AccessCodeRecord[]>([])
  const [quantity, setQuantity] = useState(5)
  const [duration, setDuration] = useState<number | ''>('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [newlyMinted, setNewlyMinted] = useState<string[]>([])

  const { loading, error, reload } = useAsyncLoad(
    () => adminApi.codeInventory(),
    setInventory,
  )

  const onGenerate = async (e: FormEvent) => {
    e.preventDefault()
    const qty = Math.max(1, Math.min(100, Number(quantity) || 1))
    setGenError('')
    setGenerating(true)
    try {
      const body: { quantity: number; duration_months?: number } = { quantity: qty }
      if (duration !== '' && Number(duration) > 0) body.duration_months = Number(duration)
      const res = await adminApi.generateCodes(body)
      setNewlyMinted(res.codes)
      await reload()
    } catch (err) {
      setGenError(extractError(err, 'Failed to generate codes.'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      <PanelHeader
        title="Subscription access codes"
        subtitle="Generate codes for students to redeem on /activate."
        onRefresh={reload}
      />

      <Card>
        <h3 className="font-display text-lg">Mint new codes</h3>
        <form onSubmit={onGenerate} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[150px_180px_auto]">
          <div>
            <label className="mb-1 block text-xs text-ink-400">Quantity (1–100)</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-400">Duration (months, optional)</label>
            <Input
              type="number"
              min={1}
              max={24}
              placeholder="default"
              value={duration}
              onChange={(e) => {
                const raw = e.target.value
                setDuration(raw === '' ? '' : Number(raw))
              }}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={generating}
              leading={<Plus size={13} />}
              fullWidth
            >
              Generate
            </Button>
          </div>
        </form>

        {genError && <div className="mt-3"><InlineError message={genError} /></div>}

        {newlyMinted.length > 0 && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="v2-eyebrow !text-[10px]">Just minted ({newlyMinted.length})</span>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(newlyMinted.join('\n'))}
                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-500 dark:text-emerald-300 dark:hover:text-emerald-200"
              >
                <Copy size={12} /> Copy all
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {newlyMinted.map((c) => (
                <code key={c} className="rounded bg-[var(--bg-2)] px-2 py-1 font-mono text-[12px]">
                  {c}
                </code>
              ))}
            </div>
          </div>
        )}
      </Card>

      {error && <InlineError message={error} />}

      {loading && inventory.length === 0 ? (
        <LoadingBlock label="Loading code inventory…" />
      ) : inventory.length === 0 ? (
        <EmptyState
          icon={<Ticket size={20} />}
          title="No unused codes."
          body="Mint a batch above and distribute them to students."
        />
      ) : (
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
            <h3 className="font-display text-base">Unused inventory</h3>
            <span className="text-xs text-ink-400">{inventory.length} codes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <Th>Code</Th>
                  <Th>Duration</Th>
                  <Th>Created</Th>
                  <Th className="text-right">Copy</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {inventory.map((row) => (
                  <tr key={row.code}>
                    <Td className="font-mono text-[13px] font-semibold text-ink-0">{row.code}</Td>
                    <Td className="text-ink-200">{row.duration_months} months</Td>
                    <Td className="text-xs text-ink-300">{formatDate(row.created_at)}</Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(row.code)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-300 hover:bg-[var(--bg-2)] hover:text-ink-0"
                      >
                        <Copy size={12} /> Copy
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

/* ============================================================
   COMPETITIONS
   ============================================================ */

function CompetitionsPanel() {
  const [rows, setRows] = useState<Competition[]>([])
  const { loading, error, reload } = useAsyncLoad(
    () => adminApi.listCompetitions(),
    setRows,
  )

  return (
    <div className="space-y-5">
      <PanelHeader
        title="Competitions"
        subtitle="Create and manage featured competitions."
        onRefresh={reload}
      />

      <CompetitionCreateForm onCreated={reload} />

      {error && <InlineError message={error} />}

      {loading && rows.length === 0 ? (
        <LoadingBlock label="Loading competitions…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Trophy size={20} />}
          title="No competitions yet."
          body="Create one above — it will appear in the News & Updates tab."
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <Th>Title</Th>
                  <Th>Prize</Th>
                  <Th>Dates</Th>
                  <Th>Status</Th>
                  <Th>Files</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((c) => (
                  <CompetitionRow key={c.id} comp={c} onChange={reload} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function CompetitionCreateForm({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prize, setPrize] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)

  const valid = title.trim() && description.trim() && prize.trim() && start && end

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setErr('')
    setOk(false)
    try {
      await adminApi.createCompetition({
        title: title.trim(),
        description: description.trim(),
        prize: prize.trim(),
        start_date: start,
        end_date: end,
      })
      setTitle(''); setDescription(''); setPrize(''); setStart(''); setEnd('')
      setOk(true)
      await onCreated()
    } catch (e) {
      setErr(extractError(e, 'Failed to create competition.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h3 className="font-display text-lg">Create competition</h3>
      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <LabeledField label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </LabeledField>
        <LabeledField label="Prize">
          <Input value={prize} onChange={(e) => setPrize(e.target.value)} required placeholder="e.g. GH₵ 500 + swag" />
        </LabeledField>
        <LabeledField label="Start date">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </LabeledField>
        <LabeledField label="End date">
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </LabeledField>
        <div className="md:col-span-2">
          <LabeledField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
            />
          </LabeledField>
        </div>
        {err && <div className="md:col-span-2"><InlineError message={err} /></div>}
        {ok && (
          <div className="md:col-span-2 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
            <Check size={14} /> Competition created. Upload a PDF or image from the row below.
          </div>
        )}
        <div className="md:col-span-2 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={busy}
            disabled={!valid}
            leading={<Plus size={13} />}
          >
            Create
          </Button>
        </div>
      </form>
    </Card>
  )
}

function CompetitionRow({ comp, onChange }: { comp: Competition; onChange: () => Promise<void> | void }) {
  const [busy, setBusy] = useState<'' | 'pdf' | 'image'>('')
  const [err, setErr] = useState('')

  const onUpload = async (kind: 'pdf' | 'image', file: File | null) => {
    if (!file) return
    setBusy(kind)
    setErr('')
    try {
      if (kind === 'pdf') await adminApi.uploadCompetitionPdf(comp.id, file)
      else await adminApi.uploadCompetitionImage(comp.id, file)
      await onChange()
    } catch (e) {
      setErr(extractError(e, `Failed to upload ${kind}.`))
    } finally {
      setBusy('')
    }
  }

  return (
    <tr>
      <Td>
        <div className="font-medium text-ink-0">{comp.title}</div>
        <div className="line-clamp-1 text-xs text-ink-400">{comp.description}</div>
      </Td>
      <Td>{comp.prize}</Td>
      <Td className="text-xs text-ink-300">
        {formatDate(comp.start_date)} → {formatDate(comp.end_date)}
      </Td>
      <Td>
        {comp.is_active
          ? <Badge tone="accent">Active</Badge>
          : <Badge>Inactive</Badge>}
      </Td>
      <Td className="text-xs text-ink-300">
        <div className="flex flex-col gap-0.5">
          <span>{comp.pdf_url ? <a href={comp.pdf_url} className="text-emerald-600 hover:underline dark:text-emerald-300">PDF</a> : 'No PDF'}</span>
          <span>{comp.image_url ? <a href={comp.image_url} className="text-emerald-600 hover:underline dark:text-emerald-300">Image</a> : 'No image'}</span>
        </div>
      </Td>
      <Td className="text-right">
        <div className="inline-flex flex-col gap-1 sm:flex-row">
          <FileButton
            accept="application/pdf"
            label="PDF"
            icon={<FileText size={12} />}
            loading={busy === 'pdf'}
            onPick={(f) => void onUpload('pdf', f)}
          />
          <FileButton
            accept="image/png,image/jpeg,image/webp"
            label="Image"
            icon={<ImageIcon size={12} />}
            loading={busy === 'image'}
            onPick={(f) => void onUpload('image', f)}
          />
        </div>
        {err && <div className="mt-1 text-xs text-rose-500 dark:text-rose-300">{err}</div>}
      </Td>
    </tr>
  )
}

function FileButton({
  accept, label, icon, loading, onPick,
}: {
  accept: string; label: string; icon: ReactNode; loading: boolean; onPick: (f: File | null) => void
}) {
  return (
    <label className={cn(
      'v2-btn v2-btn-subtle !h-8 !px-2.5 !text-[11.5px] cursor-pointer',
      loading && 'opacity-60 pointer-events-none',
    )}>
      {loading ? <RefreshCw size={12} className="animate-spin" /> : icon}
      <span>{loading ? 'Uploading…' : `Upload ${label}`}</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  )
}

/* ============================================================
   SHARED BITS
   ============================================================ */

function PanelHeader({ title, subtitle, onRefresh }: { title: string; subtitle?: string; onRefresh: () => void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="font-display text-2xl text-ink-0">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      <Button variant="ghost" size="sm" onClick={onRefresh} leading={<RefreshCw size={13} />}>
        Refresh
      </Button>
    </header>
  )
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-ink-400">{label}</span>
      {children}
    </label>
  )
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <Card className="flex items-center gap-3 py-10 text-sm text-ink-300">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--line)] border-t-emerald-500" />
      {label}
    </Card>
  )
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="flex items-center justify-between gap-3 border border-rose-500/30 bg-rose-500/5">
      <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-300">
        <ShieldAlert size={14} /> {message}
      </div>
      <Button variant="ghost" size="sm" onClick={onRetry} leading={<RefreshCw size={13} />}>
        Retry
      </Button>
    </Card>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
      <ShieldAlert size={14} /> {message}
    </div>
  )
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn('px-4 py-3 font-semibold', className)}>{children}</th>
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-top', className)}>{children}</td>
}

/* ============================================================
   HOOKS + FORMATTERS
   ============================================================ */

function useAsyncLoad<T>(loader: () => Promise<T>, onData: (t: T) => void) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await loader()
      onData(data)
    } catch (e) {
      setError(extractError(e, 'Failed to load.'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void run() }, [run])

  return useMemo(() => ({ loading, error, reload: run }), [loading, error, run])
}

function formatNumber(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-GH').format(n)
}

function formatCurrency(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCell(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number') return formatNumber(v)
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  try { return JSON.stringify(v) } catch { return String(v) }
}
