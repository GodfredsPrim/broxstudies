import { useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BookOpen, CheckCircle2, FileText, HelpCircle, Layers3, ListChecks, Paperclip, RotateCcw, Sparkles, X, XCircle } from 'lucide-react'
import { learningApi, tutorApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { useGamification } from '@/hooks/useGamification'
import { Button } from '@/components/ui/button'
import { AttachmentIcon, MessageBubble } from '@/components/chat/ChatComponents'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 24 * 1024 * 1024
const ACCEPT = 'image/*,application/pdf,.docx,.txt,.md'

type ToolId = 'overview' | 'flashcards' | 'quiz' | 'faq' | 'briefing'
type Flashcard = { front: string; back: string; source?: string }
type QuizQuestion = { question: string; options: string[]; answer: number; explanation: string; source?: string }
type StructuredResult = { kind: 'flashcards'; cards: Flashcard[] } | { kind: 'quiz'; questions: QuizQuestion[] }

const TOOLS: Array<{ id: ToolId; label: string; description: string; icon: typeof BookOpen; prompt: string }> = [
  { id: 'overview', label: 'Study guide', description: 'A clear, source-grounded revision guide', icon: BookOpen, prompt: 'Create a complete study guide using only the attached sources. Include key concepts, explanations, facts or formulas, misconceptions, and a practical revision plan. Cite filenames. Clearly state when the sources do not establish something.' },
  { id: 'flashcards', label: 'Flashcards', description: 'Flip and master the essential ideas', icon: Layers3, prompt: 'Using only the attached sources, return ONLY valid JSON with this exact shape: {"kind":"flashcards","cards":[{"front":"question or concept","back":"concise answer","source":"filename or section"}]}. Create 12 accurate cards that cover definitions, relationships, formulas, examples and application. Do not use markdown fences and do not invent facts.' },
  { id: 'quiz', label: 'Practice quiz', description: 'Answer, submit, and receive a score', icon: ListChecks, prompt: 'Using only the attached sources, return ONLY valid JSON with this exact shape: {"kind":"quiz","questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"why the answer follows from the source","source":"filename or section"}]}. Create 10 distinct multiple-choice questions with exactly four options each. answer must be the zero-based index of the correct option. Include easy, medium and challenging application questions. Do not use markdown fences and do not invent facts.' },
  { id: 'faq', label: 'Source FAQ', description: 'Direct answers to likely questions', icon: HelpCircle, prompt: 'Create a learner-friendly FAQ using only the attached sources. Include 10 important questions with direct answers, clarify confusing ideas, and cite the source filename or section.' },
  { id: 'briefing', label: 'Exam brief', description: 'A compact, exam-ready briefing', icon: FileText, prompt: 'Create an exam-ready briefing note using only the attached sources. Organize it into main themes, evidence, vocabulary, examples, and five takeaways. Clearly flag anything the sources do not establish.' },
]

function parseStructured(text: string): StructuredResult | null {
  try {
    const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const value = JSON.parse(clean) as StructuredResult
    if (value.kind === 'flashcards' && Array.isArray(value.cards)) return value
    if (value.kind === 'quiz' && Array.isArray(value.questions)) return value
  } catch { /* A readable fallback is rendered below. */ }
  return null
}

function Flashcards({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const card = cards[index]
  if (!card) return null
  return <section className="mt-7" aria-label="Interactive flashcards"><div className="mb-3 flex items-center justify-between text-xs text-[var(--fg-3)]"><span>Card {index + 1} of {cards.length}</span><span>Tap the card to reveal the answer</span></div><button onClick={() => setFlipped(value => !value)} className={`flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border p-8 text-center transition duration-300 ${flipped ? 'border-[var(--accent)] bg-[var(--accent-tint)]' : 'border-[var(--line-strong)] bg-[var(--bg-1)] shadow-[0_18px_50px_-36px_rgba(20,37,63,.45)]'}`}><span className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--fg-3)]">{flipped ? 'Answer' : 'Question'}</span><span className="max-w-2xl text-xl font-semibold leading-8 text-[var(--fg-0)]">{flipped ? card.back : card.front}</span>{flipped && card.source && <span className="mt-5 text-xs text-[var(--fg-2)]">Source: {card.source}</span>}</button><div className="mt-4 flex justify-between"><Button variant="ghost" disabled={index === 0} onClick={() => { setIndex(i => i - 1); setFlipped(false) }}>Previous</Button><Button onClick={() => { setIndex(i => Math.min(cards.length - 1, i + 1)); setFlipped(false) }} disabled={index === cards.length - 1}>Next card</Button></div></section>
}

