import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BookOpen, File, FileText, Heart, Image, Lightbulb, MessageCircle, Paperclip, Send, Share2, ShieldAlert, Sparkles, ThumbsUp, UserX, X } from 'lucide-react'
import { learningApi, newsApi, socialApi } from '@/api/endpoints'
import { extractError } from '@/api/client'
import { PageLayout } from '@/components/ui/PageLayout'
import { Button } from '@/components/ui/button'
import { LoadingBlock } from '@/components/ui/LoadingBlock'
import { useAuth } from '@/hooks/useAuth'
import type { NewsArticle, SocialComment, SocialPost, SocialReaction } from '@/api/types'

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

const Avatar = memo(function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--primary-tint)] text-xs font-bold text-[var(--primary-strong)] sm:h-10 sm:w-10 sm:text-sm">{initials || 'BS'}</span>
})

interface CommunityPostProps {
  post: SocialPost
  onReact: (postId: number, reaction: SocialReaction | null) => Promise<void>
  onComment: (postId: number, content: string) => Promise<void>
  onReport: (postId: number) => Promise<void>
  onBlock: (userId: number) => Promise<void>
}

const CommunityPost = memo(function CommunityPost({ post, onReact, onComment, onReport, onBlock }: CommunityPostProps) {
  const [comment, setComment] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [reacting, setReacting] = useState(false)
  const [commenting, setCommenting] = useState(false)

  const react = async (reaction: SocialReaction) => {
    if (reacting) return
    setReacting(true)
    try { await onReact(post.id, post.viewer_reaction === reaction ? null : reaction) } finally { setReacting(false) }
  }

  const submitComment = async (event: FormEvent) => {
    event.preventDefault()
    if (!comment.trim() || commenting) return
    const nextComment = comment.trim()
    setComment('')
    setShowComments(true)
    setCommenting(true)
    try { await onComment(post.id, nextComment) } catch { setComment(nextComment) } finally { setCommenting(false) }
  }

  const share = async () => {
    const url = `${window.location.origin}/news#post-${post.id}`
    const data = { title: `Post by ${post.author_name} on BroxStudies`, text: post.content || 'Shared from the BroxStudies community', url }
    if (navigator.share) {
      try { await navigator.share(data); return } catch (error) { if ((error as DOMException).name === 'AbortError') return }
    }
    await navigator.clipboard.writeText(`${data.text}\n${url}`)
    window.dispatchEvent(new CustomEvent('brox:toast', { detail: { message: 'Post link copied.' } }))
  }

  return (
    <article id={`post-${post.id}`} className="scroll-mt-20 border-b border-[var(--line)] bg-[var(--bg-1)] px-3 py-4 [content-visibility:auto] [contain-intrinsic-size:420px] sm:px-6 sm:py-5">
      <div className="flex gap-2.5 sm:gap-3">
        <Avatar name={post.author_name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2"><strong className="truncate text-sm text-[var(--fg-0)]">{post.author_name}</strong><span className="shrink-0 text-xs text-[var(--fg-3)]">{relativeDate(post.created_at)}</span></div>
          {post.content && <p className="mt-2 break-words whitespace-pre-wrap text-[15px] leading-6 text-[var(--fg-1)]">{post.content}</p>}
          {post.attachment_url && post.attachment_type?.startsWith('image/') && <a href={post.attachment_url} target="_blank" rel="noreferrer"><img src={post.attachment_url} alt={post.attachment_name || 'Post attachment'} loading="lazy" decoding="async" className="mt-3 max-h-[28rem] w-full rounded-xl border border-[var(--line)] object-cover" /></a>}
          {post.attachment_url && !post.attachment_type?.startsWith('image/') && <a href={post.attachment_url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-2)] p-3 text-sm font-semibold text-[var(--fg-1)] hover:border-[var(--primary)]"><FileText size={20} className="shrink-0 text-[var(--primary-strong)]" /><span className="min-w-0 flex-1 truncate">{post.attachment_name || 'Open attachment'}</span></a>}
          <div className="mt-3 flex flex-wrap items-center gap-0.5 sm:mt-4 sm:gap-2">
            {reactions.map(({ id, label, icon: Icon }) => {
              const count = id === 'like' ? post.likes : id === 'love' ? post.loves : post.insightful
              const active = post.viewer_reaction === id
              return <button type="button" key={id} disabled={reacting} onClick={() => void react(id)} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition active:scale-[.98] disabled:opacity-60 ${active ? 'bg-[var(--primary-tint)] text-[var(--primary-strong)]' : 'text-[var(--fg-2)] hover:bg-[var(--bg-2)]'}`}><Icon size={14} fill={id === 'love' && active ? 'currentColor' : 'none'} />{label}{count > 0 && <span>{count}</span>}</button>
            })}
            <button type="button" onClick={() => setShowComments(value => !value)} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--fg-2)] hover:bg-[var(--bg-2)]"><MessageCircle size={14} /> Comment {post.comments.length > 0 && post.comments.length}</button>
            <button type="button" onClick={() => void share()} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--fg-2)] hover:bg-[var(--bg-2)]"><Share2 size={14} /> Share</button>
            <button type="button" onClick={() => void onReport(post.id)} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--fg-3)] hover:text-[var(--danger)]"><ShieldAlert size={13} /> Report</button>
            <button type="button" onClick={() => void onBlock(post.user_id)} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--fg-3)] hover:text-[var(--danger)]"><UserX size={13} /> Block</button>
          </div>
          {showComments && <div className="mt-3 space-y-3 border-l-2 border-[var(--line)] pl-3 sm:mt-4">
            {post.comments.map(item => <div key={item.id} className={`text-sm ${item.id < 0 ? 'opacity-65' : ''}`}><span className="font-semibold text-[var(--fg-0)]">{item.author_name}</span><span className="ml-2 text-[var(--fg-3)]">{item.id < 0 ? 'sending…' : relativeDate(item.created_at)}</span><p className="mt-0.5 break-words text-[var(--fg-1)]">{item.content}</p></div>)}
            <form onSubmit={submitComment} className="flex min-w-0 gap-2"><input value={comment} maxLength={300} onChange={event => setComment(event.target.value)} className="v2-input min-w-0 !py-2 text-base sm:text-sm" aria-label="Write a comment" placeholder="Write a comment" /><button type="submit" disabled={!comment.trim() || commenting} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-white active:scale-95 disabled:opacity-40" aria-label="Post comment"><Send size={14} /></button></form>
          </div>}
        </div>
      </div>
    </article>
  )
})

const CuratedPost = memo(function CuratedPost({ article }: { article: NewsArticle }) {
  return <article className="border-b border-[var(--line)] bg-[var(--bg-1)] px-3 py-4 [content-visibility:auto] [contain-intrinsic-size:360px] sm:px-6 sm:py-5"><div className="flex gap-2.5 sm:gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent-tint)] text-[var(--accent-strong)] sm:h-10 sm:w-10"><BookOpen size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[var(--fg-0)]">{article.author_name}</strong><span className="rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-strong)]">{article.category.replace('_', ' ')}</span><span className="text-xs text-[var(--fg-3)]">{relativeDate(article.created_at)}</span></div><h2 className="mt-2 break-words text-lg font-bold text-[var(--fg-0)]">{article.title}</h2><p className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-[var(--fg-1)]">{article.content}</p>{article.image_url && <img src={article.image_url} alt="" loading="lazy" decoding="async" className="mt-3 max-h-80 w-full rounded-xl object-cover" />}</div></div></article>
})

export function NewsPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const refreshSocial = useCallback(async () => { setPosts(await socialApi.list()) }, [])
  useEffect(() => { Promise.all([refreshSocial(), newsApi.list().then(setArticles)]).catch(err => setError(extractError(err, 'Could not load the feed.'))).finally(() => setLoading(false)) }, [refreshSocial])

  const handleReact = useCallback(async (postId: number, reaction: SocialReaction | null) => {
    let previous: SocialPost | undefined
    setPosts(current => current.map(post => {
      if (post.id !== postId) return post
      previous = post
      const counts = { like: post.likes, love: post.loves, insightful: post.insightful }
      if (post.viewer_reaction) counts[post.viewer_reaction] = Math.max(0, counts[post.viewer_reaction] - 1)
      if (reaction) counts[reaction] += 1
      return { ...post, likes: counts.like, loves: counts.love, insightful: counts.insightful, viewer_reaction: reaction }
    }))
    try { await socialApi.react(postId, reaction) } catch (err) {
      if (previous) setPosts(current => current.map(post => post.id === postId ? previous! : post))
      setError(extractError(err, 'Could not update your reaction.'))
      throw err
    }
  }, [])

  const handleComment = useCallback(async (postId: number, content: string) => {
    const tempId = -Date.now()
    const optimistic: SocialComment = { id: tempId, user_id: user?.id ?? 0, author_name: user?.full_name || 'You', content, created_at: new Date().toISOString() }
    setPosts(current => current.map(post => post.id === postId ? { ...post, comments: [...post.comments, optimistic] } : post))
    try {
      const id = await socialApi.comment(postId, content)
      setPosts(current => current.map(post => post.id === postId ? { ...post, comments: post.comments.map(item => item.id === tempId ? { ...item, id } : item) } : post))
    } catch (err) {
      setPosts(current => current.map(post => post.id === postId ? { ...post, comments: post.comments.filter(item => item.id !== tempId) } : post))
      setError(extractError(err, 'Could not post your comment.'))
      throw err
    }
  }, [user?.full_name, user?.id])

  const handleReport = useCallback(async (postId: number) => {
    const reason = window.prompt('Why should this post be reviewed?')?.trim()
    if (!reason) return
    await learningApi.reportPost(postId, reason)
    setError('Post reported. A moderator will review it.')
    window.setTimeout(() => setError(''), 3500)
  }, [])

  const handleBlock = useCallback(async (userId: number) => {
    if (!window.confirm('Block this user and hide their posts from your feed?')) return
    await learningApi.blockUser(userId)
    setPosts(current => current.filter(post => post.user_id !== userId))
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if ((!draft.trim() && !attachment) || posting) return
    setPosting(true); setError('')
    try { await socialApi.create(draft.trim(), attachment); setDraft(''); setAttachment(null); if (fileInput.current) fileInput.current.value = ''; await refreshSocial() } catch (err) { setError(extractError(err, 'Could not publish your post.')) } finally { setPosting(false) }
  }

  const feed = useMemo(() => [
    ...posts.map(item => ({ kind: 'social' as const, date: item.created_at, item })),
    ...articles.map(item => ({ kind: 'article' as const, date: item.created_at, item })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [articles, posts])

  return <PageLayout title="News & Updates" subtitle="Share ideas, celebrate progress, and stay connected with the BroxStudies community." width="narrow" className="!px-0 sm:!px-6 lg:!px-8" headerClassName="px-4 sm:px-0">
    <section className="overflow-hidden border-y border-[var(--line)] bg-[var(--bg-1)] sm:rounded-2xl sm:border sm:shadow-[0_14px_40px_-30px_rgba(20,37,63,.35)]">
      <form onSubmit={submit} className="border-b border-[var(--line)] p-3 sm:p-6"><div className="flex gap-2.5 sm:gap-3"><Avatar name={user?.full_name || 'You'} /><div className="min-w-0 flex-1"><label htmlFor="social-post" className="sr-only">Share with the community</label><textarea id="social-post" value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} rows={3} className="w-full resize-none bg-transparent text-base leading-6 text-[var(--fg-0)] outline-none placeholder:text-[var(--fg-3)] sm:text-[15px]" placeholder="Share a study win, question, tip, or motivation…" />{attachment && <div className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--bg-2)] px-3 py-2 text-xs text-[var(--fg-1)]">{attachment.type.startsWith('image/') ? <Image size={15} /> : <File size={15} />}<span className="min-w-0 flex-1 truncate">{attachment.name}</span><button type="button" onClick={() => { setAttachment(null); if (fileInput.current) fileInput.current.value = '' }} aria-label="Remove attachment"><X size={14} /></button></div>}<div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3"><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,.pdf,.doc,.docx" className="sr-only" onChange={event => { const file = event.target.files?.[0] || null; if (file && file.size > 10 * 1024 * 1024) { setError('Attachments must be 10 MB or smaller.'); event.target.value = ''; return } setError(''); setAttachment(file) }} /><button type="button" onClick={() => fileInput.current?.click()} className="flex min-h-9 min-w-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--fg-2)] hover:bg-[var(--bg-2)]"><Paperclip size={14} className="shrink-0" /><span className="truncate">Add file</span></button><span className="ml-auto hidden text-xs text-[var(--fg-3)] sm:inline">{draft.length}/500</span><Button type="submit" size="sm" disabled={(!draft.trim() && !attachment) || posting} leading={<Send size={13} />}>{posting ? 'Posting…' : 'Post'}</Button></div></div></div></form>
      {error && <div className="m-3 rounded-lg bg-[var(--danger-tint)] px-3 py-2 text-sm text-[var(--danger)] sm:m-4">{error}</div>}
      {loading ? <LoadingBlock label="Loading the community feed" icon={<Sparkles size={20} />} /> : feed.length === 0 ? <div className="p-10 text-center text-sm text-[var(--fg-2)]">Be the first to start a conversation.</div> : feed.map(entry => entry.kind === 'social' ? <CommunityPost key={`p-${entry.item.id}`} post={entry.item} onReact={handleReact} onComment={handleComment} onReport={handleReport} onBlock={handleBlock} /> : <CuratedPost key={`a-${entry.item.id}-${entry.item.source}`} article={entry.item} />)}
    </section>
  </PageLayout>
}
