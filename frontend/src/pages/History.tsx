import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock, User, Bot, Trophy, BookOpen, Wifi, WifiOff,
  ChevronDown, ChevronUp, RotateCcw,
} from 'lucide-react'
import { tutorApi, questionsApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { useOfflineHistory, type LocalExamEntry } from '@/hooks/useOfflineHistory'
import type { ExamHistoryEntry } from '@/api/types'

type Tab = 'exams' | 'chat'

interface ChatMessage {
  id: number | string
  role: 'user' | 'ai'
  content: string
  created_at?: string
}

function gradeInfo(pct: number) {
  if (pct >= 80) return { label: 'Excellent', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' }
  if (pct >= 65) return { label: 'Good', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' }
  if (pct >= 50) return { label: 'Fair', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' }
  return { label: 'Needs Work', color: 'text-red-700', bg: 'bg-red-50 border-red-200' }
}

type MergedEntry = (ExamHistoryEntry | LocalExamEntry) & { _source: 'server' | 'local' }

export function HistoryPage() {
  const { user } = useAuth()
  const { getLocalHistory } = useOfflineHistory()
  const [tab, setTab] = useState<Tab>('exams')

  // Exam history
  const [examHistory, setExamHistory] = useState<MergedEntry[]>([])
  const [examLoading, setExamLoading] = useState(true)
  const [examError, setExamError] = useState('')
  const [isOfflineFallback, setIsOfflineFallback] = useState(false)

  // Chat history
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(true)
  const [chatError, setChatError] = useState('')

  const [expandedExam, setExpandedExam] = useState<string | null>(null)

  // Load exam history
  useEffect(() => {
    const localEntries = getLocalHistory().map(e => ({ ...e, _source: 'local' as const }))

    if (!user) {
      setExamHistory(localEntries)
      setExamLoading(false)
      return
    }

    let active = true
    questionsApi.examHistory()
      .then(serverEntries => {
        if (!active) return
        const serverMapped = serverEntries.map(e => ({ ...e, _source: 'server' as const }))
        // Merge: deduplicate by same subject+score+total within 2 min window
        const all: MergedEntry[] = [...serverMapped]
        for (const local of localEntries) {
          const duplicate = serverMapped.find(s => (
            s.subject === local.subject &&
            Math.round(s.percentage) === Math.round(local.percentage) &&
            s.total_questions === local.total_questions &&
            Math.abs(new Date(s.created_at).getTime() - new Date(local.created_at).getTime()) < 2 * 60 * 1000
          ))
          if (!duplicate) all.push(local)
        }
        all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setExamHistory(all)
        setIsOfflineFallback(false)
      })
      .catch(() => {
        if (!active) return
        setExamHistory(localEntries)
        setIsOfflineFallback(true)
        if (localEntries.length === 0) setExamError('Could not load exam history. Check your connection.')
      })
      .finally(() => { if (active) setExamLoading(false) })

    return () => { active = false }
  }, [user, getLocalHistory])

  // Load chat history
  useEffect(() => {
    if (!user) { setChatLoading(false); return }
    let active = true
    tutorApi.history(50)
      .then(data => { if (active) setMessages(data.messages || []) })
      .catch(err => { if (active) setChatError(extractError(err, 'Failed to load chat history.')) })
      .finally(() => { if (active) setChatLoading(false) })
    return () => { active = false }
  }, [user])

  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button
      onClick={() => setTab(t)}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
        tab === t
          ? 'border-emerald-600 text-emerald-700'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
          tab === t ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
        }`}>{count}</span>
      )}
    </button>
  )

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-8">
      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your practice sessions, exams, and AI tutor conversations.
          </p>
        </div>
        {isOfflineFallback && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <WifiOff className="h-3.5 w-3.5" />
            Offline — showing cached data
          </div>
        )}
        {!isOfflineFallback && user && (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Wifi className="h-3.5 w-3.5" />
            Live
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-6 flex border-b border-input">
        {tabBtn('exams', 'Exams & Practice', examHistory.length || undefined)}
        {tabBtn('chat', 'AI Chat', messages.length || undefined)}
      </div>

      {/* ── EXAMS TAB ── */}
      {tab === 'exams' && (
        <div className="mt-6">
          {!user ? (
            <div className="py-20 text-center">
              <Trophy size={48} className="mx-auto text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">Sign in to track your exam history.</p>
              <Link to="/login" className="mt-4 inline-flex rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Sign in
              </Link>
            </div>
          ) : examLoading ? (
            <div className="py-20 text-center">
              <div className="pulse-loader mx-auto" />
              <p className="mt-4 text-sm text-muted-foreground">Loading history…</p>
            </div>
          ) : examError && examHistory.length === 0 ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">{examError}</div>
          ) : examHistory.length === 0 ? (
            <div className="py-20 text-center">
              <BookOpen size={48} className="mx-auto text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">No exam history yet. Complete a Practice or WASSCE session to see results here.</p>
              <div className="mt-6 flex justify-center gap-3">
                <Link to="/practice" className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                  Practice
                </Link>
                <Link to="/wassce" className="rounded-2xl border border-input px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
                  WASSCE Sim
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {examHistory.map((entry, i) => {
                const key = entry._source === 'local' ? (entry as LocalExamEntry).id : String((entry as ExamHistoryEntry).id ?? i)
                const pct = Math.round(entry.percentage)
                const { label: grade, color: gradeColor, bg: gradeBg } = gradeInfo(pct)
                const isExpanded = expandedExam === key
                const dateStr = new Date(entry.created_at).toLocaleDateString(undefined, {
                  day: 'numeric', month: 'short', year: 'numeric',
                })
                const timeStr = new Date(entry.created_at).toLocaleTimeString(undefined, {
                  hour: '2-digit', minute: '2-digit',
                })

                return (
                  <article key={key} className={`rounded-3xl border p-5 ${gradeBg} transition-shadow hover:shadow-sm`}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-4 text-left"
                      onClick={() => setExpandedExam(isExpanded ? null : key)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xl font-black ${gradeColor}`}>{pct}%</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${gradeColor} bg-white/60`}>{grade}</span>
                          {entry._source === 'local' && (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              Saved offline
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-foreground">{entry.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.exam_type} · {Math.round(entry.score_obtained)}/{entry.total_questions} correct
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {dateStr}
                        </span>
                        <span className="text-xs text-muted-foreground">{timeStr}</span>
                        {isExpanded ? (
                          <ChevronUp className={`h-4 w-4 ${gradeColor}`} />
                        ) : (
                          <ChevronDown className={`h-4 w-4 ${gradeColor}`} />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-4 rounded-2xl border border-white/60 bg-white/40 px-4 py-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <Stat label="Score" value={`${Math.round(entry.score_obtained)}/${entry.total_questions}`} />
                          <Stat label="Percentage" value={`${pct}%`} />
                          <Stat label="Type" value={entry.exam_type} />
                          <Stat label="Date" value={dateStr} />
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/60">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 80 ? '#059669' : pct >= 65 ? '#2563EB' : pct >= 50 ? '#D97706' : '#DC2626',
                            }}
                          />
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          {entry.exam_type === 'Practice' && (
                            <Link
                              to="/practice"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-white"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Practice again
                            </Link>
                          )}
                          {(entry.exam_type === 'WASSCE' || entry.exam_type === 'NAPTEX') && (
                            <Link
                              to="/wassce"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-white"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Try again
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CHAT TAB ── */}
      {tab === 'chat' && (
        <div className="mt-6">
          {!user ? (
            <div className="py-20 text-center">
              <Bot size={48} className="mx-auto text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">Sign in to view your AI tutor conversations.</p>
              <Link to="/login" className="mt-4 inline-flex rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Sign in
              </Link>
            </div>
          ) : chatLoading ? (
            <div className="py-20 text-center">
              <div className="pulse-loader mx-auto" />
              <p className="mt-4 text-sm text-muted-foreground">Loading conversations…</p>
            </div>
          ) : chatError ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">{chatError}</div>
          ) : messages.length === 0 ? (
            <div className="py-20 text-center">
              <Bot size={48} className="mx-auto text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">No conversations yet. Ask the AI tutor a question to get started.</p>
              <Link to="/" className="mt-4 inline-flex rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Ask AI Tutor
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`rounded-3xl border p-5 ${
                    msg.role === 'user'
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-input bg-card'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {msg.role === 'user' ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                        <User size={12} />
                      </span>
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                        <Bot size={12} />
                      </span>
                    )}
                    <span className="text-xs font-semibold text-muted-foreground">
                      {msg.role === 'user' ? 'You' : 'AI Tutor'}
                    </span>
                    {msg.created_at && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(msg.created_at).toLocaleString(undefined, {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
    </div>
  )
}
