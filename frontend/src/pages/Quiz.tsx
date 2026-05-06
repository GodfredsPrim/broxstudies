import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, LogIn, ChevronLeft, Trophy, Clock } from 'lucide-react'
import { questionsApi, liveQuizApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { MathText } from '@/components/MathText'
import type { LiveQuizStateResponse } from '@/api/types'

type Phase = 'pick' | 'create' | 'join' | 'active'

interface SubjectOption {
  id: string
  name: string
  year: string
}

const INPUT_CLS =
  'mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none'

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

  const pageHeader = (
    <div className="mt-6">
      <h1 className="text-3xl font-black text-foreground">Quiz Challenge</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Compete live with classmates in a real-time quiz room.
      </p>
    </div>
  )

  const errorBanner = error ? (
    <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  ) : null

  /* ── PICK ── */
  if (phase === 'pick') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-8">
        {pageHeader}
        {errorBanner}

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {/* Create */}
          <button
            onClick={() => go('create')}
            className="group flex flex-col items-center gap-5 rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-8 text-center transition hover:border-emerald-500 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md transition group-hover:bg-emerald-700">
              <Plus size={28} />
            </span>
            <span>
              <span className="block text-lg font-bold text-foreground">Create Room</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Host a live quiz and share the code with classmates
              </span>
            </span>
          </button>

          {/* Join */}
          <button
            onClick={() => go('join')}
            className="group flex flex-col items-center gap-5 rounded-3xl border-2 border-slate-200 bg-slate-50 p-8 text-center transition hover:border-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-white shadow-md transition group-hover:bg-slate-700">
              <LogIn size={28} />
            </span>
            <span>
              <span className="block text-lg font-bold text-foreground">Join Room</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Enter a room code to join a friend's quiz
              </span>
            </span>
          </button>
        </div>

        <div className="mt-8 rounded-3xl border border-input bg-card p-6">
          <h2 className="text-sm font-bold text-foreground">How it works</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• The host creates a room and shares the 6-letter code.</li>
            <li>• Anyone with the code can join and answer questions live.</li>
            <li>• The leaderboard updates automatically every few seconds.</li>
          </ul>
        </div>
      </div>
    )
  }

  /* ── JOIN ── */
  if (phase === 'join') {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-16 sm:px-8">
        {pageHeader}
        {errorBanner}

        <div className="mt-8 rounded-3xl border border-input bg-card p-6">
          <button
            onClick={() => go('pick')}
            className="mb-5 flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ChevronLeft size={14} /> Back
          </button>

          <h2 className="text-xl font-bold text-foreground">Join a Quiz Room</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enter the code shared by the room host.</p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-foreground">Your name</span>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className={INPUT_CLS}
                placeholder="Display name"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-foreground">Room code</span>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className={`${INPUT_CLS} font-mono tracking-[0.35em]`}
                placeholder="XXXXXX"
                maxLength={6}
              />
            </label>
          </div>

          <button
            onClick={handleJoinRoom}
            disabled={submitting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {submitting ? 'Joining…' : 'Join Room'}
          </button>
        </div>
      </div>
    )
  }

  /* ── CREATE ── */
  if (phase === 'create') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-8">
        {pageHeader}
        {errorBanner}

        <div className="mt-8 rounded-3xl border border-input bg-card p-6">
          <button
            onClick={() => go('pick')}
            className="mb-5 flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ChevronLeft size={14} /> Back
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Create a Quiz Room</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure your quiz, then share the generated code.
              </p>
            </div>
            <span className="rounded-2xl bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Live
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-foreground">Your name (host)</span>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className={INPUT_CLS}
                placeholder="Display name"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-foreground">Year / Level</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={INPUT_CLS}
                >
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-foreground">Subject</span>
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
                <span className="text-sm font-semibold text-foreground">Question type</span>
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
                <span className="text-sm font-semibold text-foreground">Difficulty</span>
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
                <span className="text-sm font-semibold text-foreground">Questions (1–20)</span>
                <input
                  type="number"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  min={1} max={20}
                  className={INPUT_CLS}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-foreground">Time limit (mins)</span>
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

          <button
            onClick={handleCreateRoom}
            disabled={submitting || loadingSubjects}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {submitting ? 'Creating room…' : 'Create Room'}
          </button>
        </div>
      </div>
    )
  }

  /* ── ACTIVE ── */
  const fmtTime =
    timeLeft === null ? '--:--'
    : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
      {pageHeader}
      {errorBanner}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        {/* Questions column */}
        <div className="space-y-0">
          {roomCode && liveState && (
            <div className="rounded-3xl border border-input bg-card p-6">
              {/* Room header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">Room</h2>
                    <span className="rounded-2xl bg-slate-100 px-3 py-0.5 font-mono text-base font-bold text-foreground">
                      {roomCode}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Host: {liveState.host} · {liveState.questions.length} questions · {liveState.time_limit} min
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start rounded-2xl bg-emerald-50 px-4 py-2 sm:self-auto">
                  <Clock size={14} className="text-emerald-600" />
                  <span className={`text-lg font-bold ${(timeLeft ?? 999) < 60 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {fmtTime}
                  </span>
                </div>
              </div>

              {/* Question list */}
              <div className="mt-6 space-y-4">
                {liveState.questions.map((q, i) => (
                  <div key={i} className="rounded-3xl border border-input bg-background p-5">
                    <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                      <span>Question {i + 1}</span>
                      <span>{q.question_type.replace('_', ' ')}</span>
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      <MathText>{q.question_text}</MathText>
                    </div>
                    {q.options?.length ? (
                      <div className="mt-3 grid gap-2">
                        {q.options.map((opt) => (
                          <label
                            key={opt}
                            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm transition ${
                              answers[i] === opt
                                ? 'border-emerald-400 bg-emerald-50'
                                : 'border-input hover:bg-muted'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q-${i}`}
                              value={opt}
                              checked={answers[i] === opt}
                              onChange={() => setAnswers((p) => ({ ...p, [i]: opt }))}
                              className="h-4 w-4 text-emerald-600"
                            />
                            <MathText>{opt}</MathText>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        value={answers[i] || ''}
                        onChange={(e) => setAnswers((p) => ({ ...p, [i]: e.target.value }))}
                        className="mt-3 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none"
                        placeholder="Your answer…"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSubmitAnswers}
                  disabled={submitting || Boolean(result)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  Submit answers
                </button>
                <button
                  onClick={leaveRoom}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-input px-5 py-3 text-sm font-semibold text-foreground transition hover:border-slate-400"
                >
                  Leave room
                </button>
              </div>

              {result && (
                <div className="mt-4 rounded-3xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                  {result}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          <div className="rounded-3xl border border-input bg-card p-5">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-amber-500" />
              <h2 className="text-sm font-bold text-foreground">Leaderboard</h2>
            </div>
            <div className="mt-4 space-y-2">
              {liveState?.leaderboard.length ? (
                liveState.leaderboard.map((p, i) => (
                  <div
                    key={p.player}
                    className="flex items-center justify-between rounded-2xl border border-input px-3 py-2.5 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-4 text-center text-xs text-muted-foreground">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      {p.player}
                    </span>
                    <span className="font-bold text-emerald-700">{p.percentage.toFixed(0)}%</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No scores yet — submit answers to appear here.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-input bg-card p-5">
            <h2 className="text-sm font-bold text-foreground">Room details</h2>
            <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <div>
                Code:{' '}
                <span className="ml-1 font-mono font-bold text-foreground">{roomCode}</span>
              </div>
              <div>Host: {liveState?.host}</div>
              <div>Status: {polling ? '🟢 live' : '⚪ idle'}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
