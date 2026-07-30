import { useEffect, useState, type ReactNode } from 'react'
import { BadgeCheck, Check, Edit3, History, X } from 'lucide-react'
import { teacherApi } from '@/api/endpoints'
import type { TeacherQuestionRecord } from '@/api/types'
import { extractError } from '@/api/client'
import { MathText } from '@/components/MathText'
import { QuestionEvidencePanel } from '@/components/exam/QuestionEvidencePanel'
import { Button } from '@/components/ui/shadcn-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/shadcn-card'

type Action = 'approve' | 'edit' | 'reject' | 'verify'

export function TeacherReviewPage() {
  const [records, setRecords] = useState<TeacherQuestionRecord[]>([])
  const [selected, setSelected] = useState<TeacherQuestionRecord | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Action | ''>('')
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [answer, setAnswer] = useState('')
  const [explanation, setExplanation] = useState('')
  const [markingScheme, setMarkingScheme] = useState('')

  const load = async (filter = status) => {
    setLoading(true)
    setError('')
    try {
      const data = await teacherApi.queue(filter || undefined)
      setRecords(data.questions)
    } catch (err) {
      setError(extractError(err, 'Could not load the teacher review queue.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectRecord = async (record: TeacherQuestionRecord) => {
    try {
      const detail = await teacherApi.detail(record.id)
      setSelected(detail)
      setQuestionText(detail.question.question_text)
      setAnswer(detail.question.correct_answer || '')
      setExplanation(detail.question.explanation || '')
      setMarkingScheme(detail.question.marking_scheme || '')
      setComment('')
    } catch (err) {
      setError(extractError(err, 'Could not load review history.'))
    }
  }

  const act = async (action: Action) => {
    if (!selected || busy) return
    setBusy(action)
    setError('')
    try {
      const updated = await teacherApi.review(selected.id, {
        action,
        review_target: 'both',
        comment,
        ...(action === 'edit' ? {
          question_text: questionText,
          correct_answer: answer,
          explanation,
          marking_scheme: markingScheme,
        } : {}),
      })
      setSelected(updated)
      const data = await teacherApi.queue(status || undefined)
      setRecords(data.questions)
    } catch (err) {
      setError(extractError(err, 'The review action could not be saved.'))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-semibold text-[var(--primary-strong)]">Authorised teacher workspace</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--fg-0)]">Question and marking-scheme verification</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--fg-2)]">Review evidence, make corrections, and leave a permanent academic audit trail.</p>
      </header>
      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'pending_teacher_review', 'approved', 'rejected', 'verified'].map(value => (
          <button key={value || 'all'} onClick={() => { setStatus(value); void load(value) }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === value ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-2)] text-[var(--fg-2)]'}`}>
            {(value || 'all').replaceAll('_', ' ')}
          </button>
        ))}
      </div>
      {error && <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-500">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader><CardTitle>Review queue</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <p className="text-sm text-[var(--fg-3)]">Loading…</p> : records.length === 0 ? <p className="text-sm text-[var(--fg-3)]">No questions in this view.</p> : records.map(record => (
              <button key={record.id} onClick={() => void selectRecord(record)} className={`w-full rounded-xl border p-3 text-left ${selected?.id === record.id ? 'border-[var(--primary)] bg-[var(--primary-tint)]' : 'border-[var(--line)]'}`}>
                <span className="block text-[10px] font-bold uppercase text-[var(--fg-3)]">{record.subject} · {record.question_type.replaceAll('_', ' ')}</span>
                <span className="mt-1 line-clamp-2 block text-sm font-medium text-[var(--fg-1)]">{record.question.question_text}</span>
                <span className="mt-2 block text-[10px] font-semibold text-[var(--primary-strong)]">{record.review_status.replaceAll('_', ' ')}</span>
              </button>
            ))}
          </CardContent>
        </Card>
        {!selected ? (
          <Card><CardContent className="p-10 text-center text-sm text-[var(--fg-3)]">Select a question to begin review.</CardContent></Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">{selected.question.teacher_verified && <BadgeCheck className="text-emerald-500" />} Review version {selected.version}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-[var(--bg-2)] p-4"><MathText>{selected.question.question_text}</MathText></div>
              <QuestionEvidencePanel evidence={selected.question.evidence} difficulty={selected.question.difficulty_level} />
              <Field label="Question"><textarea rows={4} value={questionText} onChange={e => setQuestionText(e.target.value)} /></Field>
              <Field label="Correct answer"><textarea rows={2} value={answer} onChange={e => setAnswer(e.target.value)} /></Field>
              <Field label="Explanation"><textarea rows={3} value={explanation} onChange={e => setExplanation(e.target.value)} /></Field>
              <Field label="Marking scheme"><textarea rows={4} value={markingScheme} onChange={e => setMarkingScheme(e.target.value)} /></Field>
              <Field label="Review note"><textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} /></Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void act('edit')} disabled={Boolean(busy)} variant="outline" className="gap-1"><Edit3 size={14} /> Save edit</Button>
                <Button onClick={() => void act('approve')} disabled={Boolean(busy)} variant="outline" className="gap-1"><Check size={14} /> Approve</Button>
                <Button onClick={() => void act('reject')} disabled={Boolean(busy)} variant="outline" className="gap-1 text-rose-500"><X size={14} /> Reject</Button>
                <Button onClick={() => void act('verify')} disabled={Boolean(busy)} className="gap-1"><BadgeCheck size={14} /> Verify question & scheme</Button>
              </div>
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><History size={15} /> Review history</h2>
                <div className="space-y-2">
                  {(selected.history || []).length === 0 ? <p className="text-xs text-[var(--fg-3)]">No review actions yet.</p> : selected.history?.map(item => (
                    <div key={item.id} className="rounded-lg border border-[var(--line)] p-2.5 text-xs text-[var(--fg-2)]">
                      <span className="font-bold text-[var(--fg-1)]">{item.action}</span> by {item.reviewer_name || `user ${item.id}`} · {new Date(item.created_at).toLocaleString()}
                      {item.comment && <p className="mt-1">{item.comment}</p>}
                    </div>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-[var(--fg-2)]">{label}<div className="mt-1 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-[var(--line)] [&_textarea]:bg-[var(--bg-0)] [&_textarea]:p-3 [&_textarea]:text-sm [&_textarea]:text-[var(--fg-1)]">{children}</div></label>
}
