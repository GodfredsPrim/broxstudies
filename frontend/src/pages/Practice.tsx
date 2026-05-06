import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  BookOpen, Loader2, CheckCircle2, XCircle,
  RotateCcw, Trophy, ChevronRight, BookMarked, GraduationCap,
  FileText, ClipboardList, ScrollText, Download, Share2,
  Upload, FileUp,
} from 'lucide-react'
import { questionsApi } from '@/api/endpoints'
import { analysisApi } from '@/api/endpoints'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { useGeneration } from '@/hooks/useGeneration'
import { useToast } from '@/hooks/useToast'
import { useOfflineHistory } from '@/hooks/useOfflineHistory'
import { MathText } from '@/components/MathText'
import { Combobox } from '@/components/ui/Combobox'
import { ToastContainer } from '@/components/ui/Toast'
import type { Question, Subject, GenerationJob } from '@/api/types'
import { downloadQuestionsAsPDF, buildShareText, shareOrCopy } from '@/utils/exportQuestions'

const SHS_YEARS = ['Year 1', 'Year 2', 'Year 3']
const TVET_YEARS = ['Year 1', 'Year 2', 'Year 3']

type Phase = 'setup' | 'practice' | 'results'

interface MarkResult {
  index: number
  is_correct: boolean
  score: number
  feedback: string
  expected_answer: string
  student_answer: string
}

const SOURCE_LABELS: Record<string, string> = {
  past_questions_only: 'Past Exam Papers',
  textbook_only: 'Textbooks & Books',
  ai_generated: 'AI (WAEC Curriculum)',
  none_found: 'AI (WAEC Curriculum)',
}

