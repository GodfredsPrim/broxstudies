import { useState, useEffect } from 'react'
import {
  Megaphone, Sparkles, Heart, GraduationCap, Coffee, Trophy,
  ChevronDown, ChevronUp, Calendar, User, ExternalLink,
} from 'lucide-react'
import { newsApi, competitionsApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { PageLayout } from '@/components/ui/PageLayout'
import { FilterChips } from '@/components/ui/FilterChips'
import { LoadingBlock } from '@/components/ui/LoadingBlock'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { NewsArticle, Competition } from '@/api/types'

type CategoryFilter = 'all' | 'announcement' | 'motivation' | 'health' | 'education' | 'student_life'

const CATEGORIES = [
  { id: 'all' as const, label: 'All', icon: <Megaphone size={13} /> },
  { id: 'announcement' as const, label: 'Announcements', icon: <Megaphone size={13} /> },
  { id: 'motivation' as const, label: 'Motivation', icon: <Sparkles size={13} /> },
  { id: 'health' as const, label: 'Health', icon: <Heart size={13} /> },
  { id: 'education' as const, label: 'Education', icon: <GraduationCap size={13} /> },
  { id: 'student_life' as const, label: 'Student Life', icon: <Coffee size={13} /> },
]

const CATEGORY_LABELS: Record<string, string> = {
  announcement: 'Announcement',
  motivation: 'Motivation',
  health: 'Health',
  education: 'Education',
  student_life: 'Student Life',
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function ArticleCard({ article, featured = false }: { article: NewsArticle; featured?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const label = CATEGORY_LABELS[article.category] || article.category
  const previewLength = featured ? 320 : 200
  const preview = article.content.slice(0, previewLength)
  const needsExpand = article.content.length > previewLength

  return (
    <article className={cn('v2-card v2-card-interactive overflow-hidden', featured ? 'p-6 sm:p-8' : 'p-5')}>
      {article.image_url && (
        <img
          src={article.image_url}
          alt={article.title}
          className={cn('mb-4 w-full rounded-xl object-cover', featured ? 'h-64 sm:h-80' : 'h-44')}
          loading="lazy"
        />
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="accent">{label}</Badge>
        <span className="flex items-center gap-1 text-xs text-ink-400">
          <Calendar size={11} /> {formatDate(article.created_at)}
        </span>
        <span className="flex items-center gap-1 text-xs text-ink-400">
          <User size={11} /> {article.author_name}
        </span>
      </div>
      <h3 className={cn('font-display leading-snug text-ink-0', featured ? 'text-2xl sm:text-3xl' : 'text-lg')}>
        {article.title}
      </h3>
      <p className={cn('mt-2 whitespace-pre-wrap leading-relaxed text-ink-300', featured ? 'text-base' : 'text-sm')}>
        {expanded ? article.content : preview}
        {!expanded && needsExpand && '…'}
      </p>
      {needsExpand && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-3 flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-400 dark:text-indigo-300"
        >
          {expanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Read more</>}
        </button>
      )}
      {article.source === 'external' && article.source_url && (
        <a
          href={article.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-1 text-xs text-ink-400 hover:text-ink-0"
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
    Promise.all([newsApi.list(), competitionsApi.list()])
      .then(([arts, comps]) => {
        if (active) {
          setArticles(arts)
          setCompetitions(comps)
        }
      })
      .catch(err => { if (active) setError(extractError(err, 'Failed to load news.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const chips = CATEGORIES.map(cat => ({
    ...cat,
    count: cat.id === 'all' ? undefined : articles.filter(a => a.category === cat.id).length,
  }))

  // Top story: a pinned article wins if it has a photo, otherwise the most recent one with a photo.
  const heroArticle = activeCategory === 'all'
    ? articles.find(a => a.is_pinned && a.image_url) || articles.find(a => a.image_url)
    : undefined
  const announcements = activeCategory === 'all'
    ? articles.filter(a => a.category === 'announcement' && a.id !== heroArticle?.id)
    : []
  const featuredIds = new Set([heroArticle?.id, ...announcements.map(a => a.id)])

  const filtered = (activeCategory === 'all'
    ? articles.filter(a => !featuredIds.has(a.id))
    : articles.filter(a => a.category === activeCategory))

  return (
    <PageLayout
      eyebrow="Compete"
      title="News & Updates"
      subtitle="Motivation, health tips, education news, and announcements from BroxStudies and trusted sources."
      width="wide"
    >
      {!loading && heroArticle && (
        <section className="mb-8">
          <ArticleCard article={heroArticle} featured />
        </section>
      )}

      {!loading && announcements.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone size={18} className="text-indigo-500 dark:text-indigo-300" />
            <h2 className="font-display text-2xl text-ink-0">Announcements</h2>
          </div>
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="v2-card flex items-start gap-3 border-l-4 border-l-indigo-500 p-4">
                <div className="flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-ink-400">
                      <Calendar size={11} /> {formatDate(a.created_at)}
                    </span>
                  </div>
                  <h3 className="font-display text-base text-ink-0">{a.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-300">{a.content}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <FilterChips
        items={chips}
        value={activeCategory}
        onChange={setActiveCategory}
        className="mb-8"
      />

      {error && <div className="v2-alert v2-alert-error mb-6">{error}</div>}

      {loading ? (
        <LoadingBlock label="Loading articles…" icon={<Megaphone size={22} />} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={22} />}
          title={activeCategory === 'all' ? 'No articles yet' : `No ${CATEGORY_LABELS[activeCategory]} articles`}
          body={
            activeCategory === 'all'
              ? 'Check back soon — new motivation, health, and exam tips land here regularly.'
              : 'Try another category or check back later.'
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {competitions.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-amber-500" />
            <h2 className="font-display text-2xl text-ink-0">Active competitions</h2>
          </div>
          <div className="space-y-4">
            {competitions.map(comp => (
              <Card key={comp.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg text-ink-0">{comp.title}</h3>
                    <p className="mt-1.5 text-sm text-ink-300">{comp.description}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-400">
                      <span className="flex items-center gap-1"><Calendar size={11} /> Starts {formatDate(comp.start_date)}</span>
                      <span className="flex items-center gap-1"><Calendar size={11} /> Ends {formatDate(comp.end_date)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Prize</div>
                    <div className="font-display text-2xl text-indigo-500 dark:text-indigo-300">{comp.prize}</div>
                    <Badge tone={comp.is_active ? 'accent' : undefined} className="mt-2">
                      {comp.is_active ? 'Active' : 'Ended'}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </PageLayout>
  )
}
