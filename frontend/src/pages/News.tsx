import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BookOpen, Heart, Lightbulb, MessageCircle, Send, Sparkles, ThumbsUp } from 'lucide-react'
import { newsApi, socialApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { PageLayout } from '@/components/ui/PageLayout'
import { Button } from '@/components/ui/button'
import { LoadingBlock } from '@/components/ui/LoadingBlock'
import type { NewsArticle, SocialPost, SocialReaction } from '@/api/types'

function relativeDate(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return new Date(value).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

const reactions: Array<{ id: SocialReaction; label: string; icon: typeof Heart }> = [
  { id: 'like', label: 'Like', icon: ThumbsUp },
  { id: 'love', label: 'Love', icon: Heart },
  { id: 'insightful', label: 'Useful', icon: Lightbulb },
]

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--primary-tint)] text-sm font-bold text-[var(--primary-strong)]">{initials || 'BS'}</span>
}

function CommunityPost({ post, onRefresh }: { post: SocialPost; onRefresh: () => Promise<void> }) {
  const [comment, setComment] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [busy, setBusy] = useState(false)

  const react = async (reaction: SocialReaction) => {
    if (busy) return
    setBusy(true)
    try { await socialApi.react(post.id, post.viewer_reaction === reaction ? null : reaction); await onRefresh() } finally { setBusy(false) }
  }

  const submitComment = async (event: FormEvent) => {
    event.preventDefault()
    if (!comment.trim() || busy) return
    setBusy(true)
    try { await socialApi.comment(post.id, comment.trim()); setComment(''); setShowComments(true); await onRefresh() } finally { setBusy(false) }
  }

  return (
    <article className="border-b border-[var(--line)] bg-[var(--bg-1)] px-4 py-5 sm:px-6">
      <div className="flex gap-3">
        <Avatar name={post.author_name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2"><strong className="truncate text-sm text-[var(--fg-0)]">{post.author_name}</strong><span className="text-xs text-[var(--fg-3)]">{relativeDate(post.created_at)}</span></div>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6 text-[var(--fg-1)]">{post.content}</p>
          <div className="mt-4 flex flex-wrap items-center gap-1 sm:gap-3">
            {reactions.map(({ id, label, icon: Icon }) => {
              const count = id === 'like' ? post.likes : id === 'love' ? post.loves : post.insightful
              const active = post.viewer_reaction === id
              return <button key={id} disabled={busy} onClick={() => void react(id)} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${active ? 'bg-[var(--primary-tint)] text-[var(--primary-strong)]' : 'text-[var(--fg-2)] hover:bg-[var(--bg-2)]'}`}><Icon size={14} fill={id === 'love' && active ? 'currentColor' : 'none'} />{label}{count > 0 && <span>{count}</span>}</button>
            })}
            <button onClick={() => setShowComments(value => !value)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--fg-2)] hover:bg-[var(--bg-2)]"><MessageCircle size={14} /> Comment {post.comments.length > 0 && post.comments.length}</button>
          </div>
          {showComments && <div className="mt-4 space-y-3 border-l-2 border-[var(--line)] pl-3">
            {post.comments.map(item => <div key={item.id} className="text-sm"><span className="font-semibold text-[var(--fg-0)]">{item.author_name}</span><span className="ml-2 text-[var(--fg-3)]">{relativeDate(item.created_at)}</span><p className="mt-0.5 text-[var(--fg-1)]">{item.content}</p></div>)}
            <form onSubmit={submitComment} className="flex gap-2"><input value={comment} maxLength={300} onChange={e => setComment(e.target.value)} className="v2-input !py-2" aria-label="Write a comment" placeholder="Write a comment" /><button disabled={!comment.trim() || busy} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-white disabled:opacity-40" aria-label="Post comment"><Send size={14} /></button></form>
          </div>}
        </div>
      </div>
    </article>
  )
}

function CuratedPost({ article }: { article: NewsArticle }) {
  return <article className="border-b border-[var(--line)] bg-[var(--bg-1)] px-4 py-5 sm:px-6"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent-tint)] text-[var(--accent-strong)]"><BookOpen size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[var(--fg-0)]">{article.author_name}</strong><span className="rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-strong)]">{article.category.replace('_', ' ')}</span><span className="text-xs text-[var(--fg-3)]">{relativeDate(article.created_at)}</span></div><h2 className="mt-2 text-lg font-bold text-[var(--fg-0)]">{article.title}</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--fg-1)]">{article.content}</p>{article.image_url && <img src={article.image_url} alt="" className="mt-3 max-h-80 w-full rounded-xl object-cover" />}</div></div></article>
}

export function NewsPage() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const refreshSocial = useCallback(async () => { setPosts(await socialApi.list()) }, [])
  useEffect(() => { Promise.all([refreshSocial(), newsApi.list().then(setArticles)]).catch(err => setError(extractError(err, 'Could not load the feed.'))).finally(() => setLoading(false)) }, [refreshSocial])

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!draft.trim() || posting) return
    setPosting(true); setError('')
    try { await socialApi.create(draft.trim()); setDraft(''); await refreshSocial() } catch (err) { setError(extractError(err, 'Could not publish your post.')) } finally { setPosting(false) }
  }

  const feed = [
    ...posts.map(item => ({ kind: 'social' as const, date: item.created_at, item })),
    ...articles.map(item => ({ kind: 'article' as const, date: item.created_at, item })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return <PageLayout title="News & Updates" subtitle="Share ideas, celebrate progress, and stay connected with the BroxStudies community." width="narrow">
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] shadow-[0_14px_40px_-30px_rgba(20,37,63,.35)]">
      <form onSubmit={submit} className="border-b border-[var(--line)] p-4 sm:p-6"><div className="flex gap-3"><Avatar name="You" /><div className="flex-1"><label htmlFor="social-post" className="sr-only">Share with the community</label><textarea id="social-post" value={draft} onChange={e => setDraft(e.target.value)} maxLength={500} rows={3} className="w-full resize-none bg-transparent text-[15px] leading-6 text-[var(--fg-0)] outline-none placeholder:text-[var(--fg-3)]" placeholder="Share a study win, question, tip, or motivation..." /><div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3"><span className="text-xs text-[var(--fg-3)]">{draft.length}/500</span><Button type="submit" size="sm" disabled={!draft.trim() || posting} leading={<Send size={13} />}>{posting ? 'Posting...' : 'Post'}</Button></div></div></div></form>
      {error && <div className="m-4 rounded-lg bg-[var(--danger-tint)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      {loading ? <LoadingBlock label="Loading the community feed" icon={<Sparkles size={20} />} /> : feed.length === 0 ? <div className="p-10 text-center text-sm text-[var(--fg-2)]">Be the first to start a conversation.</div> : feed.map(entry => entry.kind === 'social' ? <CommunityPost key={`p-${entry.item.id}`} post={entry.item} onRefresh={refreshSocial} /> : <CuratedPost key={`a-${entry.item.id}-${entry.item.source}`} article={entry.item} />)}
    </section>
  </PageLayout>
}
