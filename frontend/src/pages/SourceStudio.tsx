import { useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BookOpen, FileText, HelpCircle, Layers3, ListChecks, Paperclip, Sparkles, X } from 'lucide-react'
import { tutorApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { useGamification } from '@/hooks/useGamification'
import { Button } from '@/components/ui/button'
import { AttachmentIcon, MessageBubble } from '@/components/chat/ChatComponents'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 24 * 1024 * 1024
const ACCEPT = 'image/*,application/pdf,.docx,.txt,.md'

const TOOLS = [
  { id: 'overview', label: 'Study guide', description: 'Summary, key ideas and a revision plan', icon: BookOpen, prompt: 'Create a complete study guide using only the attached sources. Include a concise overview, key concepts with clear explanations, important facts or formulas, likely misconceptions, and a practical revision plan. Cite the source filename or section whenever possible. Do not invent information that is not in the sources.' },
  { id: 'flashcards', label: 'Flashcards', description: 'Recall cards from the most important ideas', icon: Layers3, prompt: 'Create 15 high-quality flashcards using only the attached sources. Format every card as **Card N** followed by **Front:** and **Back:**. Cover definitions, concepts, relationships, formulas and examples. Keep each back concise and cite the relevant source filename when possible.' },
  { id: 'quiz', label: 'Quiz', description: 'Test understanding with answers below', icon: ListChecks, prompt: 'Create a 10-question quiz using only the attached sources. Mix multiple choice, true or false, and short-answer questions. Put all questions first, then a clearly separated answer key with explanations and source references. Include easy, medium and challenging questions.' },
  { id: 'faq', label: 'FAQ', description: 'Questions a learner is likely to ask', icon: HelpCircle, prompt: 'Create a learner-friendly FAQ using only the attached sources. Include 10 important questions with direct answers, clarify confusing ideas, and cite the relevant source filename or section whenever possible.' },
  { id: 'briefing', label: 'Briefing note', description: 'A compact, exam-ready source brief', icon: FileText, prompt: 'Create an exam-ready briefing note using only the attached sources. Organize it into main themes, supporting evidence, essential vocabulary, important examples, and five takeaways. Clearly flag anything the sources do not establish.' },
] as const

export function SourceStudioPage() {
  const { selectedTrack, loading: trackLoading } = useAcademicTrack()
  const { recordStudy, awardBadge } = useGamification()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState<string | null>(null)

  if (!trackLoading && !selectedTrack) return <Navigate to="/select-track" replace />

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const additions = Array.from(incoming)
    if (additions.some(file => file.size > MAX_FILE_BYTES)) {
      setError('Each source must be 8 MB or smaller.')
      return
    }
    const unique = [...files, ...additions].filter((file, index, all) =>
      all.findIndex(candidate => `${candidate.name}:${candidate.size}:${candidate.lastModified}` === `${file.name}:${file.size}:${file.lastModified}`) === index,
    )
    if (unique.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
      setError('Total source size cannot exceed 24 MB.')
      return
    }
    setFiles(unique)
    setError('')
  }

  const generate = async (tool: typeof TOOLS[number]) => {
    if (!files.length || generating) return
    setGenerating(tool.id)
    setResult('')
    setError('')
    try {
      const response = await tutorApi.askWithFiles({ question: tool.prompt, files })
      setResult(response.explanation)
      recordStudy(5)
      awardBadge('source-scholar')
    } catch (err) {
      setError(extractError(err, `Could not create the ${tool.label.toLowerCase()}. Please try again.`))
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-indigo-400"><Sparkles size={16} /><span className="v2-eyebrow">Grounded learning tools</span></div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--fg-0)] sm:text-3xl">Source Studio</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--fg-2)]">Upload notes, textbook pages, or handouts and turn them into study materials grounded in your sources.</p>
      </header>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6" aria-labelledby="sources-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="sources-title" className="font-semibold text-[var(--fg-0)]">Your sources</h2><p className="mt-1 text-xs text-[var(--fg-3)]">PDF, DOCX, TXT, Markdown, or images. Up to 8 MB each.</p></div>
          <Button variant="subtle" size="sm" leading={<Paperclip size={13} />} onClick={() => inputRef.current?.click()}>Add sources</Button>
          <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={event => { addFiles(event.target.files); event.target.value = '' }} />
        </div>
        {files.length ? <div className="mt-4 flex flex-wrap gap-2">{files.map((file, index) => <div key={`${file.name}-${file.lastModified}`} className="flex max-w-full items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg-0)] px-2.5 py-2 text-xs text-[var(--fg-1)]"><AttachmentIcon mime={file.type} /><span className="max-w-[220px] truncate font-medium">{file.name}</span><button className="rounded p-0.5 text-[var(--fg-3)] hover:text-rose-400" onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}><X size={12} /></button></div>)}</div> : <button onClick={() => inputRef.current?.click()} className="mt-4 w-full rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-0)] px-4 py-8 text-center transition hover:border-indigo-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"><span className="block text-sm font-semibold text-[var(--fg-1)]">Choose files to begin</span><span className="mt-1 block text-xs text-[var(--fg-3)]">You can combine multiple sources up to 24 MB.</span></button>}
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{TOOLS.map(tool => { const Icon = tool.icon; return <button key={tool.id} disabled={!files.length || Boolean(generating)} onClick={() => void generate(tool)} className="flex min-h-[76px] items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-0)] px-3 py-3 text-left transition hover:border-indigo-400/60 hover:bg-indigo-500/5 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-400"><Icon size={17} /></span><span><span className="block text-[13px] font-semibold text-[var(--fg-1)]">{generating === tool.id ? 'Creating...' : tool.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-[var(--fg-3)]">{tool.description}</span></span></button> })}</div>
      </section>

      {error && <div className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}
      {result && <section className="mt-7" aria-label="Generated study material"><MessageBubble msg={{ id: 'source-result', role: 'ai', content: result }} /></section>}
    </div>
  )
}