const SOURCES = [
  { Icon: BookOpen,      label: 'Books & Textbooks',         color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { Icon: FileText,      label: 'Past Exam Questions',       color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { Icon: ScrollText,    label: 'Syllabi',                   color: 'text-purple-600',  bg: 'bg-purple-50'  },
  { Icon: ClipboardList, label: "Chief Examiners' Report",   color: 'text-amber-600',   bg: 'bg-amber-50'   },
]

export function PracticePage() {
  const [phase, setPhase] = useState<Phase>('setup')

  // setup
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedName, setSelectedName] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [numQuestions, setNumQuestions] = useState(10)
  const [genError, setGenError] = useState('')

  // topics
  const [availableTopics, setAvailableTopics] = useState<string[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)

  // practice
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [sourceUsed, setSourceUsed] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [shareLabel, setShareLabel] = useState('')

  // results
  const [score, setScore] = useState(0)
  const [percentage, setPercentage] = useState(0)
  const [markResults, setMarkResults] = useState<MarkResult[]>([])

  // upload answers
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadResults, setUploadResults] = useState<any>(null)

  // Offline history persistence
  const { saveLocal } = useOfflineHistory()

  // Generation and notifications
  const { toasts, removeToast, success, error, info } = useToast()
  const { startGeneration, activeJobs } = useGeneration({
    onComplete: (job: GenerationJob) => {
      if (job.result_data) {
        setQuestions(job.result_data.questions)
        setSourceUsed(job.result_data.source_used || '')
        setPhase('practice')
        success('Questions generated successfully!')
      }
    },
    onError: (job: GenerationJob) => {
      setGenError(job.error_message || 'Failed to generate questions')
      error('Failed to generate questions')
    },
  })

  useEffect(() => {
    questionsApi.subjects()
      .then(res => {
        const list = res.subjects
        setSubjects(list)
        if (list.length) {
          setSelectedName(list[0].name)
          setSelectedYear(SHS_YEARS[0])
        }
      })
      .catch(() => setGenError('Unable to load subjects. Please refresh.'))
  }, [])

  const { selectedTrack } = useAcademicTrack()

  const filteredSubjects = useMemo(
    () => subjects.filter(subject => {
      if (selectedTrack === 'tvet') {
        return subject.academic_level === 'tvet'
      }
      if (selectedTrack === 'shs') {
        return subject.academic_level !== 'tvet'
      }
      return true
    }),
    [subjects, selectedTrack],
  )

  const uniqueNames = useMemo(
    () => [...new Set(filteredSubjects.map(s => s.name))].sort(),
    [filteredSubjects],
  )

  const yearLabel = selectedTrack === 'tvet' ? 'TVET Year' : 'SHS Year'
  const yearHint = selectedTrack === 'tvet' ? 'Choose the TVET year you want to practice.' : 'Choose your SHS year.'

  const availableYears: string[] = selectedTrack === 'tvet' ? TVET_YEARS : SHS_YEARS

  useEffect(() => {
    if (uniqueNames.length && !uniqueNames.includes(selectedName)) {
      setSelectedName(uniqueNames[0])
    }
  }, [uniqueNames, selectedName])

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  // Find any catalog entry for this subject name to extract its slug
  const subjectEntry = useMemo(
    () => subjects.find(s => s.name === selectedName),
    [subjects, selectedName],
  )

  // Load topics when subject changes
  useEffect(() => {
    const loadTopics = async () => {
      if (!subjectEntry || !selectedYear) {
        setAvailableTopics([])
        setSelectedTopics([])
        return
      }

      setLoadingTopics(true)
      try {
        const slug = subjectEntry.id.includes(':') ? subjectEntry.id.split(':')[1] : subjectEntry.id
        const response = await analysisApi.topics(slug, selectedYear)
        const topics = response.topics || []
        setAvailableTopics(topics)
        setSelectedTopics([]) // Reset selected topics when subject or year changes
      } catch (error) {
        console.warn('Could not load topics:', error)
        setAvailableTopics([])
        setSelectedTopics([])
      } finally {
        setLoadingTopics(false)
      }
    }

    loadTopics()
  }, [subjectEntry, selectedYear])

  // Construct the subject ID for the chosen year: e.g. "year_1:mathematics"
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
    setGenError('')
    
    try {
      await startGeneration({
        subject: subjectId,
        year: selectedYear,
        question_type: 'multiple_choice',
        num_questions: numQuestions,
        difficulty_level: 'medium',
        topics: selectedTopics.length > 0 ? selectedTopics : undefined,
      })
      
      info('Generation started! You can navigate to other tabs while it processes.')
    } catch {
      setGenError('Failed to start generation. Please try again.')
      error('Failed to start generation')
    }
  }

  const answered = Object.keys(answers).length

  const handleSubmit = async () => {
    setSubmitError('')
    setSubmitting(true)
    try {
      const items = questions.map((q, i) => ({
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

      // Save result locally (offline-safe) and sync to server
      const histEntry = {
        exam_type: 'Practice',
        subject: selectedName,
        score_obtained: res.score_obtained,
        total_questions: questions.length,
        percentage: res.percentage,
        created_at: new Date().toISOString(),
      }
      saveLocal(histEntry)
      questionsApi.saveExamHistory(histEntry)
        .then(() => {/* synced */})
        .catch(() => {/* stays local */})
    } catch {
      setSubmitError('Failed to submit answers. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setPhase('setup')
    setQuestions([])
    setAnswers({})
    setMarkResults([])
    setScore(0)
    setPercentage(0)
    setGenError('')
    setSubmitError('')
    setSourceUsed('')
    setSelectedTopics([])
    setUploadedFile(null)
    setUploadResults(null)
    setUploadError('')
  }

  const handleUploadAnswers = async () => {
    if (!uploadedFile) return
    setUploadError('')
    setUploading(true)
    try {
      const result = await questionsApi.gradeAnswersPDF(
        uploadedFile,
        { questions },
        selectedName
      )
      setUploadResults(result.grading_result)
      setPhase('results')
    } catch {
      setUploadError('Failed to grade uploaded answers. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file)
      setUploadError('')
    } else {
      setUploadError('Please select a PDF file.')
      setUploadedFile(null)
    }
  }

  const handleDownload = () => {
    downloadQuestionsAsPDF(
      `${selectedName} — Practice Questions`,
      `${selectedYear} · ${questions.length} questions`,
      [{ heading: 'Questions', questions }],
      `${selectedName}_${selectedYear}_practice.pdf`.replace(/\s+/g, '_'),
    )
  }

  const handleShare = async () => {
    const text = buildShareText(
      `${selectedName} – ${selectedYear} Practice Questions`,
      [{ heading: 'Questions', questions }],
    )
    const result = await shareOrCopy(text, `${selectedName} Practice Questions`)
    setShareLabel(result === 'copied' ? 'Copied!' : 'Shared!')
    setTimeout(() => setShareLabel(''), 2500)
  }

  /* ── Setup ── */
  const renderSetup = () => (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 sm:px-8">
      <div className="mt-8">
        <h1 className="text-3xl font-black text-foreground">Practice Questions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose your subject and {selectedTrack === 'tvet' ? 'TVET year' : 'SHS year'}, set how many questions you want, then start a personalised practice session.
        </p>
      </div>

      {/* Source legend */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SOURCES.map(({ Icon, label, color, bg }) => (
            <div key={label} className={`rounded-2xl border border-transparent ${bg} px-3 py-3 text-center`}>
              <Icon className={`mx-auto mb-1.5 h-4 w-4 ${color}`} />
              <p className={`text-[11px] font-semibold leading-tight ${color}`}>{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Questions draw from all four sources above
        </p>

        <form onSubmit={handleGenerate} className="mt-8 space-y-5 rounded-3xl border border-input bg-card p-6 shadow-sm">
          {/* Subject */}
          <div>
            <label className="text-sm font-semibold text-foreground">Subject</label>
            <Combobox
              options={uniqueNames.map(name => ({ value: name, label: name }))}
              value={selectedName}
              onChange={handleNameChange}
              placeholder="Type to search subjects..."
              className="mt-2"
            />
          </div>

          {/* SHS Year */}
          <div>
            <label className="text-sm font-semibold text-foreground">{yearLabel}</label>
            <p className="mt-1 text-xs text-muted-foreground">{yearHint}</p>
            <div className="mt-2 flex gap-2">
              {availableYears.map((y) => {
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

          {/* Topics */}
          {selectedName && (
            <div>
              <label className="text-sm font-semibold text-foreground">
                Topics (Optional)
                {loadingTopics && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Select specific topics to focus questions on. Leave empty to include all topics.
              </p>
              {availableTopics.length > 0 ? (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-2xl border border-input bg-background p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {availableTopics.map((topic) => (
                      <label key={topic} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedTopics.includes(topic)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTopics(prev => [...prev, topic])
                            } else {
                              setSelectedTopics(prev => prev.filter(t => t !== topic))
                            }
                          }}
                          className="rounded border-input text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-foreground">{topic}</span>
                      </label>
                    ))}
                  </div>
                  {selectedTopics.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">Selected:</span>
                      {selectedTopics.map((topic) => (
                        <span
                          key={topic}
                          className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : !loadingTopics ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No topics available for this subject. Questions will cover all topics.
                </p>
              ) : null}
            </div>
          )}

          {/* Number of questions */}
          <div>
            <label className="text-sm font-semibold text-foreground">
              Number of questions
              <span className="ml-2 font-normal text-muted-foreground">(1 – 50)</span>
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={numQuestions}
              onChange={e => {
                const v = parseInt(e.target.value)
                if (!isNaN(v)) setNumQuestions(Math.max(1, Math.min(50, v)))
              }}
              className="mt-2 block w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {genError && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{genError}</div>
          )}

          <button
            type="submit"
            disabled={!subjectId || activeJobs.length > 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeJobs.length > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight size={16} />}
            {activeJobs.length > 0 ? 'Generating questions…' : 'Start practice session'}
          </button>
        </form>
      </div>
    )

  /* ── Practice ── */
  const renderPractice = () => {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-8">
        <div className="mt-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-foreground">{selectedName}</h1>
            <p className="text-sm text-muted-foreground">{selectedYear} · {questions.length} questions</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              <span className="font-black text-foreground">{answered}</span>/{questions.length} answered
            </span>
            <button
              type="button"
              onClick={handleDownload}
              title="Download as branded PDF"
              className="rounded-2xl border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <Download size={11} className="mr-1 inline" />
              PDF
            </button>
            <button
              type="button"
              onClick={handleShare}
              title="Share or copy questions"
              className="rounded-2xl border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <Share2 size={11} className="mr-1 inline" />
              {shareLabel || 'Share'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-2xl border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <RotateCcw size={11} className="mr-1 inline" />
              New session
            </button>
          </div>
        </div>

        {sourceUsed && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <BookMarked className="h-3 w-3" />
            Source: {SOURCE_LABELS[sourceUsed] || sourceUsed}
          </div>
        )}

        <div className="mt-6 space-y-5">
          {questions.map((q, i) => {
            const isAnswered = i in answers
            return (
              <article
                key={i}
                className={`rounded-3xl border bg-card p-5 shadow-sm transition-colors ${
                  isAnswered ? 'border-emerald-300' : 'border-input'
                }`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                    {i + 1}
                  </span>
                  {q.difficulty_level && (
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      q.difficulty_level === 'easy'
                        ? 'bg-green-100 text-green-700'
                        : q.difficulty_level === 'hard'
                          ? 'bg-red-100 text-red-700'
                          : q.difficulty_level === 'standard'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {q.difficulty_level}
                    </span>
                  )}
                </div>

                <p className="text-sm font-medium leading-relaxed text-foreground">
                  <MathText>{q.question_text}</MathText>
                </p>

                {q.options?.length ? (
                  <div className="mt-4 space-y-2">
                    {q.options.map((opt, oi) => {
                      const letter = String.fromCharCode(65 + oi)
                      const isSelected = answers[i] === opt
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => setAnswers(prev => ({ ...prev, [i]: opt }))}
                          className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left text-sm transition ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-900'
                              : 'border-input bg-background text-foreground hover:border-emerald-300 hover:bg-emerald-50/40'
                          }`}
                        >
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {letter}
                          </span>
                          <MathText>{opt}</MathText>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <textarea
                    value={answers[i] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                    placeholder="Write your answer here…"
                    rows={3}
                    className="mt-4 block w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                )}
              </article>
            )
          })}
        </div>

        {submitError && (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || answered === 0}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy size={16} />}
          {submitting
            ? 'Marking your answers…'
            : answered < questions.length
              ? `Submit ${answered} answered (${questions.length - answered} skipped)`
              : 'Submit all answers'}
        </button>
      </div>
    )
  }

  /* ── Results ── */
  const renderResults = () => {
    const currentResults = uploadResults || {
      score_obtained: score,
      percentage,
      results: markResults,
      total_questions: questions.length
    }
    const displayScore = currentResults.score_obtained
    const displayPercentage = currentResults.percentage
    const displayResults = currentResults.results || []

    const grade =
      displayPercentage >= 80 ? 'Excellent' :
      displayPercentage >= 65 ? 'Good' :
      displayPercentage >= 50 ? 'Fair' : 'Needs Work'

    const gradeColor =
      displayPercentage >= 80 ? 'text-emerald-700' :
      displayPercentage >= 65 ? 'text-blue-700' :
      displayPercentage >= 50 ? 'text-yellow-700' : 'text-red-700'

    const gradeBg =
      displayPercentage >= 80 ? 'bg-emerald-50 border-emerald-200' :
      displayPercentage >= 65 ? 'bg-blue-50 border-blue-200' :
      displayPercentage >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-8">
      <div className="mt-8">
        <h1 className="text-2xl font-black text-foreground">Results</h1>
        <p className="text-sm text-muted-foreground">
          {selectedName} · {selectedYear}
          {uploadResults && ' · Uploaded Answers'}
        </p>
      </div>

      {/* Score card */}
      <div className={`mt-6 rounded-3xl border p-8 text-center ${gradeBg}`}>
        <GraduationCap className={`mx-auto mb-3 h-10 w-10 ${gradeColor}`} />
        <div className={`text-5xl font-black ${gradeColor}`}>{Math.round(displayPercentage)}%</div>
        <div className="mt-1 text-base font-semibold text-muted-foreground">{grade}</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {Math.round(displayScore)} of {questions.length} correct
        </div>
      </div>

      {/* Per-question breakdown */}
      <h2 className="mt-8 text-lg font-bold text-foreground">Question breakdown</h2>
      <div className="mt-4 space-y-4">
        {questions.map((q, i) => {
          const r = displayResults[i]
          const isCorrect = r?.is_correct ?? false
          const myAnswer = uploadResults ? r?.student_answer || '(no answer)' : answers[i] || '(no answer)'
          return (
            <article
              key={i}
              className={`rounded-3xl border p-5 ${
                isCorrect ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/20'
              }`}
            >
              <div className="flex items-start gap-3">
                {isCorrect
                  ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                }
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-relaxed text-foreground">
                    Q{i + 1}. <MathText>{q.question_text}</MathText>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      Your answer: <MathText>{myAnswer}</MathText>
                    </span>
                    {!isCorrect && q.correct_answer && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        Correct: <MathText>{q.correct_answer}</MathText>
                      </span>
                    )}
                  </div>
                  {(r?.feedback || q.explanation) && (
                    <div className="mt-3 rounded-2xl bg-white/80 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                      <MathText>{r?.feedback || q.explanation || ''}</MathText>
                    </div>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <button
        type="button"
        onClick={handleReset}
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        <RotateCcw size={14} />
        New practice session
      </button>

      {/* Upload answers option */}
      <div className="mt-6 rounded-3xl border border-dashed border-emerald-300 bg-emerald-50/50 p-6">
        <div className="text-center">
          <FileUp className="mx-auto mb-3 h-8 w-8 text-emerald-600" />
          <h3 className="text-lg font-semibold text-foreground">Upload Answer Sheet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Have a PDF of answers? Upload it to get AI grading and detailed feedback.
          </p>
          <div className="mt-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="answer-upload"
            />
            <label
              htmlFor="answer-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              <Upload size={14} />
              Choose PDF
            </label>
            {uploadedFile && (
              <p className="mt-2 text-sm text-emerald-700">
                Selected: {uploadedFile.name}
              </p>
            )}
          </div>
          {uploadError && (
            <p className="mt-2 text-sm text-red-600">{uploadError}</p>
          )}
          <button
            type="button"
            onClick={handleUploadAnswers}
            disabled={!uploadedFile || uploading}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp size={16} />}
            {uploading ? 'Grading answers…' : 'Grade uploaded answers'}
          </button>
        </div>
      </div>
    </div>
  )
  }

  const renderContent = () => {
    if (phase === 'setup') {
      return renderSetup()
    } else if (phase === 'practice') {
      return renderPractice()
    } else if (phase === 'results') {
      return renderResults()
    }
    return null
  }

  return (
    <>
      {renderContent()}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}
