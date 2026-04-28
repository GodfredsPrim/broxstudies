import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { questionsApi, liveQuizApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { MathText } from '@/components/MathText'
import type { LiveQuizStateResponse } from '@/api/types'

interface SubjectOption {
  id: string
  name: string
  year: string
}

export function QuizPage() {
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [error, setError] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [selectedYear, setSelectedYear] = useState('Year 1')
  const [subject, setSubject] = useState('')
  const [questionType, setQuestionType] = useState('multiple_choice')
  const [difficulty, setDifficulty] = useState('medium')
  const [numQuestions, setNumQuestions] = useState(5)
  const [timeLimit, setTimeLimit] = useState(5)
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [liveState, setLiveState] = useState<LiveQuizStateResponse | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [result, setResult] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [polling, setPolling] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const years = useMemo(() => Array.from(new Set(subjects.map((s) => s.year))).sort(), [subjects])
  const filteredSubjects = useMemo(
    () => subjects.filter((item) => item.year === selectedYear),
    [subjects, selectedYear],
  )

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const data = await questionsApi.subjects()
        if (!active) return
        setSubjects(data.subjects)
        if (data.subjects.length > 0) {
          setSelectedYear(data.subjects[0].year)
          setSubject(data.subjects[0].id)
        }
      } catch (err) {
        setError(extractError(err, 'Failed to load subjects.'))
      } finally {
        setLoadingSubjects(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const first = filteredSubjects[0]
    if (first && first.id !== subject) {
      setSubject(first.id)
    }
  }, [filteredSubjects]) // Only run when filtered subjects change (year changes), not when subject changes

  useEffect(() => {
    if (!roomCode) return
    setPolling(true)
    const poll = setInterval(async () => {
      try {
        const latest = await liveQuizApi.state(roomCode)
        setLiveState(latest)
      } catch {
        // ignore polling errors
      }
    }, 2500)
    return () => {
      clearInterval(poll)
      setPolling(false)
    }
  }, [roomCode])

  useEffect(() => {
    if (!liveState) {
      setTimeLeft(null)
      return
    }

    const update = () => {
      const now = Date.now() / 1000
      const elapsed = now - liveState.created_at
      const remaining = Math.max(0, liveState.time_limit * 60 - elapsed)
      setTimeLeft(Math.ceil(remaining))
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [liveState])

  const handleCreateRoom = async () => {
    setError('')
    if (!playerName.trim()) {
      setError('Enter your display name to host a quiz.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        player_name: playerName.trim(),
        subject,
        year: selectedYear,
        question_type: questionType,
        num_questions: Math.max(1, Math.min(numQuestions, 20)),
        difficulty_level: difficulty,
        time_limit: Math.max(1, Math.min(timeLimit, 30)),
      }
      const created = await liveQuizApi.create(payload)
      setRoomCode(created.code)
      const latest = await liveQuizApi.state(created.code)
      setLiveState(latest)
      setAnswers({})
      setResult(null)
    } catch (err) {
      setError(extractError(err, 'Failed to create quiz room.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleJoinRoom = async () => {
    setError('')
    if (!playerName.trim()) {
      setError('Enter your display name to join a quiz.')
      return
    }
    if (!joinCode.trim()) {
      setError('Enter the room code to join.')
      return
    }

    setSubmitting(true)
    try {
      const code = joinCode.trim().toUpperCase()
      await liveQuizApi.join(code, playerName.trim())
      setRoomCode(code)
      const latest = await liveQuizApi.state(code)
      setLiveState(latest)
      setAnswers({})
      setResult(null)
    } catch (err) {
      setError(extractError(err, 'Failed to join the quiz room.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnswer = (index: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [index]: value }))
  }

  const handleSubmitAnswers = async () => {
    if (!roomCode || !liveState) return
    setError('')
    setSubmitting(true)
    try {
      const answersArray = Array.from({ length: liveState.questions.length }, (_, index) => answers[index] || '')
      const response = await liveQuizApi.submit(roomCode, playerName.trim(), answersArray)
      setResult(`Your score: ${response.result.score_obtained} / ${response.result.total_questions} (${response.result.percentage.toFixed(0)}%)`)
      const latest = await liveQuizApi.state(roomCode)
      setLiveState(latest)
    } catch (err) {
      setError(extractError(err, 'Failed to submit quiz answers.'))
    } finally {
      setSubmitting(false)
    }
  }

  const clearRoom = () => {
    setRoomCode('')
    setLiveState(null)
    setJoinCode('')
    setAnswers({})
    setResult(null)
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
      <div className="mt-6">
        <h1 className="text-3xl font-black text-foreground">Quiz Challenge</h1>
        <p className="mt-2 text-muted-foreground">
          Host or join a live quiz room by code. Choose a subject, year, number of questions and see live scores.
        </p>
      </div>

      {error && (
        <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          {!roomCode ? (
            <div className="rounded-3xl border border-input bg-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Host a quiz room</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Create a room and share the code with classmates so everyone can compete together.
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                  Live
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">Your name</span>
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none"
                    placeholder="Enter display name"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">Room code</span>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none"
                    placeholder="Enter code to join"
                  />
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <button
                  onClick={handleJoinRoom}
                  disabled={submitting}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  Join room
                </button>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">Year</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">Question type</span>
                  <select
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="multiple_choice">Multiple choice</option>
                    <option value="short_answer">Short answer</option>
                    <option value="essay">Essay</option>
                    <option value="true_false">True/False</option>
                    <option value="standard">Standard</option>
                  </select>
                </label>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">Subject</span>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none"
                  >
                    {filteredSubjects.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">Questions</span>
                  <input
                    type="number"
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                    min={1}
                    max={20}
                    className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">Time (mins)</span>
                  <input
                    type="number"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    min={1}
                    max={30}
                    className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">Difficulty</span>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <button
                  onClick={handleCreateRoom}
                  disabled={submitting || loadingSubjects}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  Host a room
                </button>
              </div>
            </div>
          ) : null}

          {roomCode && liveState ? (
            <div className="rounded-3xl border border-input bg-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Room {roomCode}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hosted by {liveState.host}. {liveState.questions.length} questions, {liveState.time_limit} min timer.
                  </p>
                </div>
                <div className="space-y-2 text-right">
                  <div className="text-sm font-semibold text-foreground">Time left</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {timeLeft === null ? '--:--' : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-input bg-background p-4">
                  <h3 className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Leaderboard</h3>
                  <div className="mt-4 space-y-3">
                    {liveState.leaderboard.map((player) => (
                      <div key={player.player} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
                        <span>{player.player}</span>
                        <span className="font-semibold text-foreground">{player.percentage.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-input bg-background p-4">
                  <h3 className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Status</h3>
                  <div className="mt-4 space-y-3 text-sm text-foreground">
                    <div>Host: {liveState.host}</div>
                    <div>Questions: {liveState.questions.length}</div>
                    <div>Polling: {polling ? 'active' : 'idle'}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-6">
                {liveState.questions.map((question, index) => (
                  <div key={`${question.question_text}-${index}`} className="rounded-3xl border border-input bg-background p-5">
                    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                      <span>Question {index + 1}</span>
                      <span>{question.question_type.replace('_', ' ')}</span>
                    </div>
                    <div className="mt-3 text-base text-foreground">
                      <MathText>{question.question_text}</MathText>
                    </div>
                    {question.options?.length ? (
                      <div className="mt-4 grid gap-3">
                        {question.options.map((option) => (
                          <label key={option} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-input bg-white px-4 py-3 text-sm">
                            <input
                              type="radio"
                              name={`answer-${index}`}
                              value={option}
                              checked={answers[index] === option}
                              onChange={() => handleAnswer(index, option)}
                              className="h-4 w-4 text-emerald-600"
                            />
                            <MathText>{option}</MathText>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4">
                        <label className="block text-sm font-semibold text-foreground">Your answer</label>
                        <input
                          value={answers[index] || ''}
                          onChange={(e) => handleAnswer(index, e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={handleSubmitAnswers}
                  disabled={submitting || Boolean(result)}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  Submit answers
                </button>
                <button
                  onClick={clearRoom}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-input bg-background px-5 text-sm font-semibold text-foreground transition hover:border-slate-400"
                >
                  Leave room
                </button>
              </div>

              {result ? (
                <div className="mt-4 rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-900">
                  {result}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-input bg-card p-6">
            <h2 className="text-lg font-bold text-foreground">Quick tips</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>Host a room and share the code with classmates.</li>
              <li>Join with the code and answer questions before time runs out.</li>
              <li>The leaderboard updates automatically every few seconds.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-input bg-card p-6">
            <h2 className="text-lg font-bold text-foreground">Room details</h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div>Selected year: {selectedYear}</div>
              <div>Selected subject: {subject || 'Loading...'}</div>
              <div>Difficulty: {difficulty}</div>
              <div>Type: {questionType.replace('_', ' ')}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