function PracticeQuiz({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const score = useMemo(() => questions.reduce((total, q, index) => total + (answers[index] === q.answer ? 1 : 0), 0), [answers, questions])
  return <section className="mt-7 space-y-4" aria-label="Source practice quiz"><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-[var(--fg-0)]">Practice quiz</h2>{submitted && <span className="rounded-lg bg-[var(--primary-tint)] px-3 py-1.5 text-sm font-bold text-[var(--primary-strong)]">{score}/{questions.length} correct</span>}</div>{questions.map((q, index) => <article key={index} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-5"><p className="font-semibold leading-6 text-[var(--fg-0)]"><span className="mr-2 text-[var(--fg-3)]">{index + 1}.</span>{q.question}</p><div className="mt-3 grid gap-2">{q.options.map((option, optionIndex) => { const selected = answers[index] === optionIndex; const correct = submitted && q.answer === optionIndex; const wrong = submitted && selected && !correct; return <button key={optionIndex} disabled={submitted} onClick={() => setAnswers(current => ({ ...current, [index]: optionIndex }))} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${correct ? 'border-[var(--success)] bg-[var(--success-tint)] text-[var(--fg-0)]' : wrong ? 'border-[var(--danger)] bg-[var(--danger-tint)] text-[var(--fg-0)]' : selected ? 'border-[var(--primary)] bg-[var(--primary-tint)] text-[var(--fg-0)]' : 'border-[var(--line)] text-[var(--fg-1)] hover:border-[var(--line-strong)]'}`}>{correct ? <CheckCircle2 size={16} className="text-[var(--success)]" /> : wrong ? <XCircle size={16} className="text-[var(--danger)]" /> : <span className="grid h-5 w-5 place-items-center rounded-full border border-[var(--line-strong)] text-[10px]">{String.fromCharCode(65 + optionIndex)}</span>}<span>{option}</span></button>})}</div>{submitted && <p className="mt-3 text-sm leading-6 text-[var(--fg-2)]"><strong className="text-[var(--fg-1)]">Why:</strong> {q.explanation}{q.source && <> <span className="text-[var(--fg-3)]">Source: {q.source}</span></>}</p>}</article>)}<div className="flex justify-end">{submitted ? <Button variant="subtle" leading={<RotateCcw size={13} />} onClick={() => { setAnswers({}); setSubmitted(false) }}>Try again</Button> : <Button disabled={Object.keys(answers).length !== questions.length} onClick={() => setSubmitted(true)}>Mark my answers</Button>}</div></section>
}

export function SourceStudioPage() {
  const { selectedTrack, loading: trackLoading } = useAcademicTrack()
  const { recordStudy, awardBadge } = useGamification()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState<ToolId | null>(null)
  if (!trackLoading && !selectedTrack) return <Navigate to="/select-track" replace />

  const addFiles = (incoming: FileList | null) => { if (!incoming) return; const additions = Array.from(incoming); if (additions.some(file => file.size > MAX_FILE_BYTES)) return setError('Each source must be 8 MB or smaller.'); const unique = [...files, ...additions].filter((file, index, all) => all.findIndex(item => `${item.name}:${item.size}:${item.lastModified}` === `${file.name}:${file.size}:${file.lastModified}`) === index); if (unique.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) return setError('Total source size cannot exceed 24 MB.'); setFiles(unique); setError('') }
  const generate = async (tool: typeof TOOLS[number]) => { if (!files.length || generating) return; setGenerating(tool.id); setResult(''); setError(''); try { const response = await tutorApi.askWithFiles({ question: tool.prompt, files, persistHistory: false }); setResult(response.explanation); const parsed = parseStructured(response.explanation); if (parsed?.kind === 'flashcards') await learningApi.saveReviewCards({ subject: files[0]?.name || 'Source Studio', cards: parsed.cards }); recordStudy(5); awardBadge('source-scholar') } catch (err) { setError(extractError(err, `Could not create the ${tool.label.toLowerCase()}. Please try again.`)) } finally { setGenerating(null) } }
  const structured = result ? parseStructured(result) : null

  return <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-9"><header className="mb-6"><div className="mb-2 flex items-center gap-2 text-[var(--primary-strong)]"><Sparkles size={16} /><span className="v2-eyebrow">Learn from your own material</span></div><h1 className="text-2xl font-bold tracking-tight text-[var(--fg-0)] sm:text-3xl">Source Studio</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--fg-2)]">Turn uploaded notes and textbooks into accurate, interactive learning activities. Every answer stays grounded in your files.</p></header><section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 shadow-[0_18px_50px_-40px_rgba(20,37,63,.5)] sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-[var(--fg-0)]">1. Add your sources</h2><p className="mt-1 text-xs text-[var(--fg-3)]">PDF, DOCX, TXT, Markdown, or images. Up to 8 MB each.</p></div><Button variant="subtle" size="sm" leading={<Paperclip size={13} />} onClick={() => inputRef.current?.click()}>Add sources</Button><input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={event => { addFiles(event.target.files); event.target.value = '' }} /></div>{files.length ? <div className="mt-4 flex flex-wrap gap-2">{files.map((file, index) => <div key={`${file.name}-${file.lastModified}`} className="flex max-w-full items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg-0)] px-2.5 py-2 text-xs text-[var(--fg-1)]"><AttachmentIcon mime={file.type} /><span className="max-w-[220px] truncate font-medium">{file.name}</span><button onClick={() => setFiles(current => current.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}><X size={12} /></button></div>)}</div> : <button onClick={() => inputRef.current?.click()} className="mt-4 w-full rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--bg-0)] px-4 py-7 text-center hover:border-[var(--primary)]"><span className="block text-sm font-semibold text-[var(--fg-1)]">Choose files to begin</span><span className="mt-1 block text-xs text-[var(--fg-3)]">Combine multiple sources up to 24 MB.</span></button>}<h2 className="mb-3 mt-6 font-semibold text-[var(--fg-0)]">2. Choose a learning activity</h2><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{TOOLS.map(tool => { const Icon = tool.icon; return <button key={tool.id} disabled={!files.length || Boolean(generating)} onClick={() => void generate(tool)} className="flex min-h-[78px] items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-0)] px-3 py-3 text-left transition hover:border-[var(--primary)] active:translate-y-px disabled:opacity-45"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--primary-tint)] text-[var(--primary-strong)]"><Icon size={17} /></span><span><span className="block text-[13px] font-semibold text-[var(--fg-1)]">{generating === tool.id ? 'Creating from your files...' : tool.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-[var(--fg-3)]">{tool.description}</span></span></button> })}</div></section>{error && <div className="mt-5 rounded-lg border border-[var(--danger)] bg-[var(--danger-tint)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}{structured?.kind === 'flashcards' ? <Flashcards cards={structured.cards} /> : structured?.kind === 'quiz' ? <PracticeQuiz questions={structured.questions} /> : result ? <section className="mt-7"><MessageBubble msg={{ id: 'source-result', role: 'ai', content: result }} /></section> : null}</div>
}
