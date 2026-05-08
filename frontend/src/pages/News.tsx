import { useState, useEffect } from 'react'
import {
  Megaphone, Sparkles, Heart, GraduationCap, Coffee, Trophy,
  ChevronDown, ChevronUp, Calendar, User, ExternalLink,
} from 'lucide-react'
import { newsApi, competitionsApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import type { NewsArticle, Competition } from '@/api/types'

type CategoryFilter = 'all' | 'announcement' | 'motivation' | 'health' | 'education' | 'student_life'

const CATEGORIES: { id: CategoryFilter; label: string; icon: typeof Megaphone; color: string; bg: string }[] = [
  { id: 'all',          label: 'All',           icon: Megaphone,      color: 'text-slate-600',   bg: 'bg-slate-50 dark:bg-slate-800/40'   },
  { id: 'announcement', label: 'Announcements', icon: Megaphone,      color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/30'     },
  { id: 'motivation',   label: 'Motivation',    icon: Sparkles,       color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30'},
  { id: 'health',       label: 'Health',        icon: Heart,          color: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-900/30'     },
  { id: 'education',    label: 'Education',     icon: GraduationCap,  color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-900/30' },
  { id: 'student_life', label: 'Student Life',  icon: Coffee,         color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/30'   },
]

const BADGE_STYLES: Record<string, string> = {
  announcement: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  motivation:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  health:       'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  education:    'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  student_life: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
}

const CATEGORY_LABELS: Record<string, string> = {
  announcement: 'Announcement',
  motivation:   'Motivation',
  health:       'Health',
  education:    'Education',
  student_life: 'Student Life',
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function ArticleCard({ article }: { article: NewsArticle }) {
  const [expanded, setExpanded] = useState(false)
  const badge = BADGE_STYLES[article.category] || BADGE_STYLES.announcement
  const label = CATEGORY_LABELS[article.category] || article.category

  const preview = article.content.slice(0, 200)
  const needsExpand = article.content.length > 200

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-5 transition-shadow hover:shadow-md">
      {article.image_url && (
        <img
          src={article.image_url}
          alt={article.title}
          className="mb-4 h-44 w-full rounded-xl object-cover"
          loading="lazy"
        />
      )}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>{label}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar size={11} /> {formatDate(article.created_at)}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <User size={11} /> {article.author_name}
        </span>
      </div>
      <h3 className="text-base font-bold text-foreground leading-snug">{article.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
        {expanded ? article.content : preview}
        {!expanded && needsExpand && '…'}
      </p>
      {needsExpand && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
        >
          {expanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Read more</>}
        </button>
      )}
      {article.source === 'external' && article.source_url && (
        <a
          href={article.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink size={11} /> Read original article
        </a>
      )}
    </article>
  )
}

export function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [arts, comps] = await Promise.all([
          newsApi.list(),
          competitionsApi.list(),
        ])
        if (active) {
          setArticles(arts)
          setCompetitions(comps)
        }
      } catch (err) {
        if (active) setError(extractError(err, 'Failed to load news.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const filtered = activeCategory === 'all'
    ? articles
    : articles.filter(a => a.category === activeCategory)

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
      {/* Header */}
      <div className="mt-6">
        <h1 className="text-3xl font-black text-foreground">News & Updates</h1>
        <p className="mt-2 text-muted-foreground">
          Stay informed — motivation, health tips, education news, and announcements from BroxStudies.
        </p>
      </div>

      {/* Category tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          const active = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? `${cat.bg} ${cat.color} ring-2 ring-current/30`
                  : 'bg-[var(--bg-2)] text-muted-foreground hover:bg-[var(--bg-3)]'
              }`}
            >
              <Icon size={13} />
              {cat.label}
              {cat.id !== 'all' && (
                <span className="ml-0.5 text-[11px] opacity-70">
                  ({articles.filter(a => a.category === cat.id).length})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Articles */}
      <div className="mt-8">
        {loading ? (
          <div className="text-center py-16">
            <div className="pulse-loader mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading news…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Sparkles size={40} className="mx-auto text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">
              {activeCategory === 'all'
                ? 'No articles published yet. Check back soon!'
                : `No ${CATEGORY_LABELS[activeCategory] || activeCategory} articles yet.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>

      {/* Competitions section */}
      {competitions.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-amber-500" />
            <h2 className="text-xl font-bold text-foreground">Active Competitions</h2>
          </div>
          <div className="space-y-4">
            {competitions.map(comp => (
              <div key={comp.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-foreground">{comp.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{comp.description}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar size={11} /> Starts: {formatDate(comp.start_date)}</span>
                      <span className="flex items-center gap-1"><Calendar size={11} /> Ends: {formatDate(comp.end_date)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-muted-foreground">Prize</div>
                    <div className="text-lg font-black text-emerald-600">{comp.prize}</div>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      comp.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {comp.is_active ? 'Active' : 'Ended'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
