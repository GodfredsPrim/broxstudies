import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Send, Plus, AlertTriangle, Paperclip, X, PanelLeft, Mic, MicOff } from 'lucide-react'
import { tutorApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useGuestChats } from '@/hooks/useGuestChats'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { useGamification } from '@/hooks/useGamification'
import { Button } from '@/components/ui/button'
import {
  EmptyChat, MessageBubble, TypingBubble, DragOverlay, AttachmentIcon,
  type ChatMessage, type ChatAttachment,
} from '@/components/chat/ChatComponents'
import { ChatSidebar } from '@/components/chat/ChatSidebar'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 24 * 1024 * 1024
const ACCEPT = 'image/*,application/pdf,.docx,.txt,.md'

interface Attachment extends ChatAttachment {}

type Msg = ChatMessage

function formatBytes(n: number) {
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function StudyPage() {
  const { user } = useAuth()
  const { selectedTrack, loading: trackLoading } = useAcademicTrack()
  const guest = useGuestChats()
  const { recordStudy, awardBadge } = useGamification()
  const isAuth = Boolean(user)

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [streamingLive, setStreamingLive] = useState(false)
  const [listening, setListening] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

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
    setStreamingId(null)
    setStreamingLive(false)
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
        setError(`You've used all ${guest.limit} free chats. Sign up to continue.`)
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
      if (sentFiles.length > 0) {
        const res = await tutorApi.askWithFiles({ question: text, files: sentFiles, history })
        const aiId = `a-${Date.now()}`
        setMessages(prev => [...prev, {
          id: aiId,
          role: 'ai',
          content: res.explanation,
        }])
        setStreamingId(aiId)
        setStreamingLive(false)
      } else {
        const aiId = `a-${Date.now()}`
        setMessages(prev => [...prev, { id: aiId, role: 'ai', content: '' }])
        setStreamingId(aiId)
        setStreamingLive(true)

        await tutorApi.askStream(
          { question: text, history },
          event => {
            if (event.error) {
              setMessages(prev => prev.map(m =>
                m.id === aiId ? { ...m, content: event.error!, error: true } : m,
              ))
              setStreamingLive(false)
              return
            }
            if (event.token) {
              setMessages(prev => prev.map(m =>
                m.id === aiId ? { ...m, content: m.content + event.token } : m,
              ))
            }
            if (event.done && event.explanation) {
              setMessages(prev => prev.map(m =>
                m.id === aiId ? { ...m, content: event.explanation! } : m,
              ))
              setStreamingLive(false)
            }
          },
        )
      }
      recordStudy(3)
      if (messages.length === 0) awardBadge('first-chat')
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: 'ai',
        content: extractError(err, 'Something went wrong. Please try again.'),
        error: true,
      }])
    } finally {
      setLoading(false)
      setStreamingLive(false)
    }
  }

  const toggleVoice = () => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setError('Voice input is not supported in this browser.')
      return
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      setListening(false)
      return
    }
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-GH'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript?.trim()
      if (transcript) setInput(prev => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
    setError('')
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
      className="flex h-full min-h-0 flex-1"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectPrompt={text => { void send(text); setSidebarOpen(false) }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {isDragging && <DragOverlay />}

      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-y-auto" role="log" aria-live="polite" aria-relevant="additions">
        <div className="absolute left-4 top-4 z-10 flex gap-2 sm:left-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(v => !v)}
            leading={<PanelLeft size={13} />}
            aria-label="Toggle chat history"
          >
            <span className="hidden sm:inline">History</span>
          </Button>
        </div>
        <div className="absolute right-4 top-4 z-10 sm:right-6">
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
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
          {empty ? (
            <EmptyChat onPromptSelect={text => void send(text)} disabled={outOfChats || loading} />
          ) : (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {messages.map(m => (
                  <MessageBubble
                    key={m.id}
                    msg={m}
                    streaming={m.id === streamingId && m.role === 'ai'}
                    streamingLive={m.id === streamingId && streamingLive}
                  />
                ))}
              </AnimatePresence>
              {loading && !streamingLive && <TypingBubble />}
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
                  className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[12px] text-indigo-300"
                >
                  <AttachmentIcon mime={f.type} />
                  <span className="max-w-[120px] truncate font-medium">{f.name}</span>
                  <span className="text-indigo-400/70">({formatBytes(f.size)})</span>
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
              onClick={toggleVoice}
              disabled={outOfChats || loading}
              title={listening ? 'Stop voice input' : 'Speak your question'}
              className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl border transition disabled:pointer-events-none disabled:opacity-40 ${
                listening
                  ? 'border-rose-400/50 bg-rose-500/10 text-rose-400'
                  : 'border-border bg-card text-muted-foreground hover:border-indigo-400 hover:text-indigo-400'
              }`}
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={outOfChats || loading}
              title="Attach image, PDF, DOCX, or TXT"
              className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl border border-border bg-card text-muted-foreground transition hover:border-indigo-400 hover:text-indigo-400 disabled:pointer-events-none disabled:opacity-40"
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
              new line · 🎤 voice · 📎 paste or drag files
            </span>
            <span className="hidden sm:inline text-[var(--fg-2)]">Tip: attach a photo of a question for step-by-step help</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
