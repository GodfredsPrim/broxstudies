import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Plus, AlertTriangle, Paperclip, X, FileText, FileImage, File } from 'lucide-react'
import { tutorApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useGuestChats } from '@/hooks/useGuestChats'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { MathText } from '@/components/MathText'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 24 * 1024 * 1024
const ACCEPT = 'image/*,application/pdf,.docx,.txt,.md'

interface Attachment {
  name: string
  mime: string
}

interface Msg {
  id: string
  role: 'user' | 'ai'
  content: string
  error?: boolean
  attachments?: Attachment[]
}

function formatBytes(n: number) {
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <FileImage size={12} className="shrink-0" />
  if (mime === 'application/pdf') return <FileText size={12} className="shrink-0" />
  return <File size={12} className="shrink-0" />
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

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setPendingFiles([])
    setFileError('')
  }

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    const next = [...pendingFiles, ...arr]
    const totalSize = next.reduce((s, f) => s + f.size, 0)
    for (const f of arr) {
      if (f.size > MAX_FILE_BYTES) {
        setFileError(`"${f.name}" is too large (max 8 MB per file).`)
        return
      }
    }
    if (totalSize > MAX_TOTAL_BYTES) {
      setFileError('Total attachment size exceeds 24 MB.')
      return
    }
    setFileError('')
    setPendingFiles(next)
  }

  const removeFile = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
    setFileError('')
  }

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if ((!text && pendingFiles.length === 0) || loading) return
    if (!isAuth) {
      const ok = guest.consume()
      if (!ok) {
        setError('')
        return
      }
    }

    const attachments: Attachment[] = pendingFiles.map(f => ({ name: f.name, mime: f.type || 'application/octet-stream' }))
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      attachments: attachments.length > 0 ? attachments : undefined,
    }
    const history = messages
      .slice(-6)
      .map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setError('')
    const sentFiles = pendingFiles
    setPendingFiles([])
    setFileError('')
    setLoading(true)

    try {
      let res
      if (sentFiles.length > 0) {
        res = await tutorApi.askWithFiles({ question: text, files: sentFiles, history })
      } else {
        res = await tutorApi.ask({ question: text, history })
      }
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

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.files
    if (items.length > 0) {
      e.preventDefault()
      addFiles(items)
    }
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const onDragLeave = () => setIsDragging(false)
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
  }

  const empty = messages.length === 0
  const outOfChats = !isAuth && guest.remaining <= 0
  const canSend = (input.trim().length > 0 || pendingFiles.length > 0) && !outOfChats && !loading

  return (
    <div
      className="flex h-[calc(100dvh-3.5rem)] flex-col"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag-over overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="rounded-3xl border-2 border-dashed border-emerald-400 bg-emerald-500/10 px-12 py-8 text-center backdrop-blur-sm">
            <Paperclip size={28} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-300">Drop files to attach</p>
          </div>
        </div>
      )}

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
              disabled={empty && pendingFiles.length === 0}
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

          {/* Pending file chips */}
          {pendingFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {pendingFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2.5 py-1 text-[12px] text-emerald-700 dark:border-emerald-700/40 dark:text-emerald-300"
                >
                  <AttachmentIcon mime={f.type} />
                  <span className="max-w-[120px] truncate font-medium">{f.name}</span>
                  <span className="text-emerald-500/70 dark:text-emerald-500">({formatBytes(f.size)})</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-rose-500/20 hover:text-rose-500"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {fileError && (
            <div className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[12px] text-rose-700 dark:text-rose-300">
              {fileError}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex items-end gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
            />

            {/* Paperclip button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={outOfChats || loading}
              title="Attach image, PDF, DOCX, or TXT"
              className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] text-[var(--fg-2)] transition hover:border-emerald-400 hover:text-emerald-500 disabled:pointer-events-none disabled:opacity-40"
            >
              <Paperclip size={18} />
            </button>

            <div className="v2-input flex min-h-[52px] flex-1 items-end gap-2 !h-auto !py-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                placeholder={
                  outOfChats
                    ? 'Sign up to continue studying…'
                    : pendingFiles.length > 0
                      ? 'Add a question about the attached file(s)…'
                      : 'Ask anything — or attach a photo/PDF to solve it step by step.'
                }
                disabled={outOfChats || loading}
                rows={1}
                className="flex-1 resize-none border-0 bg-transparent p-0 text-[14.5px] font-medium text-[var(--fg-0)] placeholder:text-[var(--fg-3)] focus:outline-none disabled:opacity-60"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!canSend}
              leading={<Send size={14} />}
              className="shrink-0 !h-[52px]"
            >
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--fg-3)]">
            <span>
              <kbd className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>{' '}
              to send · <kbd className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[10px]">Shift+Enter</kbd>{' '}
              new line · 📎 paste or drag files
            </span>
            <span className="hidden sm:inline text-[var(--fg-2)]">Tip: attach a photo of a question for step-by-step help</span>
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
          Tuned for WASSCE. Add{' '}
          <em className="not-italic font-semibold text-emerald-600 dark:text-emerald-300">"step by step"</em> or{' '}
          <em className="not-italic font-semibold text-emerald-600 dark:text-emerald-300">"in detail"</em> for full working.{' '}
          Tap <Paperclip size={13} className="inline -mt-0.5" /> to attach a photo, PDF, or notes.
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
        {/* Attachment chips (user messages only) */}
        {isUser && msg.attachments && msg.attachments.length > 0 && (
          <div className={cn('mb-1.5 flex flex-wrap gap-1', isUser && 'justify-end')}>
            {msg.attachments.map((a, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:border-emerald-700/40 dark:text-emerald-300"
              >
                <AttachmentIcon mime={a.mime} />
                <span className="max-w-[100px] truncate">{a.name}</span>
              </span>
            ))}
          </div>
        )}
        {msg.content && (
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
            <MathText>{msg.content}</MathText>
          </div>
        )}
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
