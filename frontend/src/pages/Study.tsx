import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Plus, AlertTriangle } from 'lucide-react'
import { tutorApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useGuestChats } from '@/hooks/useGuestChats'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'

interface Msg {
  id: string
  role: 'user' | 'ai'
  content: string
  error?: boolean
}

export function StudyPage() {
  const { user } = useAuth()
  const { selectedTrack, loading: trackLoading } = useAcademicTrack()
  const guest = useGuestChats()
  const isAuth = Boolean(user)

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isAuth) return
    tutorApi.history(20)
      .then(data => {
        const msgs = (data.messages || [])
          .slice(-12)
          .map((m, i): Msg => ({
            id: `h-${m.id ?? i}`,
            role: (m.role === 'user' ? 'user' : 'ai'),
            content: m.content,
          }))
        if (msgs.length > 0) setMessages(msgs)
      })
      .catch(() => {})
  }, [isAuth])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [input])

  if (!trackLoading && !selectedTrack) {
    return <Navigate to="/select-track" replace />
  }

  const resetChat = () => {
    setMessages([])
    setInput('')
    setError('')
  }

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || loading) return
    if (!isAuth) {
      const ok = guest.consume()
      if (!ok) {
        setError('')
        return
      }
    }

    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', content: text }
    const history = messages
      .slice(-6)
      .map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setError('')
    setLoading(true)

    try {
      const res = await tutorApi.ask({
        question: text,
        history,
      })
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'ai',
        content: res.explanation,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: 'ai',
        content: extractError(err, 'Something went wrong. Please try again.'),
        error: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const empty = messages.length === 0
  const outOfChats = !isAuth && guest.remaining <= 0

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Study sub-header */}
      <div className="border-b border-[var(--line)] bg-[var(--bg-0)]/40 px-4 py-4 backdrop-blur-sm sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="v2-dot" />
            <Eyebrow>Study with AI</Eyebrow>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            {!isAuth && (
              <Badge tone="accent">
                <Sparkles size={10} /> {guest.remaining}/{guest.limit} free
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={resetChat}
              leading={<Plus size={13} />}
              disabled={empty}
            >
              New chat
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          {empty ? (
            <EmptyChat />
          ) : (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {messages.map(m => (
                  <MessageBubble key={m.id} msg={m} />
                ))}
              </AnimatePresence>
              {loading && <TypingBubble />}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--line)] bg-[var(--bg-0)]/70 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          {outOfChats && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-[13px] text-amber-700 dark:text-amber-200">
              <span className="flex items-center gap-2">
                <AlertTriangle size={14} />
                You've used your {guest.limit} free chats.
              </span>
              <Link to="/signup" className="v2-btn v2-btn-primary !h-8 !px-3 !text-[12px]">
                Sign up to continue
              </Link>
            </div>
          )}

          {error && !outOfChats && (
            <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <div className="v2-input flex min-h-[52px] flex-1 items-end gap-2 !h-auto !py-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={outOfChats ? 'Sign up to continue studying…' : 'Ask anything — say "in detail" for a full explanation.'}
                disabled={outOfChats || loading}
                rows={1}
                className="flex-1 resize-none border-0 bg-transparent p-0 text-[14.5px] font-medium text-[var(--fg-0)] placeholder:text-[var(--fg-3)] focus:outline-none disabled:opacity-60"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!input.trim() || loading || outOfChats}
              leading={<Send size={14} />}
              className="shrink-0 !h-[52px]"
            >
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--fg-3)]">
            <span>
              Press <kbd className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>{' '}
              to send, <kbd className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[10px]">Shift + Enter</kbd>{' '}
              for new line
            </span>
            <span className="hidden sm:inline text-[var(--fg-2)]">Tip: add "in detail" for full working</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyChat() {
  return (
    <div className="py-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <div className="relative mx-auto mb-6 grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 shadow-glow-md">
          <div className="v2-mesh" style={{ inset: 0, filter: 'blur(8px)', opacity: 0.9 }} />
          <Sparkles size={22} className="relative text-[#02180F]" />
        </div>
        <h1 className="v2-display text-[44px] leading-[1.04] tracking-tighter text-[var(--fg-0)] sm:text-[54px]">
          Ask anything.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--fg-1)]">
          Tuned for WASSCE. Answers are brief by default — add <em className="not-italic font-semibold text-emerald-600 dark:text-emerald-300">"in detail"</em>, <em className="not-italic font-semibold text-emerald-600 dark:text-emerald-300">"step by step"</em>, or <em className="not-italic font-semibold text-emerald-600 dark:text-emerald-300">"explain fully"</em> when you need the long version.
        </p>
      </motion.div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      <div
        className={cn(
          'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold',
          isUser
            ? 'bg-[var(--bg-2)] text-[var(--fg-0)] ring-1 ring-[var(--line)]'
            : 'bg-gradient-to-br from-emerald-400 to-emerald-700 text-[#02180F]',
        )}
      >
        {isUser ? 'You' : 'Bx'}
      </div>
      <div className={cn('min-w-0 max-w-[85%]', isUser && 'text-right')}>
        <div
          className={cn(
            'inline-block whitespace-pre-wrap rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed text-left',
            isUser
              ? 'bg-[var(--bg-2)] text-[var(--fg-0)]'
              : msg.error
                ? 'border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200'
                : 'v2-card !p-4 text-[var(--fg-0)]',
          )}
        >
          {msg.content}
        </div>
      </div>
    </motion.div>
  )
}

function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-700 text-[11px] font-bold text-[#02180F]">
        Bx
      </div>
      <div className="v2-card flex items-center gap-1.5 !p-4">
        <Dot delay={0} />
        <Dot delay={0.15} />
        <Dot delay={0.3} />
      </div>
    </motion.div>
  )
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="block h-1.5 w-1.5 rounded-full bg-emerald-500"
      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
      transition={{ duration: 1, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  )
}
