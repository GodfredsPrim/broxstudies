import { useEffect, useState } from 'react'
import { MessageSquare, Pin, PinOff, Search, X } from 'lucide-react'
import { tutorApi } from '@/api/endpoints'
import { useAuth } from '@/hooks/useAuth'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/cn'

const PINNED_KEY = 'brox.chat.pinned'

interface HistoryMsg {
  id: number
  role: 'user' | 'ai'
  content: string
  created_at: string
}

interface ChatSidebarProps {
  open: boolean
  onClose: () => void
  onSelectPrompt: (text: string) => void
}

function loadPinned(): number[] {
  try {
    return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]')
  } catch {
    return []
  }
}

function savePinned(ids: number[]) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(ids))
}

export function ChatSidebar({ open, onClose, onSelectPrompt }: ChatSidebarProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<HistoryMsg[]>([])
  const [search, setSearch] = useState('')
  const [pinned, setPinned] = useState<number[]>(loadPinned)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    tutorApi.history(40)
      .then(data => setMessages((data.messages || []).filter(m => m.role === 'user')))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [user])

  const togglePin = (id: number) => {
    setPinned(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      savePinned(next)
      return next
    })
  }

  const filtered = messages.filter(m =>
    !search || m.content.toLowerCase().includes(search.toLowerCase()),
  )
  const pinnedMsgs = filtered.filter(m => pinned.includes(m.id))
  const otherMsgs = filtered.filter(m => !pinned.includes(m.id))

  const panel = (
    <aside
      className={cn(
        'flex w-72 shrink-0 flex-col border-r border-border bg-[var(--bg-1)]',
        open ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'hidden',
      )}
      aria-label="Chat history"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare size={16} className="text-indigo-400" />
          Conversations
        </div>
        {open && (
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted" aria-label="Close sidebar">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search chats…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-[var(--bg-2)] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        {!user ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">Sign in to save and search chat history.</p>
        ) : loading ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">Loading history…</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">No conversations yet. Start chatting!</p>
        ) : (
          <div className="space-y-4 pb-4">
            {pinnedMsgs.length > 0 && (
              <section>
                <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pinned</p>
                {pinnedMsgs.map(m => (
                  <ChatHistoryItem key={m.id} msg={m} pinned onTogglePin={() => togglePin(m.id)} onSelect={() => onSelectPrompt(m.content)} />
                ))}
              </section>
            )}
            {otherMsgs.length > 0 && (
              <section>
                {pinnedMsgs.length > 0 && (
                  <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recent</p>
                )}
                {otherMsgs.map(m => (
                  <ChatHistoryItem key={m.id} msg={m} pinned={false} onTogglePin={() => togglePin(m.id)} onSelect={() => onSelectPrompt(m.content)} />
                ))}
              </section>
            )}
          </div>
        )}
      </ScrollArea>
    </aside>
  )

  if (!open) return panel

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      {panel}
    </>
  )
}

function ChatHistoryItem({
  msg,
  pinned,
  onTogglePin,
  onSelect,
}: {
  msg: HistoryMsg
  pinned: boolean
  onTogglePin: () => void
  onSelect: () => void
}) {
  return (
    <div className="group flex items-start gap-1 rounded-xl hover:bg-muted/50">
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 px-2 py-2.5 text-left text-xs leading-snug text-foreground"
      >
        <span className="line-clamp-2">{msg.content}</span>
        <span className="mt-1 block text-[10px] text-muted-foreground">
          {new Date(msg.created_at).toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })}
        </span>
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        className="mt-2 shrink-0 p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-indigo-400"
        aria-label={pinned ? 'Unpin' : 'Pin'}
      >
        {pinned ? <PinOff size={12} /> : <Pin size={12} />}
      </button>
    </div>
  )
}
