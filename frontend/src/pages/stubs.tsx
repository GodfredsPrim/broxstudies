import { Link } from 'react-router-dom'
import {
  Brain, FileText, Zap, Megaphone, Trophy, BookOpen, Clock,
  ArrowRight, Sparkles, TrendingUp,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { useGuestChats } from '@/hooks/useGuestChats'
import { useAuth } from '@/hooks/useAuth'

/**
 * Shared shell for not-yet-built destinations. Keeps the page identity
 * (title, eyebrow, pitch) so users can navigate, see what's coming, and
 * bounce back via Home. Real implementations replace each stub in turn.
 */
function Page({
  eyebrow,
  title,
  subtitle,
  icon,
  emptyTitle,
  emptyBody,
  ctaLabel,
  ctaTo,
  actions,
}: {
  eyebrow: string
  title: React.ReactNode
  subtitle: React.ReactNode
  icon: React.ReactNode
  emptyTitle: React.ReactNode
  emptyBody: React.ReactNode
  ctaLabel?: string
  ctaTo?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={actions}
      />
      <div className="mt-10">
        <EmptyState
          icon={icon}
          title={emptyTitle}
          body={emptyBody}
          action={
            ctaTo && (
              <Link to={ctaTo} className="v2-btn v2-btn-primary h-10 !px-4 text-[13px]">
                {ctaLabel || 'Continue'} <ArrowRight size={14} />
              </Link>
            )
          }
        />
      </div>
    </div>
  )
}

export function StudyPage() {
  const { user } = useAuth()
  const { remaining, limit } = useGuestChats()
  return (
    <Page
      eyebrow="Study with AI"
      title={<>Ask anything. Get <em className="not-italic text-emerald-300">exam-grade</em> answers.</>}
      subtitle="An AI tutor tuned for SHS topics — from calculus to Akan literature. Attach an image, upload a page, or just ask."
      icon={<Brain size={22} />}
      emptyTitle="Chat UI lands in the next slice."
      emptyBody={
        user
          ? 'Your chat history and subject-aware tutor are wiring up. For now, the old shell at / still works.'
          : `As a guest, you'll get ${limit} free chats. ${remaining} remaining. Sign up any time to unlock full history.`
      }
      ctaLabel="Preview old shell"
      ctaTo="/"
      actions={
        !user && (
          <Badge tone="accent">
            <Sparkles size={10} /> {remaining} / {limit} free
          </Badge>
        )
      }
    />
  )
}

export function PracticePage() {
  return (
    <Page
      eyebrow="Practice Questions"
      title={<>Drill the paper you're sitting.</>}
      subtitle="Generate a custom practice paper by subject, year, and question type. Marks with feedback, saves to history."
      icon={<FileText size={22} />}
      emptyTitle="Generator UI coming in slice 3."
      emptyBody="Pick subject + year + question count, get a WASSCE-faithful paper back. Grading + history wired to the existing backend."
      ctaLabel="See legacy generator"
      ctaTo="/"
    />
  )
}

export function WassceePage() {
  return (
    <Page
      eyebrow="Likely WASSCE Questions"
      title={<>What's showing up this year.</>}
      subtitle="Pattern analysis over years of past papers — topics ranked by likelihood, with source breakdowns."
      icon={<TrendingUp size={22} />}
      emptyTitle="Prediction dashboard coming soon."
      emptyBody="Ranked topic list, per-subject paper structure, and confidence scores pulled from the analysis backend."
      ctaLabel="See legacy dashboard"
      ctaTo="/"
    />
  )
}

export function QuizPage() {
  return (
    <Page
      eyebrow="Quiz Challenge"
      title={<>Live. Timed. Competitive.</>}
      subtitle="Host or join a live quiz with a 4-character code. Classmates race through the same paper — highest score wins."
      icon={<Zap size={22} />}
      emptyTitle="Live arena UI coming in slice 5."
      emptyBody="Create a room, share the code, watch the leaderboard tick up in real time."
      ctaLabel="Use legacy Live Quiz"
      ctaTo="/"
    />
  )
}

export function NewsPage() {
  return (
    <Page
      eyebrow="News & Updates"
      title={<>Competitions, rewards, announcements.</>}
      subtitle="What's on, what's next, and what you could win. New competitions surface here the moment they open."
      icon={<Megaphone size={22} />}
      emptyTitle="Announcement feed coming in slice 6."
      emptyBody="Active competitions with prize info, countdown timers, and one-tap register."
      ctaLabel="See legacy competitions"
      ctaTo="/"
    />
  )
}

export function RankingsPage() {
  return (
    <Page
      eyebrow="Rankings"
      title={<>Where you stand nationally.</>}
      subtitle="Global leaderboard across all students. Points come from practice scores, live quizzes, and competitions."
      icon={<Trophy size={22} />}
      emptyTitle="Rankings UI coming in slice 7."
      emptyBody="Top 100 with live presence dots, your personal rank pinned at the top, filterable by subject."
      ctaLabel="See legacy leaderboard"
      ctaTo="/"
    />
  )
}

export function LibraryPage() {
  return (
    <Page
      eyebrow="Library"
      title={<>Every syllabus. Every past paper.</>}
      subtitle="Pulled from curriculumresources.edu.gh and organized by subject + year. Fetch on demand, cache locally."
      icon={<BookOpen size={22} />}
      emptyTitle="Resource browser coming in slice 8."
      emptyBody="Subject × year matrix of PDFs, with download + auto-process-into-the-AI pipeline."
      ctaLabel="See legacy library"
      ctaTo="/"
    />
  )
}

export function HistoryPage() {
  return (
    <Page
      eyebrow="History"
      title={<>Everything you've done.</>}
      subtitle="Past practice sessions, mock exams, and study chats — all reviewable, all searchable."
      icon={<Clock size={22} />}
      emptyTitle="History viewer coming in slice 9."
      emptyBody="Timeline of exams + chats, score trendline, per-subject mastery curve."
      ctaLabel="See legacy history"
      ctaTo="/"
    />
  )
}

export function NotFoundPage() {
  return (
    <div className="grid min-h-[70dvh] place-items-center px-6">
      <div className="text-center">
        <div className="v2-eyebrow mb-3">404</div>
        <h1 className="v2-display text-[56px] leading-[1.02] tracking-tighter text-ink-0">
          Page not found.
        </h1>
        <p className="mt-4 text-ink-300">That route doesn't exist yet — or you wandered off the map.</p>
        <Link to="/" className="v2-btn v2-btn-primary mt-6 inline-flex">
          Back home
        </Link>
      </div>
    </div>
  )
}
