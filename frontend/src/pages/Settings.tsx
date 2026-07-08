import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Phone, ShieldAlert, TriangleAlert } from 'lucide-react'
import { authApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { PageLayout } from '@/components/ui/PageLayout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const onDelete = async () => {
    setError('')
    setDeleting(true)
    try {
      await authApi.deleteAccount()
      signOut()
      navigate('/welcome', { replace: true })
    } catch (err) {
      setError(extractError(err, 'Could not delete your account. Please try again.'))
      setDeleting(false)
    }
  }

  return (
    <PageLayout eyebrow="Account" title="Settings" subtitle="Manage your account details and preferences." width="medium">
      <Card className="space-y-4">
        <h2 className="font-display text-lg text-ink-0">Account details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3">
            <User size={16} className="shrink-0 text-ink-400" />
            <div className="min-w-0">
              <p className="text-xs text-ink-400">Name</p>
              <p className="truncate text-sm font-medium text-ink-0">{user?.full_name || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3">
            <Mail size={16} className="shrink-0 text-ink-400" />
            <div className="min-w-0">
              <p className="text-xs text-ink-400">Email</p>
              <p className="truncate text-sm font-medium text-ink-0">{user?.email || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3 sm:col-span-2">
            <Phone size={16} className="shrink-0 text-ink-400" />
            <div className="min-w-0">
              <p className="text-xs text-ink-400">Phone</p>
              <p className="truncate text-sm font-medium text-ink-0">{user?.phone || 'Not linked'}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-6 border-rose-500/25 bg-rose-500/[0.03]">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-400">
            <ShieldAlert size={18} />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg text-ink-0">Delete account</h2>
            <p className="mt-1 text-sm text-ink-300">
              This permanently deletes your account, chat history, exam history, and study progress. This can't be undone.
            </p>

            {!confirmOpen ? (
              <Button variant="danger" size="sm" className="mt-4" onClick={() => setConfirmOpen(true)}>
                Delete my account
              </Button>
            ) : (
              <div className="mt-4 space-y-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                <p className="flex items-start gap-2 text-sm text-rose-300">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                  Type <strong className="font-mono">DELETE</strong> to confirm. This is irreversible.
                </p>
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono tracking-widest"
                  autoFocus
                />
                {error && <div className="v2-alert v2-alert-error">{error}</div>}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setConfirmOpen(false); setConfirmText(''); setError('') }}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={deleting}
                    disabled={confirmText.trim() !== 'DELETE'}
                    onClick={() => void onDelete()}
                  >
                    Permanently delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </PageLayout>
  )
}
