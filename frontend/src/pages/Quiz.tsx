import { useEffect, useMemo, useState } from 'react'
import { Plus, LogIn, ChevronLeft, Trophy, Clock } from 'lucide-react'
import { questionsApi, liveQuizApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { MathText } from '@/components/MathText'
import { PageLayout } from '@/components/ui/PageLayout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/Badge'
import type { LiveQuizStateResponse } from '@/api/types'

const INPUT_CLS = 'v2-input mt-2'

type Phase = 'pick' | 'create' | 'join' | 'active'

interface SubjectOption {
  id: string
  name: string
  year: string
}

export function QuizPage() {
  const [phase, setPhase] = useState<Phase>('pick')
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [error, setError] = useState('')

  // form fields
  const [playerName, setPlayerName] = useState('')
  const [selectedYear, setSelectedYear] = useState('Year 1')
  const [subject, setSubject] = useState('')
  const [questionType, setQuestionType] = useState('multiple_choice')
  const [difficulty, setDifficulty] = useState('medium')
  const [numQuestions, setNumQuestions] = useState(5)
  const [timeLimit, setTimeLimit] = useState(5)
  const [joinCode, setJoinCode] = useState('')

  // active room
  const [roomCode, setRoomCode] = useState('')
  const [liveState, setLiveState] = useState<LiveQuizStateResponse | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [result, setResult] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [polling, setPolling] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const years = useMemo(() => Array.from(new Set(subjects.map((s) => s.year))).sort(), [subjects])
  const filteredSubjects = useMemo(
    () => subjects.filter((s) => s.year === selectedYear),
    [subjects, selectedYear],
  )

  // load subjects
  useEffect(() => {
    let active = true
    questionsApi.subjects()
      .then((data) => {
        if (!active) return
        setSubjects(data.subjects)
        if (data.subjects.length) {
          setSelectedYear(data.subjects[0].year)
          setSubject(data.subjects[0].id)
        }
      })
      .catch((err) => setError(extractError(err, 'Failed to load subjects.')))
      .finally(() => setLoadingSubjects(false))
    return () => { active = false }
  }, [])

  // reset subject when year changes
  useEffect(() => {
    const first = filteredSubjects[0]
    if (first && first.id !== subject) setSubject(first.id)
  }, [filteredSubjects]) // eslint-disable-line react-hooks/exhaustive-deps

  // poll room state
  useEffect(() => {
    if (!roomCode) return
    setPolling(true)
    const id = setInterval(async () => {
      try { setLiveState(await liveQuizApi.state(roomCode)) } catch { /* ignore */ }
    }, 2500)
    return () => { clearInterval(id); setPolling(false) }
  }, [roomCode])

  // countdown timer
  useEffect(() => {
    if (!liveState) { setTimeLeft(null); return }
    const tick = () => {
      const elapsed = Date.now() / 1000 - liveState.created_at
      setTimeLeft(Math.ceil(Math.max(0, liveState.time_limit * 60 - elapsed)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [liveState])

  const go = (p: Phase) => { setError(''); setPhase(p) }

  const handleCreateRoom = async () => {
    setError('')
    if (!playerName.trim()) { setError('Enter your display name to host.'); return }
    setSubmitting(true)
    try {
      const created = await liveQuizApi.create({
        player_name: playerName.trim(), subject, year: selectedYear,
        question_type: questionType,
        num_questions: Math.max(1, Math.min(numQuestions, 20)),
        difficulty_level: difficulty,
        time_limit: Math.max(1, Math.min(timeLimit, 30)),
      })
      setRoomCode(created.code)
      setLiveState(await liveQuizApi.state(created.code))
      setAnswers({}); setResult(null)
      setPhase('active')
    } catch (err) {
      setError(extractError(err, 'Failed to create quiz room.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleJoinRoom = async () => {
    setError('')
    if (!playerName.trim()) { setError('Enter your display name to join.'); return }
    if (!joinCode.trim()) { setError('Enter the room code.'); return }
    setSubmitting(true)
    try {
      const code = joinCode.trim().toUpperCase()
      await liveQuizApi.join(code, playerName.trim())
      setRoomCode(code)
      setLiveState(await liveQuizApi.state(code))
      setAnswers({}); setResult(null)
      setPhase('active')
    } catch (err) {
      setError(extractError(err, 'Failed to join quiz room.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitAnswers = async () => {
    if (!roomCode || !liveState) return
    setError(''); setSubmitting(true)
    try {
      const arr = Array.from({ length: liveState.questions.length }, (_, i) => answers[i] || '')
      const res = await liveQuizApi.submit(roomCode, playerName.trim(), arr)
      setResult(
        `Your score: ${res.result.score_obtained} / ${res.result.total_questions} (${res.result.percentage.toFixed(0)}%)`
      )
      setLiveState(await liveQuizApi.state(roomCode))
    } catch (err) {
      setError(extractError(err, 'Failed to submit answers.'))
    } finally {
      setSubmitting(false)
    }
  }

  const leaveRoom = () => {
    setRoomCode(''); setLiveState(null); setJoinCode('')
    setAnswers({}); setResult(null); setError('')
    setPhase('pick')
  }

  const errorBanner = error ? (
    <div className="v2-alert v2-alert-error mb-6">{error}</div>
  ) : null

  /* ── PICK ── */
  if (phase === 'pick') {
    return (
      <PageLayout
        eyebrow="Compete"
        title="Quiz Challenge"
        subtitle="Compete live with classmates in a real-time quiz room."
        width="medium"
        noHeaderBorder
      >
        {errorBanner}

        <div className="grid gap-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => go('create')}
            className="v2-card v2-card-interactive group flex flex-col items-center gap-5 p-8 text-center"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-glow-sm transition group-hover:bg-indigo-700">
              <Plus size={28} />
            </span>
            <span>
              <span className="block font-display text-xl text-ink-0">Create room</span>
              <span className="mt-1 block text-sm text-ink-300">
                Host a live quiz and share the code with classmates
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => go('join')}
            className="v2-card v2-card-interactive group flex flex-col items-center gap-5 p-8 text-center"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-3)] text-ink-0 ring-1 ring-[var(--line)] transition group-hover:bg-[var(--accent-tint)] group-hover:text-indigo-400 dark:group-hover:text-indigo-300">
              <LogIn size={28} />
            </span>
            <span>
              <span className="block font-display text-xl text-ink-0">Join room</span>
              <span className="mt-1 block text-sm text-ink-300">
                Enter a room code to join a friend's quiz
              </span>
            </span>
          </button>
        </div>

        <Card className="mt-8 p-6">
          <h2 className="text-sm font-bold text-ink-0">How it works</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-300">
            <li>• The host creates a room and shares the 6-letter code.</li>
            <li>• Anyone with the code can join and answer questions live.</li>
            <li>• The leaderboard updates automatically every few seconds.</li>
          </ul>
        </Card>
      </PageLayout>
    )
  }

  /* ── JOIN ── */
  if (phase === 'join') {
    return (
      <PageLayout
        eyebrow="Compete"
        title="Join a quiz"
        subtitle="Enter the code shared by the room host."
        width="narrow"
        noHeaderBorder
      >
        {errorBanner}
        <Card className="p-6">
          <button
            type="button"
            onClick={() => go('pick')}
            className="mb-5 flex items-center gap-1 text-sm text-ink-400 transition hover:text-ink-0"
          >
            <ChevronLeft size={14} /> Back
          </button>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-ink-0">Your name</span>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className={INPUT_CLS}
                placeholder="Display name"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink-0">Room code</span>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className={`${INPUT_CLS} font-mono tracking-[0.35em]`}
                placeholder="XXXXXX"
                maxLength={6}
              />
            </label>
          </div>
          <Button
            className="mt-6"
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            leading={<LogIn size={16} />}
            onClick={() => void handleJoinRoom()}
          >
            {submitting ? 'Joining…' : 'Join room'}
          </Button>
        </Card>
      </PageLayout>
    )
  }

  /* ── CREATE ── */
  if (phase === 'create') {
    return (
      <PageLayout
        eyebrow="Compete"
        title="Create a quiz room"
        subtitle="Configure your quiz, then share the generated code."
        width="medium"
        actions={<Badge tone="accent">Live</Badge>}
        noHeaderBorder
      >
        {errorBanner}
        <Card className="p-6">
          <button
            type="button"
            onClick={() => go('pick')}
            className="mb-5 flex items-center gap-1 text-sm text-ink-400 transition hover:text-ink-0"
          >
            <ChevronLeft size={14} /> Back
          </button>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-ink-0">Your name (host)</span>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className={INPUT_CLS}
                placeholder="Display name"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-ink-0">Year / Level</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={INPUT_CLS}
                >
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink-0">Subject</span>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={INPUT_CLS}
                  disabled={loadingSubjects}
                >
                  {loadingSubjects
                    ? <option>Loading…</option>
                    : filteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
                  }
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-ink-0">Question type</span>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className={INPUT_CLS}
                >
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="short_answer">Short answer</option>
                  <option value="true_false">True / False</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink-0">Difficulty</span>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className={INPUT_CLS}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-ink-0">Questions (1–20)</span>
                <input
                  type="number"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  min={1} max={20}
                  className={INPUT_CLS}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink-0">Time limit (mins)</span>
                <input
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  min={1} max={30}
                  className={INPUT_CLS}
                />
              </label>
            </div>
          </div>

          <Button
            className="mt-6"
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting || loadingSubjects}
            leading={<Plus size={16} />}
            onClick={() => void handleCreateRoom()}
          >
            {submitting ? 'Creating room…' : 'Create room'}
          </Button>
        </Card>
      </PageLayout>
    )
  }

  /* ── ACTIVE ── */
  const fmtTime =
    timeLeft === null ? '--:--'
    : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`

  return (
    <PageLayout
      eyebrow="Compete"
      title="Live quiz"
      subtitle={roomCode ? `Room ${roomCode}` : 'Quiz in progress'}
      width="wide"
      noHeaderBorder
    >
      {errorBanner}

      <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        {/* Questions column */}
        <div className="space-y-0">
          {roomCode && liveState && (
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-1)] p-6">
              {/* Room header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-[var(--fg-0)]">Room</h2>
                    <span className="rounded-2xl bg-[var(--bg-2)] px-3 py-0.5 font-mono text-base font-bold text-[var(--fg-0)]">
                      {roomCode}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--fg-2)]">
                    Host: {liveState.host} · {liveState.questions.length} questions · {liveState.time_limit} min
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start rounded-2xl bg-indigo-500/10 px-4 py-2 sm:self-auto dark:bg-indigo-900/20">
                  <Clock size={14} className="text-indigo-500 dark:text-indigo-400" />
                  <span className={`text-lg font-bold ${(timeLeft ?? 999) < 60 ? 'text-red-600 dark:text-red-400' : 'text-indigo-400 dark:text-indigo-300'}`}>
                    {fmtTime}
                  </span>
                </div>
              </div>

              {/* Question list */}
              <div className="mt-6 space-y-4">
                {liveState.questions.map((q, i) => (
                  <div key={i} className="rounded-3xl border border-[var(--line)] bg-[var(--bg-0)] p-5">
                    <div className="flex items-center justify-between gap-4 text-xs text-[var(--fg-2)]">
                      <span>Question {i + 1}</span>
                      <span>{q.question_type.replace('_', ' ')}</span>
                    </div>
                    <div className="mt-2 text-sm font-medium text-[var(--fg-0)]">
                      <MathText>{q.question_text}</MathText>
                    </div>
                    {q.options?.length ? (
                      <div className="mt-3 grid gap-2">
                        {q.options.map((opt) => (
                          <label
                            key={opt}
                            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm text-[var(--fg-0)] transition ${
                              answers[i] === opt
                                ? 'border-indigo-400 bg-indigo-500/10 dark:bg-indigo-900/20'
                                : 'border-[var(--line)] hover:bg-[var(--bg-2)]'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q-${i}`}
                              value={opt}
                              checked={answers[i] === opt}
                              onChange={() => setAnswers((p) => ({ ...p, [i]: opt }))}
                              className="h-4 w-4 text-indigo-600"
                            />
                            <MathText>{opt}</MathText>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        value={answers[i] || ''}
                        onChange={(e) => setAnswers((p) => ({ ...p, [i]: e.target.value }))}
                        className="mt-3 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 text-sm text-[var(--fg-0)] placeholder:text-[var(--fg-3)] focus:border-indigo-500 focus:outline-none"
                        placeholder="Your answer…"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  loading={submitting}
                  disabled={Boolean(result)}
                  onClick={() => void handleSubmitAnswers()}
                >
                  Submit answers
                </Button>
                <Button variant="ghost" size="lg" onClick={leaveRoom}>
                  Leave room
                </Button>
              </div>

              {result && (
                <div className="mt-4 rounded-3xl bg-indigo-500/10 p-4 text-sm font-semibold text-indigo-300 dark:bg-indigo-900/20">
                  {result}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-amber-500" />
              <h2 className="text-sm font-bold text-[var(--fg-0)]">Leaderboard</h2>
            </div>
            <div className="mt-4 space-y-2">
              {liveState?.leaderboard.length ? (
                liveState.leaderboard.map((p, i) => (
                  <div
                    key={p.player}
                    className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--fg-0)]"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-4 text-center text-xs text-[var(--fg-2)]">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      {p.player}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{p.percentage.toFixed(0)}%</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[var(--fg-2)]">No scores yet — submit answers to appear here.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
            <h2 className="text-sm font-bold text-[var(--fg-0)]">Room details</h2>
            <div className="mt-3 space-y-1.5 text-sm text-[var(--fg-2)]">
              <div>
                Code:{' '}
                <span className="ml-1 font-mono font-bold text-[var(--fg-0)]">{roomCode}</span>
              </div>
              <div>Host: {liveState?.host}</div>
              <div>Status: {polling ? '🟢 live' : '⚪ idle'}</div>
            </div>
          </div>
        </aside>
      </div>
    </PageLayout>
  )
}
