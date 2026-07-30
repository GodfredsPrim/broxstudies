import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookMarked, CalendarCheck, Check, ClipboardCheck, Download, GraduationCap, Lightbulb, RefreshCw, ShieldCheck, Target, Users } from 'lucide-react'
import { learningApi, tutorApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { PageLayout } from '@/components/ui/PageLayout'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import type { LearningOverview, LearningProfile } from '@/api/types'

const emptyOverview: LearningOverview = { profile: { exam_date: null, target_grade: 'A1', daily_minutes: 45, subjects: [] }, mastery: [], plan: [], due_reviews: [] }

function masteryTone(score: number) {
  if (score >= 80) return 'bg-[var(--success-tint)] text-[var(--success)]'
  if (score >= 55) return 'bg-[var(--gold-tint)] text-[var(--gold)]'
  return 'bg-[var(--danger-tint)] text-[var(--danger)]'
}

export function LearningPage() {
  const { user } = useAuth()
  const [data, setData] = useState<LearningOverview>(emptyOverview)
  const [profile, setProfile] = useState<LearningProfile>(emptyOverview.profile)
  const [subjectsText, setSubjectsText] = useState('')
  const [usage, setUsage] = useState<{ unlimited: boolean; requests_used: number; requests_limit: number | null; requests_remaining: number | null } | null>(null)
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
  const nextSession = data.plan.find(item => !item.completed)
  const needsSetup = profile.subjects.length === 0

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return <PageLayout title="Study Plan" subtitle="Know what to study today, why it matters, and what to do next." width="wide">
    {(message || error) && <div className={`mb-5 rounded-xl px-4 py-3 text-sm ${error ? 'bg-[var(--danger-tint)] text-[var(--danger)]' : 'bg-[var(--success-tint)] text-[var(--success)]'}`}>{error || message}</div>}

    <section className="mb-6 overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--bg-1)]">
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--primary)]"><Lightbulb size={17} /> How Study Plan helps</div>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold text-[var(--fg-0)]">Turn your exam goal and practice scores into a focused daily routine.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--fg-2)]">Set your subjects once, add results after practice, then follow the seven-day plan. Weak topics and overdue flashcards are automatically moved to the front.</p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ['1', 'Set your goal', 'Choose subjects, target grade, and study time.'],
              ['2', 'Add a result', 'Enter a short practice or mock score.'],
              ['3', 'Follow today’s task', 'Study, review, and mark the session complete.'],
            ].map(([step, title, body]) => <li key={step} className="rounded-xl bg-[var(--bg-2)] p-3"><span className="text-xs font-bold text-[var(--primary)]">Step {step}</span><div className="mt-1 text-sm font-semibold text-[var(--fg-0)]">{title}</div><p className="mt-1 text-xs leading-5 text-[var(--fg-2)]">{body}</p></li>)}
          </ol>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-0)] p-4">
          <div className="text-xs font-semibold text-[var(--fg-3)]">YOUR NEXT STEP</div>
          <div className="mt-2 text-lg font-bold text-[var(--fg-0)]">
            {needsSetup ? 'Set up your subjects' : data.due_reviews.length > 0 ? `Review ${data.due_reviews.length} due flashcard${data.due_reviews.length === 1 ? '' : 's'}` : nextSession ? `${nextSession.subject}: ${nextSession.topic}` : 'Generate this week’s plan'}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--fg-2)]">
            {needsSetup ? 'Your subjects and available minutes help build a realistic plan.' : data.due_reviews.length > 0 ? 'A short review now strengthens topics before they fade.' : nextSession ? `${nextSession.activity}, planned for ${nextSession.minutes} minutes.` : 'Your profile is ready. Create a plan based on your current goals and results.'}
          </p>
          {needsSetup ? (
            <Button variant="primary" className="mt-4 w-full" onClick={() => scrollTo('study-plan-setup')} trailing={<ArrowRight size={14} />}>Set up Study Plan</Button>
          ) : data.due_reviews.length > 0 ? (
            <Button variant="primary" className="mt-4 w-full" onClick={() => scrollTo('due-reviews')} trailing={<ArrowRight size={14} />}>Start review</Button>
          ) : nextSession ? (
            <Link to="/practice" className="v2-btn v2-btn-primary mt-4 h-10 w-full px-4 text-sm">Start practice <ArrowRight size={14} /></Link>
          ) : (
            <Button variant="primary" className="mt-4 w-full" onClick={() => void act('plan', learningApi.generatePlan, 'A fresh seven-day plan is ready.')} disabled={busy === 'plan'} trailing={<ArrowRight size={14} />}>Generate my plan</Button>
          )}
        </div>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: 'Average mastery', value: `${averageMastery}%`, icon: Target },
        { label: 'Reviews due', value: String(data.due_reviews.length), icon: RefreshCw },
        { label: 'Plan sessions', value: String(data.plan.filter(item => !item.completed).length), icon: CalendarCheck },
        { label: usage?.unlimited ? 'Premium AI access' : 'AI requests left', value: usage ? (usage.unlimited ? 'Unlimited' : String(usage.requests_remaining)) : '...', icon: ShieldCheck },
      ].map(item => <div key={item.label} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4"><item.icon size={18} className="text-[var(--primary)]" /><div className="mt-3 text-2xl font-bold text-[var(--fg-0)]">{item.value}</div><div className="text-xs text-[var(--fg-3)]">{item.label}</div></div>)}
    </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <div className="space-y-6">
        <section id="revision-plan" className="scroll-mt-20 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Seven-day revision plan</h2><p className="text-sm text-[var(--fg-2)]">Weak topics and due reviews are scheduled first.</p></div><Button onClick={() => void act('plan', learningApi.generatePlan, 'A fresh seven-day plan is ready.')} disabled={busy === 'plan'} leading={<RefreshCw size={14} />}>Generate plan</Button></div>
          <div className="mt-4 space-y-2">{data.plan.length === 0 ? <p className="rounded-xl bg-[var(--bg-2)] p-4 text-sm text-[var(--fg-2)]">Add subjects or a diagnostic result, then generate your plan.</p> : data.plan.map(item => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-[var(--line)] p-3 sm:flex-row sm:items-center"><div className="min-w-24 text-xs font-semibold text-[var(--fg-3)]">{new Date(`${item.plan_date}T12:00:00`).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' })}</div><div className="min-w-0 flex-1"><div className="font-semibold text-[var(--fg-0)]">{item.subject}: {item.topic}</div><div className="text-xs text-[var(--fg-3)]">{item.activity}, {item.minutes} minutes</div></div>{item.completed ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500"><Check size={13} /> Done</span> : <Button size="sm" variant="ghost" onClick={() => void act(`plan-${item.id}`, () => learningApi.completePlan(item.id), 'Session completed. Your progress has been saved.')}>Complete</Button>}</div>)}</div>
        </section>

        <section id="mastery-map" className="scroll-mt-20 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6">
          <div className="flex items-center gap-2"><BookMarked size={19} className="text-[var(--primary)]" /><h2 className="text-lg font-bold">Topic mastery and spaced review</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.mastery.length === 0 ? <p className="text-sm text-[var(--fg-2)]">Record a diagnostic or practice result to build your mastery map.</p> : data.mastery.map(item => <div key={`${item.subject}-${item.topic}`} className="rounded-xl border border-[var(--line)] p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{item.topic}</div><div className="text-xs text-[var(--fg-3)]">{item.subject}</div></div><span className={`rounded-lg px-2 py-1 text-xs font-bold ${masteryTone(item.mastery_score)}`}>{item.mastery_score}%</span></div><div className="mt-3 text-xs text-[var(--fg-2)]">{item.correct_count}/{item.attempt_count} correct. Review {item.next_review_at ? new Date(item.next_review_at).toLocaleDateString('en-GH') : 'after your next attempt'}.</div></div>)}</div>
        </section>

        <section id="due-reviews" className="scroll-mt-20 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6">
          <div className="flex items-center gap-2"><RefreshCw size={19} className="text-[var(--primary)]" /><h2 className="text-lg font-bold">Due flashcard reviews</h2></div>
          {data.due_reviews.length === 0 ? <p className="mt-3 text-sm text-[var(--fg-2)]">No cards are due. Source Studio flashcards are enrolled here automatically.</p> : <div className="mt-4 space-y-3">{data.due_reviews.map(card => <article key={card.id} className="rounded-xl border border-[var(--line)] p-4"><div className="text-xs font-semibold text-[var(--fg-3)]">{card.subject}</div><p className="mt-2 font-semibold">{card.front}</p>{revealedCard === card.id ? <><p className="mt-3 rounded-lg bg-[var(--bg-2)] p-3 text-sm">{card.back}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{(['again','hard','good','easy'] as const).map(rating => <Button key={rating} size="sm" variant="ghost" onClick={() => void act(`review-${card.id}`, () => learningApi.gradeReviewCard(card.id, rating), `Card scheduled after ${rating}.`)}>{rating[0].toUpperCase()+rating.slice(1)}</Button>)}</div></> : <Button className="mt-3" size="sm" onClick={() => setRevealedCard(card.id)}>Reveal answer</Button>}</article>)}</div>}
        </section>

        {(data.classes || []).length > 0 && <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6"><h2 className="text-lg font-bold">Class assignments</h2><div className="mt-3 space-y-3">{data.classes!.map(group => <div key={group.id}><div className="font-semibold">{group.name}</div>{group.assignments.map(item => <div key={item.id} className="mt-2 rounded-xl border border-[var(--line)] p-3"><div className="text-sm font-semibold">{item.title} · {item.subject}</div><p className="mt-1 text-xs text-[var(--fg-2)]">{item.instructions || 'Complete the assigned study activity.'}</p></div>)}</div>)}</div></section>}

        {teacher && <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4 sm:p-6"><div className="flex items-center gap-2"><Users size={19} className="text-[var(--primary)]" /><h2 className="text-lg font-bold">Teacher and school snapshot</h2></div><p className="mt-1 text-sm text-[var(--fg-2)]">{teacher.pending_reports} community reports await moderation.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs text-[var(--fg-3)]"><tr><th className="pb-2">Subject</th><th className="pb-2">Topic</th><th className="pb-2">Learners</th><th className="pb-2">Mastery</th></tr></thead><tbody>{teacher.topic_snapshot.map(item => <tr key={`${item.subject}-${item.topic}`} className="border-t border-[var(--line)]"><td className="py-3">{item.subject}</td><td>{item.topic}</td><td>{item.learners}</td><td>{Math.round(item.average_mastery)}%</td></tr>)}</tbody></table></div></section>}
      </div>

      <aside className="space-y-4">
        <form id="study-plan-setup" onSubmit={saveProfile} className="scroll-mt-20 rounded-2xl border border-[var(--line-strong)] bg-[var(--bg-1)] p-4">
          <h2 className="font-bold text-[var(--fg-0)]">Set up your Study Plan</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--fg-2)]">Tell us what you are preparing for. You can change this at any time.</p>
          <label className="mt-4 block text-xs font-semibold text-[var(--fg-2)]">Exam date<input type="date" value={profile.exam_date || ''} onChange={event => setProfile(current => ({ ...current, exam_date: event.target.value || null }))} className="v2-input mt-1" /></label>
          <label className="mt-3 block text-xs font-semibold text-[var(--fg-2)]">Target grade<select value={profile.target_grade} onChange={event => setProfile(current => ({ ...current, target_grade: event.target.value }))} className="v2-input mt-1"><option>A1</option><option>B2</option><option>B3</option><option>C4</option></select></label>
          <label className="mt-3 block text-xs font-semibold text-[var(--fg-2)]">Minutes available each day<input type="number" min="15" max="240" value={profile.daily_minutes} onChange={event => setProfile(current => ({ ...current, daily_minutes: Number(event.target.value) }))} className="v2-input mt-1" /></label>
          <label className="mt-3 block text-xs font-semibold text-[var(--fg-2)]">Subjects, separated by commas<input value={subjectsText} onChange={event => setSubjectsText(event.target.value)} className="v2-input mt-1" placeholder="Mathematics, English, Science" /></label>
          <Button type="submit" variant="primary" className="mt-4 w-full" disabled={busy === 'profile'}>Save and build my plan</Button>
        </form>

        <details className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <summary className="cursor-pointer font-semibold text-[var(--fg-0)]">Add a practice result</summary>
          <p className="mt-2 text-xs leading-5 text-[var(--fg-2)]">Use the score from a short quiz or completed practice set. This helps prioritize weak topics.</p>
          <form onSubmit={saveMastery}>
            <label className="mt-4 block text-xs font-semibold text-[var(--fg-2)]">Subject<input required value={masteryForm.subject} onChange={event => setMasteryForm(current => ({ ...current, subject: event.target.value }))} className="v2-input mt-1" /></label>
            <label className="mt-3 block text-xs font-semibold text-[var(--fg-2)]">Topic<input required value={masteryForm.topic} onChange={event => setMasteryForm(current => ({ ...current, topic: event.target.value }))} className="v2-input mt-1" /></label>
            <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-[var(--fg-2)]">Correct<input type="number" min="0" value={masteryForm.correct} onChange={event => setMasteryForm(current => ({ ...current, correct: Number(event.target.value) }))} className="v2-input mt-1" /></label><label className="text-xs font-semibold text-[var(--fg-2)]">Total<input type="number" min="1" value={masteryForm.total} onChange={event => setMasteryForm(current => ({ ...current, total: Number(event.target.value) }))} className="v2-input mt-1" /></label></div>
            <Button type="submit" className="mt-3 w-full" leading={<ClipboardCheck size={14} />}>Update mastery</Button>
          </form>
        </details>

        <details className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <summary className="cursor-pointer font-semibold text-[var(--fg-0)]">Add a mock exam result</summary>
          <form onSubmit={saveMock}>
            <label className="mt-4 block text-xs font-semibold text-[var(--fg-2)]">Subject<input required value={mockForm.subject} onChange={event => setMockForm(current => ({ ...current, subject: event.target.value }))} className="v2-input mt-1" /></label>
            <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-[var(--fg-2)]">Correct<input type="number" min="1" value={mockForm.correct_answers} onChange={event => setMockForm(current => ({ ...current, correct_answers: Number(event.target.value) }))} className="v2-input mt-1" /></label><label className="text-xs font-semibold text-[var(--fg-2)]">Total<input type="number" min="1" value={mockForm.total_questions} onChange={event => setMockForm(current => ({ ...current, total_questions: Number(event.target.value) }))} className="v2-input mt-1" /></label></div>
            <label className="mt-3 block text-xs font-semibold text-[var(--fg-2)]">Duration in minutes<input type="number" min="1" value={mockForm.duration_minutes} onChange={event => setMockForm(current => ({ ...current, duration_minutes: Number(event.target.value) }))} className="v2-input mt-1" /></label>
            <Button type="submit" className="mt-3 w-full" leading={<GraduationCap size={14} />}>Calculate grade</Button>
            <Link to="/practice" className="mt-3 block text-center text-xs font-semibold text-[var(--primary)]">Open timed practice</Link>
          </form>
        </details>

        <details className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <summary className="cursor-pointer font-semibold text-[var(--fg-0)]">Join a teacher’s class</summary>
          <form onSubmit={event => { event.preventDefault(); void act('join-class', () => learningApi.joinClass(joinCode), 'You joined the class. Assignments now appear here.') }}>
            <label className="mt-4 block text-xs font-semibold text-[var(--fg-2)]">Class code<input required minLength={6} value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())} className="v2-input mt-1" placeholder="6-character code" /></label>
            <Button type="submit" className="mt-3 w-full" disabled={busy === 'join-class'}>Join class</Button>
          </form>
        </details>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4"><h2 className="font-bold">Low-data study pack</h2><p className="mt-1 text-sm text-[var(--fg-2)]">Save your plan and mastery map on this device for offline revision.</p><Button onClick={() => void downloadPack()} className="mt-4 w-full" variant="ghost" leading={<Download size={14} />}>Save offline pack</Button></section>
      </aside>
    </div>
  </PageLayout>
}
