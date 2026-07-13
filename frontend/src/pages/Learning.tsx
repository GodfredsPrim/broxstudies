import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BookMarked, CalendarCheck, Check, ClipboardCheck, Download, GraduationCap, RefreshCw, ShieldCheck, Target, Users } from 'lucide-react'
import { learningApi, tutorApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { PageLayout } from '@/components/ui/PageLayout'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import type { LearningOverview, LearningProfile } from '@/api/types'

const emptyOverview: LearningOverview = { profile: { exam_date: null, target_grade: 'A1', daily_minutes: 45, subjects: [] }, mastery: [], plan: [], due_reviews: [] }

function masteryTone(score: number) {
  if (score >= 80) return 'bg-emerald-500/12 text-emerald-500'
  if (score >= 55) return 'bg-amber-500/12 text-amber-500'
  return 'bg-rose-500/12 text-rose-500'
}

export function LearningPage() {
  const { user } = useAuth()
  const [data, setData] = useState<LearningOverview>(emptyOverview)
  const [profile, setProfile] = useState<LearningProfile>(emptyOverview.profile)
  const [subjectsText, setSubjectsText] = useState('')
  const [usage, setUsage] = useState<{ requests_used: number; requests_limit: number; requests_remaining: number } | null>(null)
  const [teacher, setTeacher] = useState<{ topic_snapshot: Array<{ subject: string; topic: string; average_mastery: number; learners: number }>; pending_reports: number } | null>(null)
  const [masteryForm, setMasteryForm] = useState({ subject: '', topic: '', correct: 0, total: 10 })
  const [mockForm, setMockForm] = useState({ subject: '', total_questions: 50, correct_answers: 0, duration_minutes: 120 })
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [revealedCard, setRevealedCard] = useState<number | null>(null)
  const [joinCode, setJoinCode] = useState('')

  const load = useCallback(async () => {
    const [overview, quota] = await Promise.all([learningApi.overview(), tutorApi.usage()])
    setData(overview); setProfile(overview.profile); setSubjectsText(overview.profile.subjects.join(', ')); setUsage(quota)
    if (user?.is_admin) learningApi.teacherSnapshot().then(setTeacher).catch(() => {})
  }, [user?.is_admin])

  useEffect(() => { load().catch(err => setError(extractError(err, 'Could not load your Learning Hub.'))) }, [load])

  const act = async (key: string, operation: () => Promise<unknown>, success: string) => {
    setBusy(key); setError(''); setMessage('')
    try { await operation(); setMessage(success); await load() } catch (err) { setError(extractError(err)) } finally { setBusy('') }
  }

  const saveProfile = (event: FormEvent) => {
    event.preventDefault()
    const next = { ...profile, subjects: subjectsText.split(',').map(item => item.trim()).filter(Boolean) }
    void act('profile', () => learningApi.saveProfile(next), 'Your exam goal and study preferences are saved.')
  }

  const saveMastery = (event: FormEvent) => {
    event.preventDefault()
    void act('mastery', () => learningApi.recordMastery(masteryForm), 'Topic mastery updated and the next review was scheduled.')
  }

  const saveMock = (event: FormEvent) => {
    event.preventDefault()
    void act('mock', async () => {
      const result = await learningApi.completeMock(mockForm)
      setMessage(`Mock recorded: ${result.percentage}% with predicted grade ${result.predicted_grade}.`)
    }, 'Mock result recorded.')
  }

  const downloadPack = async () => {
    setBusy('offline')
    try {
      const pack = await learningApi.offlinePack()
      localStorage.setItem('brox.offline.learning-pack', JSON.stringify(pack))
      const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }))
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `broxstudies-study-pack-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url)
      setMessage('Offline study pack saved on this device and downloaded.')
    } catch (err) { setError(extractError(err)) } finally { setBusy('') }
  }

  const averageMastery = useMemo(() => data.mastery.length ? Math.round(data.mastery.reduce((sum, item) => sum + item.mastery_score, 0) / data.mastery.length) : 0, [data.mastery])

  return <PageLayout title="Learning Hub" subtitle="Your adaptive revision plan, mastery map, spaced reviews, mock results, and low-data study pack." width="wide">
    {(message || error) && <div className={`mb-5 rounded-xl px-4 py-3 text-sm ${error ? 'bg-[var(--danger-tint)] text-[var(--danger)]' : 'bg-[var(--success-tint)] text-[var(--success)]'}`}>{error || message}</div>}

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: 'Average mastery', value: `${averageMastery}%`, icon: Target },
        { label: 'Reviews due', value: String(data.due_reviews.length), icon: RefreshCw },
        { label: 'Plan sessions', value: String(data.plan.filter(item => !item.completed).length), icon: CalendarCheck },
        { label: 'AI requests left', value: usage ? String(usage.requests_remaining) : '...', icon: ShieldCheck },
      ].map(item => <div key={item.label} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4"><item.icon size={18} className="text-[var(--primary)]" /><div className="mt-3 text-2xl font-bold text-[var(--fg-0)]">{item.value}</div><div className="text-xs text-[var(--fg-3)]">{item.label}</div></div>)}
    </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Seven-day revision plan</h2><p className="text-sm text-[var(--fg-2)]">Weak topics and due reviews are scheduled first.</p></div><Button onClick={() => void act('plan', learningApi.generatePlan, 'A fresh seven-day plan is ready.')} disabled={busy === 'plan'} leading={<RefreshCw size={14} />}>Generate plan</Button></div>
          <div className="mt-4 space-y-2">{data.plan.length === 0 ? <p className="rounded-xl bg-[var(--bg-2)] p-4 text-sm text-[var(--fg-2)]">Add subjects or a diagnostic result, then generate your plan.</p> : data.plan.map(item => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-[var(--line)] p-3 sm:flex-row sm:items-center"><div className="min-w-24 text-xs font-semibold text-[var(--fg-3)]">{new Date(`${item.plan_date}T12:00:00`).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' })}</div><div className="min-w-0 flex-1"><div className="font-semibold text-[var(--fg-0)]">{item.subject}: {item.topic}</div><div className="text-xs text-[var(--fg-3)]">{item.activity}, {item.minutes} minutes</div></div>{item.completed ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500"><Check size={13} /> Done</span> : <Button size="sm" variant="ghost" onClick={() => void act(`plan-${item.id}`, () => learningApi.completePlan(item.id), 'Session completed. Your progress has been saved.')}>Complete</Button>}</div>)}</div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6">
          <div className="flex items-center gap-2"><BookMarked size={19} className="text-[var(--primary)]" /><h2 className="text-lg font-bold">Topic mastery and spaced review</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.mastery.length === 0 ? <p className="text-sm text-[var(--fg-2)]">Record a diagnostic or practice result to build your mastery map.</p> : data.mastery.map(item => <div key={`${item.subject}-${item.topic}`} className="rounded-xl border border-[var(--line)] p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{item.topic}</div><div className="text-xs text-[var(--fg-3)]">{item.subject}</div></div><span className={`rounded-lg px-2 py-1 text-xs font-bold ${masteryTone(item.mastery_score)}`}>{item.mastery_score}%</span></div><div className="mt-3 text-xs text-[var(--fg-2)]">{item.correct_count}/{item.attempt_count} correct. Review {item.next_review_at ? new Date(item.next_review_at).toLocaleDateString('en-GH') : 'after your next attempt'}.</div></div>)}</div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6">
          <div className="flex items-center gap-2"><RefreshCw size={19} className="text-[var(--primary)]" /><h2 className="text-lg font-bold">Due flashcard reviews</h2></div>
          {data.due_reviews.length === 0 ? <p className="mt-3 text-sm text-[var(--fg-2)]">No cards are due. Source Studio flashcards are enrolled here automatically.</p> : <div className="mt-4 space-y-3">{data.due_reviews.map(card => <article key={card.id} className="rounded-xl border border-[var(--line)] p-4"><div className="text-xs font-semibold text-[var(--fg-3)]">{card.subject}</div><p className="mt-2 font-semibold">{card.front}</p>{revealedCard === card.id ? <><p className="mt-3 rounded-lg bg-[var(--bg-2)] p-3 text-sm">{card.back}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{(['again','hard','good','easy'] as const).map(rating => <Button key={rating} size="sm" variant="ghost" onClick={() => void act(`review-${card.id}`, () => learningApi.gradeReviewCard(card.id, rating), `Card scheduled after ${rating}.`)}>{rating[0].toUpperCase()+rating.slice(1)}</Button>)}</div></> : <Button className="mt-3" size="sm" onClick={() => setRevealedCard(card.id)}>Reveal answer</Button>}</article>)}</div>}
        </section>

        {(data.classes || []).length > 0 && <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6"><h2 className="text-lg font-bold">Class assignments</h2><div className="mt-3 space-y-3">{data.classes!.map(group => <div key={group.id}><div className="font-semibold">{group.name}</div>{group.assignments.map(item => <div key={item.id} className="mt-2 rounded-xl border border-[var(--line)] p-3"><div className="text-sm font-semibold">{item.title} · {item.subject}</div><p className="mt-1 text-xs text-[var(--fg-2)]">{item.instructions || 'Complete the assigned study activity.'}</p></div>)}</div>)}</div></section>}

        {teacher && <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6"><div className="flex items-center gap-2"><Users size={19} className="text-[var(--primary)]" /><h2 className="text-lg font-bold">Teacher and school snapshot</h2></div><p className="mt-1 text-sm text-[var(--fg-2)]">{teacher.pending_reports} community reports await moderation.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs text-[var(--fg-3)]"><tr><th className="pb-2">Subject</th><th className="pb-2">Topic</th><th className="pb-2">Learners</th><th className="pb-2">Mastery</th></tr></thead><tbody>{teacher.topic_snapshot.map(item => <tr key={`${item.subject}-${item.topic}`} className="border-t border-[var(--line)]"><td className="py-3">{item.subject}</td><td>{item.topic}</td><td>{item.learners}</td><td>{Math.round(item.average_mastery)}%</td></tr>)}</tbody></table></div></section>}
      </div>

      <aside className="space-y-6">
        <form onSubmit={event => { event.preventDefault(); void act('join-class', () => learningApi.joinClass(joinCode), 'You joined the class. Assignments now appear here.') }} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4"><h2 className="font-bold">Join a teacher's class</h2><input required minLength={6} value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())} className="v2-input mt-3" placeholder="6-character class code" /><Button type="submit" className="mt-3 w-full" disabled={busy === 'join-class'}>Join class</Button></form>
        <form onSubmit={saveProfile} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4"><h2 className="font-bold">Exam goal and schedule</h2><label className="mt-4 block text-xs font-semibold text-[var(--fg-2)]">Exam date<input type="date" value={profile.exam_date || ''} onChange={event => setProfile(current => ({ ...current, exam_date: event.target.value || null }))} className="v2-input mt-1" /></label><label className="mt-3 block text-xs font-semibold text-[var(--fg-2)]">Target grade<select value={profile.target_grade} onChange={event => setProfile(current => ({ ...current, target_grade: event.target.value }))} className="v2-input mt-1"><option>A1</option><option>B2</option><option>B3</option><option>C4</option></select></label><label className="mt-3 block text-xs font-semibold text-[var(--fg-2)]">Daily minutes<input type="number" min="15" max="240" value={profile.daily_minutes} onChange={event => setProfile(current => ({ ...current, daily_minutes: Number(event.target.value) }))} className="v2-input mt-1" /></label><label className="mt-3 block text-xs font-semibold text-[var(--fg-2)]">Subjects, separated by commas<input value={subjectsText} onChange={event => setSubjectsText(event.target.value)} className="v2-input mt-1" placeholder="Mathematics, English, Science" /></label><Button type="submit" className="mt-4 w-full" disabled={busy === 'profile'}>Save goal</Button></form>

        <form onSubmit={saveMastery} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4"><h2 className="font-bold">Record diagnostic result</h2><p className="mt-1 text-xs text-[var(--fg-3)]">Use a short baseline or completed practice set.</p><input required value={masteryForm.subject} onChange={event => setMasteryForm(current => ({ ...current, subject: event.target.value }))} className="v2-input mt-4" placeholder="Subject" /><input required value={masteryForm.topic} onChange={event => setMasteryForm(current => ({ ...current, topic: event.target.value }))} className="v2-input mt-2" placeholder="Topic" /><div className="mt-2 grid grid-cols-2 gap-2"><input type="number" min="0" value={masteryForm.correct} onChange={event => setMasteryForm(current => ({ ...current, correct: Number(event.target.value) }))} className="v2-input" aria-label="Correct answers" /><input type="number" min="1" value={masteryForm.total} onChange={event => setMasteryForm(current => ({ ...current, total: Number(event.target.value) }))} className="v2-input" aria-label="Total questions" /></div><Button type="submit" className="mt-3 w-full" leading={<ClipboardCheck size={14} />}>Update mastery</Button></form>

        <form onSubmit={saveMock} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4"><h2 className="font-bold">Record full mock exam</h2><input required value={mockForm.subject} onChange={event => setMockForm(current => ({ ...current, subject: event.target.value }))} className="v2-input mt-4" placeholder="Subject" /><div className="mt-2 grid grid-cols-2 gap-2"><input type="number" min="1" value={mockForm.correct_answers} onChange={event => setMockForm(current => ({ ...current, correct_answers: Number(event.target.value) }))} className="v2-input" aria-label="Correct answers" /><input type="number" min="1" value={mockForm.total_questions} onChange={event => setMockForm(current => ({ ...current, total_questions: Number(event.target.value) }))} className="v2-input" aria-label="Total questions" /></div><input type="number" min="1" value={mockForm.duration_minutes} onChange={event => setMockForm(current => ({ ...current, duration_minutes: Number(event.target.value) }))} className="v2-input mt-2" aria-label="Duration in minutes" /><Button type="submit" className="mt-3 w-full" leading={<GraduationCap size={14} />}>Calculate grade</Button><Link to="/practice" className="mt-2 block text-center text-xs font-semibold text-[var(--primary)]">Open timed practice</Link></form>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4"><h2 className="font-bold">Low-data study pack</h2><p className="mt-1 text-sm text-[var(--fg-2)]">Save your plan and mastery map on this device for offline revision.</p><Button onClick={() => void downloadPack()} className="mt-4 w-full" variant="ghost" leading={<Download size={14} />}>Save offline pack</Button></section>
      </aside>
    </div>
  </PageLayout>
}
