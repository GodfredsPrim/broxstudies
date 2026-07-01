import { motion } from 'framer-motion'
import { Sparkles, FileImage, FileText, File, Paperclip } from 'lucide-react'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'
import { SuggestedPrompts } from '@/components/chat/SuggestedPrompts'
import { cn } from '@/lib/cn'

export interface ChatAttachment {
  name: string
  mime: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  error?: boolean
  attachments?: ChatAttachment[]
}

function AttachmentIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <FileImage size={12} className="shrink-0" />
  if (mime === 'application/pdf') return <FileText size={12} className="shrink-0" />
  return <File size={12} className="shrink-0" />
}

export function EmptyChat({ onPromptSelect, disabled }: { onPromptSelect?: (p: string) => void; disabled?: boolean }) {
  return (
    <div className="py-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <div className="relative mx-auto mb-6 grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-glow-md">
          <Sparkles size={24} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          What would you like to <span className="gradient-text">learn today?</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Your AI tutor is tuned for Ghana's SHS & TVET curriculum. Ask anything, attach photos or PDFs, and get step-by-step explanations.
        </p>
      </motion.div>
      {onPromptSelect && <SuggestedPrompts onSelect={onPromptSelect} disabled={disabled} />}
    </div>
  )
}

export function MessageBubble({ msg }: { msg: ChatMessage }) {
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
          'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[10px] font-bold',
          isUser
            ? 'bg-[var(--bg-2)] text-foreground ring-1 ring-border'
            : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white',
        )}
      >
        {isUser ? 'You' : <Sparkles size={14} />}
      </div>
      <div className={cn('min-w-0 max-w-[85%]', isUser && 'text-right')}>
        {isUser && msg.attachments && msg.attachments.length > 0 && (
          <div className={cn('mb-1.5 flex flex-wrap gap-1', isUser && 'justify-end')}>
            {msg.attachments.map((a, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300"
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
              'inline-block rounded-2xl px-4 py-3 text-left',
              isUser
                ? 'bg-indigo-500/15 text-foreground border border-indigo-500/20'
                : msg.error
                  ? 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
                  : 'border border-border bg-card text-foreground shadow-sm',
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{msg.content}</p>
            ) : (
              <MarkdownMessage content={msg.content} />
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function TypingBubble() {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
        <Sparkles size={14} className="text-white" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-3">
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
      className="block h-1.5 w-1.5 rounded-full bg-indigo-400"
      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
      transition={{ duration: 1, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  )
}

export function DragOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="rounded-3xl border-2 border-dashed border-indigo-400 bg-indigo-500/10 px-12 py-8 text-center backdrop-blur-sm">
        <Paperclip size={28} className="mx-auto mb-2 text-indigo-400" />
        <p className="text-sm font-semibold text-indigo-300">Drop files to attach</p>
      </div>
    </div>
  )
}

export { AttachmentIcon }
