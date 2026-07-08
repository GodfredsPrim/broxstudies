import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Sparkles, ArrowRight } from 'lucide-react'
import { newsApi } from '@/api/endpoints'
import { Button } from '@/components/ui/shadcn-button'
import type { NewsArticle } from '@/api/types'

const FALLBACK_QUOTES = [
  "Small daily gains compound into big WASSCE wins.",
  "You don't need to be perfect today — just better than yesterday.",
  "Every past paper you solve is a rehearsal for exam day.",
  "Discipline now, freedom later. Keep going.",
  "The grade you want is built one focused hour at a time.",
]

function fallbackQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return FALLBACK_QUOTES[dayOfYear % FALLBACK_QUOTES.length]
}

const SEEN_KEY = 'motivation_notif_seen_id'

/** Surfaces the latest admin-posted "motivation" news article as a dashboard
 * notification, falling back to a rotating local quote so the bell always
 * has something to show even before any motivation article is published. */
export function NotificationBell() {
  const [article, setArticle] = useState<NewsArticle | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    newsApi.list('motivation')
      .then(list => {
        if (!active || list.length === 0) return
        const latest = list[0]
        setArticle(latest)
        const isUnseen = localStorage.getItem(SEEN_KEY) !== String(latest.id)
        if (isUnseen) {
          // Surface a real, unseen motivation post proactively (e.g. right after
          // login) instead of waiting for the user to click the bell.
          setOpen(true)
          localStorage.setItem(SEEN_KEY, String(latest.id))
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const togglePanel = () => {
    setOpen(v => !v)
    if (article) localStorage.setItem(SEEN_KEY, String(article.id))
  }

  const body = article
    ? article.content.slice(0, 140) + (article.content.length > 140 ? '…' : '')
    : fallbackQuote()

  return (
    <div className="relative">
      <Button variant="outline" size="icon" aria-label="Notifications" onClick={togglePanel}>
        <Bell size={18} />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-4 top-16 z-50 max-h-[70dvh] w-auto overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-2rem)]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
              <Sparkles size={13} /> Daily motivation
            </div>
            {article && <p className="mt-2 text-sm font-bold">{article.title}</p>}
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            <Link
              to="/news"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            >
              View news &amp; updates <ArrowRight size={12} />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
