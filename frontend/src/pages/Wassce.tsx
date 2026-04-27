import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Loader2, TrendingUp, AlertTriangle, Trophy, CheckCircle2,
  XCircle, RotateCcw, Shield, Clock, ChevronRight,
  Maximize2,
} from 'lucide-react'
import { questionsApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import type { Question, Subject } from '@/api/types'

const YEARS = ['Year 1', 'Year 2', 'Year 3']

type Phase = 'setup' | 'generating' | 'exam' | 'results'

interface MarkResult {
  index: number
  is_correct: boolean
  score: number
  feedback: string
  expected_answer: string
}

/* ── Paper accent colours (inline styles to avoid Tailwind purge) ── */
const PAPER = {
  paper_1: {
    label: 'Paper 1',
    subtitle: 'Objective Test (MCQ)',
    hex: '#2563EB',
    light: '#EFF6FF',
    border: '#BFDBFE',
    badge: '#1D4ED8',
  },
  paper_2: {
    label: 'Paper 2',
    subtitle: 'Theory / Essay',
    hex: '#7C3AED',
    light: '#F5F3FF',
    border: '#DDD6FE',
    badge: '#6D28D9',
  },
  paper_3: {
    label: 'Paper 3',
    subtitle: 'Practical / Alternative',
    hex: '#B45309',
    light: '#FFFBEB',
    border: '#FDE68A',
    badge: '#92400E',
  },
} as const

type PaperKey = keyof typeof PAPER

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function WassceePage() {
  const [phase, setPhase] = useState<Phase>('setup')

  /* setup */
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedName, setSelectedName] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [setupError, setSetupError] = useState('')

  /* exam */
  const [organizedPapers, setOrganizedPapers] = useState<Partial<Record<PaperKey, Question[]>>>({})
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [activePaper, setActivePaper] = useState<PaperKey>('paper_1')
  const [elapsed, setElapsed] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [fsWarning, setFsWarning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  /* results */
  const [score, setScore] = useState(0)
  const [percentage, setPercentage] = useState(0)
  const [markResults, setMarkResults] = useState<MarkResult[]>([])
  const { selectedTrack } = useAcademicTrack()
  const curriculumName = selectedTrack === 'tvet' ? 'NAPTEX' : 'WASSCE'
  const likelyLabel = selectedTrack === 'tvet' ? 'Likely NAPTEX Questions' : 'Likely WASSCE Questions'
  const examLabel = selectedTrack === 'tvet' ? 'NAPTEX Exam Simulation' : 'WASSCE Exam Simulation'

  /* load subjects */
  useEffect(() => {
    questionsApi.subjects()
      .then(res => {
        const list = res.subjects
        setSubjects(list)
        if (list.length) {
          setSelectedName(list[0].name)
          setSelectedYear(YEARS[0])
        }
      })
      .catch(() => setSetupError('Unable to load subjects. Please refresh.'))
  }, [])

  /* elapsed timer */
  useEffect(() => {
    if (phase !== 'exam') return
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(id)
  }, [phase, startTime])

  /* block tab close during exam */
  useEffect(() => {
    if (phase !== 'exam') return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [phase])

  /* detect fullscreen exit and warn */
  useEffect(() => {
    if (phase !== 'exam') return
    const handler = () => setFsWarning(!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [phase])

  const uniqueNames = useMemo(() => [...new Set(subjects.map(s => s.name))].sort(), [subjects])

  // All three years are always selectable — backend handles any year key
  const availableYears = YEARS

  // Find any catalog entry for this subject name to extract its slug
  const subjectEntry = useMemo(
    () => subjects.find(s => s.name === selectedName),
    [subjects, selectedName],
  )

  // Construct the subject ID for the chosen year: e.g. "year_3:mathematics"
  const subjectId = useMemo(() => {
    if (!subjectEntry || !selectedYear) return null
    const slug = subjectEntry.id.includes(':') ? subjectEntry.id.split(':')[1] : subjectEntry.id
    const yearKey = selectedYear.toLowerCase().replace(' ', '_')
    return `${yearKey}:${slug}`
  }, [subjectEntry, selectedYear])

  const handleNameChange = (name: string) => {
    setSelectedName(name)
  }

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault()
    if (!subjectId) return
    setSetupError('')
    setPhase('generating')
    try {
      const result = await questionsApi.generateProfessional(subjectId, selectedYear)
      if (!result.questions.length) {
        setSetupError('No questions were generated. Try a different subject.')
        setPhase('setup')
        return
      }
      const organized = (result.organized_papers || {}) as Partial<Record<PaperKey, Question[]>>
      /* fallback: all questions → paper_1 */
      if (!Object.keys(organized).length) organized.paper_1 = result.questions

      setOrganizedPapers(organized)
      setAllQuestions(result.questions)
      setAnswers({})
      const firstPaper = (Object.keys(organized)[0] as PaperKey) || 'paper_1'
      setActivePaper(firstPaper)
      setStartTime(Date.now())
      setElapsed(0)
      setFsWarning(false)
      setPhase('exam')
      /* request fullscreen after render */
      setTimeout(() => overlayRef.current?.requestFullscreen?.().catch(() => {}), 120)
    } catch (err) {
      setSetupError(extractError(err, 'Generation failed. Please try again.'))
      setPhase('setup')
    }
  }

  /* Paper-level index offsets in allQuestions */
  const paperOffsets = useMemo<Record<PaperKey, number>>(() => {
    let offset = 0
    const map = {} as Record<PaperKey, number>
    for (const k of ['paper_1', 'paper_2', 'paper_3'] as PaperKey[]) {
      map[k] = offset
      offset += (organizedPapers[k] || []).length
    }
    return map
  }, [organizedPapers])

  const answeredInPaper = (k: PaperKey) => {
    const qs = organizedPapers[k] || []
    const off = paperOffsets[k]
    return qs.filter((_, i) => (off + i) in answers).length
  }

  const handleSubmit = async () => {
    setSubmitError('')
    setSubmitting(true)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    try {
      const items = allQuestions.map((q, i) => ({
        question_text: q.question_text,
        question_type: q.question_type,
        correct_answer: q.correct_answer || '',
        explanation: q.explanation || '',
        options: q.options,
        student_answer: answers[i] || '',
      }))
      const res = await questionsApi.markPractice(items, 'guest', selectedName)
      setScore(res.score_obtained)
      setPercentage(res.percentage)
      setMarkResults((res.results as unknown as MarkResult[]) || [])
      setPhase('results')
    } catch {
      setSubmitError('Failed to submit. Please try again.')
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    setPhase('setup')
    setOrganizedPapers({})
    setAllQuestions([])
    setAnswers({})
    setMarkResults([])
    setScore(0)
    setPercentage(0)
    setSetupError('')
    setSubmitError('')
    setFsWarning(false)
    setSubmitting(false)
  }

  /* ──────────────── SETUP ──────────────── */
  if (phase === 'setup') {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pb-16 sm:px-8">
        <div className="mt-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Shield className="h-3.5 w-3.5" />
            {examLabel}
          </div>
          <h1 className="text-3xl font-black text-foreground">{likelyLabel}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Questions are generated exclusively from past exam papers following the exact {curriculumName} paper structure. Subjects without past papers fall back to their official textbooks.
          </p>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">
            <strong>Exam Mode:</strong> The session opens in a full-screen isolated view.
            Navigation away from the page is blocked to replicate real exam conditions.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="mt-8 space-y-5 rounded-3xl border border-input bg-card p-6 shadow-sm">
          {/* Subject */}
          <div>
            <label className="text-sm font-semibold text-foreground">Subject</label>
            <select
              value={selectedName}
              onChange={e => handleNameChange(e.target.value)}
              className="mt-2 block w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            >
              {uniqueNames.length === 0 && <option value="">Loading subjects…</option>}
              {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* SHS Year */}
          <div>
            <label className="text-sm font-semibold text-foreground">SHS Year</label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Questions are generated from that year's past papers and textbook.
            </p>
            <div className="mt-2 flex gap-2">
              {YEARS.map(y => {
                const available = availableYears.includes(y)
                return (
                  <button
                    key={y}
                    type="button"
                    disabled={!available}
                    onClick={() => setSelectedYear(y)}
                    className={`flex-1 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition
                      ${selectedYear === y
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : available
                          ? 'border-input bg-background text-foreground hover:border-emerald-400'
                          : 'cursor-not-allowed border-input bg-muted/30 text-muted-foreground opacity-40'
                      }`}
                  >
                    {y}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Paper structure preview */}
          <div className="rounded-2xl bg-muted/30 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-foreground">Paper structure (exact {curriculumName} template):</p>
            <div className="space-y-1.5">
              {(['paper_1', 'paper_2', 'paper_3'] as PaperKey[]).map(k => (
                <div key={k} className="flex items-center gap-2">
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white"
                    style={{ backgroundColor: PAPER[k].hex }}
                  >
                    {k.split('_')[1]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{PAPER[k].label}</strong> — {PAPER[k].subtitle}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {setupError && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{setupError}</div>
          )}

          <button
            type="submit"
            disabled={!subjectId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <TrendingUp size={16} />
            Begin {curriculumName} simulation
          </button>
        </form>
      </div>
    )
  }

  /* ──────────────── GENERATING ──────────────── */
  if (phase === 'generating') {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white px-6">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
        <h2 className="mt-5 text-xl font-bold text-foreground">Building your {curriculumName} paper…</h2>
        <p className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
          Analysing past paper templates for <strong>{selectedName}</strong> ({selectedYear}) and generating exam-grade questions.
        </p>
        <ul className="mt-6 space-y-1 text-xs text-muted-foreground">
          <li>✓ Loading past question archive</li>
          <li>✓ Extracting paper structure &amp; question counts</li>
          <li>⚙ Generating questions from source material…</li>
        </ul>
      </div>
    )
  }

  /* ──────────────── EXAM (ISOLATED MODE) ──────────────── */
  if (phase === 'exam') {
    const availablePapers = (['paper_1', 'paper_2', 'paper_3'] as PaperKey[]).filter(
      k => (organizedPapers[k] || []).length > 0,
    )
    const currentQs = organizedPapers[activePaper] || []
    const currentOffset = paperOffsets[activePaper]
    const meta = PAPER[activePaper]
    const totalAnswered = Object.keys(answers).length

    return (
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[9999] flex flex-col"
        style={{ backgroundColor: '#f8fafc', userSelect: 'none' }}
      >
        {/* Fullscreen-exit warning banner */}
        {fsWarning && (
          <div
            className="shrink-0 flex items-center justify-between gap-3 px-5 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: '#DC2626' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              You exited full-screen — exam integrity compromised. Re-enter to continue.
            </div>
            <button
              type="button"
              onClick={() => overlayRef.current?.requestFullscreen?.().catch(() => {})}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1 text-xs hover:bg-white/30"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Re-enter fullscreen
            </button>
          </div>
        )}

        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-foreground">{selectedName}</p>
            <p className="text-xs text-muted-foreground">{selectedYear} · {likelyLabel}</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="font-mono font-bold">{fmt(elapsed)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-black text-foreground">{totalAnswered}</span>
              /{allQuestions.length}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-60"
              style={{ backgroundColor: '#059669' }}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy size={13} />}
              {submitting ? 'Submitting…' : 'Finish & Submit'}
            </button>
          </div>
        </div>

        {/* Paper tabs */}
        <div className="shrink-0 flex border-b border-slate-200 bg-white px-2">
          {availablePapers.map(k => {
            const m = PAPER[k]
            const ans = answeredInPaper(k)
            const total = (organizedPapers[k] || []).length
            const isActive = activePaper === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActivePaper(k)}
                className="flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition"
                style={{
                  borderBottomColor: isActive ? m.hex : 'transparent',
                  color: isActive ? m.hex : '#6B7280',
                }}
              >
                {m.label}
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: ans === total ? '#D1FAE5' : '#F3F4F6',
                    color: ans === total ? '#065F46' : '#6B7280',
                  }}
                >
                  {ans}/{total}
                </span>
              </button>
            )
          })}
        </div>

        {/* Paper header stripe */}
        <div
          className="shrink-0 px-6 py-2.5"
          style={{ backgroundColor: meta.hex }}
        >
          <p className="text-sm font-bold text-white">{meta.label} — {meta.subtitle}</p>
          <p className="text-xs text-white/75">
            {currentQs.length} question{currentQs.length !== 1 ? 's' : ''} · Answer all
          </p>
        </div>

        {/* Questions scroll area */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8">
          <div className="mx-auto max-w-3xl space-y-5">
            {currentQs.map((q, li) => {
              const gi = currentOffset + li
              const isAnswered = gi in answers
              return (
                <article
                  key={gi}
                  className="rounded-3xl border bg-white p-5 shadow-sm transition-colors"
                  style={{ borderColor: isAnswered ? meta.hex : '#E2E8F0' }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white"
                      style={{ backgroundColor: meta.hex }}
                    >
                      {li + 1}
                    </span>
                    {q.difficulty_level && (
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        q.difficulty_level === 'easy' ? 'bg-green-100 text-green-700' :
                        q.difficulty_level === 'hard' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{q.difficulty_level}</span>
                    )}
                  </div>

                  <p className="text-sm font-medium leading-relaxed text-foreground">{q.question_text}</p>

                  {q.options?.length ? (
                    <div className="mt-4 space-y-2">
                      {q.options.map((opt, oi) => {
                        const letter = String.fromCharCode(65 + oi)
                        const isSelected = answers[gi] === opt
                        return (
                          <button
                            key={oi}
                            type="button"
                            onClick={() => setAnswers(prev => ({ ...prev, [gi]: opt }))}
                            className="flex w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left text-sm transition"
                            style={{
                              borderColor: isSelected ? meta.hex : '#E2E8F0',
                              backgroundColor: isSelected ? meta.light : '#fff',
                              fontWeight: isSelected ? 600 : 400,
                            }}
                          >
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                              style={{
                                backgroundColor: isSelected ? meta.hex : '#F1F5F9',
                                color: isSelected ? '#fff' : '#64748B',
                              }}
                            >
                              {letter}
                            </span>
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <textarea
                      value={answers[gi] || ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [gi]: e.target.value }))}
                      placeholder="Write your answer here…"
                      rows={4}
                      className="mt-4 block w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2"
                      style={{ userSelect: 'text', outline: 'none' }}
                      onFocus={e => (e.currentTarget.style.boxShadow = `0 0 0 2px ${meta.hex}40`)}
                      onBlur={e => (e.currentTarget.style.boxShadow = '')}
                    />
                  )}
                </article>
              )
            })}
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div className="flex gap-2">
              {availablePapers.map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActivePaper(k)}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold transition"
                  style={{
                    backgroundColor: activePaper === k ? PAPER[k].hex : '#F1F5F9',
                    color: activePaper === k ? '#fff' : '#64748B',
                  }}
                >
                  {PAPER[k].label}
                </button>
              ))}
            </div>
            {submitError && <p className="text-xs text-red-600 shrink-0">{submitError}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
              style={{ backgroundColor: '#059669' }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight size={15} />}
              {submitting ? 'Submitting…' : 'Finish & Submit'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ──────────────── RESULTS ──────────────── */
  const grade = percentage >= 80 ? 'Excellent' : percentage >= 65 ? 'Good' : percentage >= 50 ? 'Fair' : 'Needs Work'
  const gradeColor = percentage >= 80 ? 'text-emerald-700' : percentage >= 65 ? 'text-blue-700' : percentage >= 50 ? 'text-yellow-700' : 'text-red-700'
  const gradeBg = percentage >= 80 ? 'bg-emerald-50 border-emerald-200' : percentage >= 65 ? 'bg-blue-50 border-blue-200' : percentage >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-8">
      <div className="mt-8">
        <h1 className="text-2xl font-black text-foreground">{curriculumName} Results</h1>
        <p className="text-sm text-muted-foreground">
          {selectedName} · {selectedYear} · {fmt(elapsed)} elapsed
        </p>
      </div>

      {/* Score card */}
      <div className={`mt-6 rounded-3xl border p-8 text-center ${gradeBg}`}>
        <Trophy className={`mx-auto mb-3 h-10 w-10 ${gradeColor}`} />
        <div className={`text-5xl font-black ${gradeColor}`}>{Math.round(percentage)}%</div>
        <div className="mt-1 text-base font-semibold text-muted-foreground">{grade}</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {Math.round(score)} of {allQuestions.length} correct
        </div>
      </div>

      {/* Per-paper breakdown */}
      {(['paper_1', 'paper_2', 'paper_3'] as PaperKey[])
        .filter(k => (organizedPapers[k] || []).length > 0)
        .map(paperKey => {
          const m = PAPER[paperKey]
          const paperQs = organizedPapers[paperKey] || []
          const off = paperOffsets[paperKey]
          const paperScore = paperQs.reduce((sum, _, li) => sum + (markResults[off + li]?.score || 0), 0)
          const paperPct = paperQs.length ? Math.round((paperScore / paperQs.length) * 100) : 0

          return (
            <div key={paperKey} className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: m.hex }}>
                  {m.label} — {m.subtitle}
                </h2>
                <span className="text-sm font-semibold text-muted-foreground">
                  {paperPct}% ({Math.round(paperScore)}/{paperQs.length})
                </span>
              </div>

              <div className="space-y-4">
                {paperQs.map((q, li) => {
                  const gi = off + li
                  const r = markResults[gi]
                  const isCorrect = r?.is_correct ?? false
                  const myAnswer = answers[gi] || '(no answer)'
                  return (
                    <article
                      key={gi}
                      className="rounded-3xl border p-5"
                      style={{
                        borderColor: isCorrect ? '#6EE7B7' : '#FECACA',
                        backgroundColor: isCorrect ? '#ECFDF520' : '#FEF2F220',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {isCorrect
                          ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                          : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                        }
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-relaxed text-foreground">
                            Q{li + 1}. {q.question_text}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              Your answer: {myAnswer}
                            </span>
                            {!isCorrect && q.correct_answer && (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                                Correct: {q.correct_answer}
                              </span>
                            )}
                          </div>
                          {(r?.feedback || q.explanation) && (
                            <div className="mt-3 rounded-2xl bg-white/80 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                              {r?.feedback || q.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )
        })}

      <button
        type="button"
        onClick={handleReset}
        className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        <RotateCcw size={14} />
        New {curriculumName} simulation
      </button>
    </div>
  )
}
