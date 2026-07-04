import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen, Search, Grid3X3, List, ChevronRight, Star,
  ExternalLink, BookMarked, X, CheckCircle2, XCircle, Bookmark, Clock,
} from 'lucide-react'
import { useLibraryProgress } from '@/hooks/useLibraryProgress'
import { Progress } from '@/components/ui/progress'
import { extractError } from '@/api/client'
import { libraryApi } from '@/api/endpoints'
import { PageLayout } from '@/components/ui/PageLayout'
import { FilterChips } from '@/components/ui/FilterChips'
import { LoadingBlock } from '@/components/ui/LoadingBlock'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/input'
import type { Book, BookQuizQuestion } from '@/api/types'

/* ── Local catalog (merged with remote OpenLibrary results) ── */
const MOCK_BOOKS: Book[] = [
  {
    id: 'ghanaian-beautyful-ones',
    title: 'The Beautyful Ones Are Not Yet Born',
    author: 'Ayi Kwei Armah',
    category: 'ghanaian',
    rating: 4.8,
    description: 'A powerful Ghanaian novel about corruption, dignity, and post-independence life in Accra. One of West Africa\'s most celebrated literary works.',
    pages: 277,
    isbn: '9780141187806',
    source: 'Ghanaian Classics',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780141187806-M.jpg',
  },
  {
    id: 'ghanaian-anansi-stories',
    title: 'Anansi Stories from Ghana',
    author: 'Traditional',
    category: 'storybook',
    rating: 4.8,
    description: 'Beloved Ghanaian folk tales with wisdom, magic, and playful characters. Anansi the spider teaches cunning, wit, and moral lessons to generations.',
    pages: 180,
    isbn: '9780143507185',
    source: 'Folklore',
  },
  {
    id: 'ghanaian-entrepreneurship',
    title: 'Entrepreneurship for Young Ghanaians',
    author: 'Ama K. Oppong',
    category: 'entrepreneur',
    rating: 4.4,
    description: 'A practical guide to starting and growing a small business in Ghana. Covers planning, finance, marketing, and leadership for young founders.',
    pages: 240,
    isbn: '9789988776655',
    source: 'Business Guide',
  },
  {
    id: 'ghanaian-maths-shs',
    title: 'Basic Mathematics for SHS',
    author: 'Dr. Isaac K. Mensah',
    category: 'subject',
    rating: 4.7,
    description: 'A student-friendly mathematics guide covering algebra, geometry, and exam practice. Designed specifically for Ghana SHS curriculum.',
    pages: 384,
    isbn: '9789988776600',
    source: 'SHS Textbook',
  },
  {
    id: 'ghanaian-things-fall-apart',
    title: 'Things Fall Apart',
    author: 'Chinua Achebe',
    category: 'african',
    rating: 4.9,
    description: 'A classic African novel that explores culture, colonial change, and tradition. One of the most widely read African novels of all time.',
    pages: 209,
    isbn: '9780141180283',
    source: 'African Literature',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780141180283-M.jpg',
  },
  {
    id: 'novel-half-of-a-yellow-sun',
    title: 'Half of a Yellow Sun',
    author: 'Chimamanda Ngozi Adichie',
    category: 'african',
    rating: 4.8,
    description: 'A moving historical novel about love, war, and hope set during the Nigerian civil war. Winner of the Orange Prize for Fiction.',
    pages: 433,
    isbn: '9780393328465',
    source: 'Modern African Fiction',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780393328465-M.jpg',
  },
  {
    id: 'entrepreneur-lean-startup',
    title: 'The Lean Startup',
    author: 'Eric Ries',
    category: 'entrepreneur',
    rating: 4.6,
    description: 'A startup playbook for building companies with fast experimentation and customer focus. Essential reading for young entrepreneurs.',
    pages: 320,
    isbn: '9780307887894',
    source: 'Global Business',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780307887894-M.jpg',
  },
  {
    id: 'storybook-little-prince',
    title: 'The Little Prince',
    author: 'Antoine de Saint-Exupéry',
    category: 'storybook',
    rating: 4.9,
    description: 'A timeless story about imagination, friendship, and the lessons of childhood. One of the best-selling books in history.',
    pages: 96,
    isbn: '9780156012195',
    source: 'Children\'s Classics',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780156012195-M.jpg',
  },
  {
    id: 'global-alchemist',
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    category: 'novel',
    rating: 4.7,
    description: 'A shepherd boy travels from Spain to Egypt following his dream. A spiritual adventure about destiny and self-discovery.',
    pages: 208,
    isbn: '9780061122415',
    source: 'Global Classics',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780061122415-M.jpg',
  },
  {
    id: 'global-atomic-habits',
    title: 'Atomic Habits',
    author: 'James Clear',
    category: 'entrepreneur',
    rating: 4.8,
    description: 'Small changes lead to remarkable results. A practical guide to building good habits and breaking bad ones.',
    pages: 320,
    isbn: '9780735211292',
    source: 'Personal Development',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780735211292-M.jpg',
  },
]

const CATEGORIES = [
  { value: 'all', label: 'All Books', icon: BookOpen },
  { value: 'novel', label: 'Novels' },
  { value: 'storybook', label: 'Story Books' },
  { value: 'entrepreneur', label: 'Entrepreneur' },
  { value: 'subject', label: 'Subject Books' },
  { value: 'african', label: 'African Books' },
  { value: 'ghanaian', label: 'Ghanaian Books' },
]

/* ── Quiz types ── */
interface ActiveQuiz {
  questions: BookQuizQuestion[]
  answers: Record<number, string>
  submitted: boolean
}

/* ── Book cover with fallback ── */
function BookCover({ book, size = 'md' }: { book: Book; size?: 'sm' | 'md' | 'lg' }) {
  const [imgError, setImgError] = useState(false)
  const sizeClass = size === 'sm'
    ? 'h-16 w-12'
    : size === 'lg'
      ? 'h-48 w-36'
      : 'h-32 w-24'

  if (book.cover_url && !imgError) {
    return (
      <img
        src={book.cover_url}
        alt={`${book.title} cover`}
        onError={() => setImgError(true)}
        className={`${sizeClass} flex-shrink-0 rounded-lg object-cover shadow-md`}
      />
    )
  }

  // Color-coded fallback based on category
  const gradients: Record<string, string> = {
    ghanaian: 'from-amber-200 to-amber-400',
    african: 'from-rose-400 to-rose-600',
    novel: 'from-indigo-300 to-indigo-500',
    storybook: 'from-purple-300 to-purple-500',
    entrepreneur: 'from-emerald-300 to-emerald-500',
    subject: 'from-[var(--info-tint)] to-[var(--info)]',
  }
  const grad = gradients[book.category] || 'from-emerald-300 to-emerald-500'

  return (
    <div className={`${sizeClass} flex-shrink-0 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm`}>
      <BookOpen size={size === 'sm' ? 16 : size === 'lg' ? 40 : 28} className="text-white/80" />
    </div>
  )
}

/* ── External read links ── */
function getReadLinks(book: Book): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = []

  if (book.id.startsWith('openlib:')) {
    const key = book.id.replace('openlib:', '')
    links.push({
      label: 'Read on OpenLibrary',
      url: `https://openlibrary.org${key.startsWith('/') ? key : '/' + key}`,
    })
  }

  if (book.isbn) {
    links.push({
      label: 'Find on Archive.org',
      url: `https://archive.org/search?query=${encodeURIComponent(book.title + ' ' + book.author)}&mediatype=texts`,
    })
  }

  links.push({
    label: 'Search on Google Books',
    url: `https://books.google.com/books?q=${encodeURIComponent(book.title + ' ' + book.author)}`,
  })

  return links
}

/* ── In-browser reader component ── */
function BookReader({ book, onClose }: { book: Book; onClose: () => void }) {
  const readLinks = getReadLinks(book)
  const [quiz, setQuiz] = useState<ActiveQuiz | null>(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizError, setQuizError] = useState('')
  const [excerpt, setExcerpt] = useState<string | null>(null)
  const [excerptLoading, setExcerptLoading] = useState(false)

  useEffect(() => {
    setExcerpt(null)
    setExcerptLoading(true)
    libraryApi.excerpt(book.id)
      .then(data => setExcerpt(data.excerpt ?? null))
      .catch(() => setExcerpt(null))
      .finally(() => setExcerptLoading(false))
  }, [book.id])

  const handleTakeQuiz = async () => {
    setQuizLoading(true)
    setQuizError('')
    try {
      const resp = await libraryApi.quiz({ book_id: book.id, num_questions: 5 })
      setQuiz({ questions: resp.questions, answers: {}, submitted: false })
    } catch (err) {
      setQuizError(extractError(err, 'Failed to load quiz. Please try again.'))
    } finally {
      setQuizLoading(false)
    }
  }

  const handleQuizAnswer = (qi: number, answer: string) => {
    if (!quiz || quiz.submitted) return
    setQuiz(prev => prev ? { ...prev, answers: { ...prev.answers, [qi]: answer } } : prev)
  }

  const handleQuizSubmit = () => {
    setQuiz(prev => prev ? { ...prev, submitted: true } : prev)
  }

  const quizScore = quiz?.submitted
    ? quiz.questions.filter((q, i) =>
        q.answer && quiz.answers[i]?.toLowerCase().trim() === q.answer.toLowerCase().trim()
      ).length
    : 0

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 px-4 py-6">
      <div className="mx-auto w-full max-w-2xl rounded-3xl bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-input p-6">
          <div className="flex gap-4">
            <BookCover book={book} size="md" />
            <div>
              <h2 className="text-xl font-bold text-foreground">{book.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{book.author}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                <span className="font-semibold">{book.rating}</span>
                {book.pages && <span>· {book.pages} pages</span>}
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 capitalize">
                  {book.category === 'entrepreneur' ? 'Business' : book.category}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="v2-btn v2-btn-ghost !h-9 !w-9 !p-0 rounded-full" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Description / Summary */}
        <div className="p-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">About this book</h3>
          <p className="text-sm leading-7 text-foreground">{book.description}</p>

          {/* Gutenberg excerpt */}
          {excerptLoading && (
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
              Fetching reading excerpt…
            </div>
          )}
          {excerpt && !excerptLoading && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/50 dark:bg-emerald-900/20">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Reading Excerpt (Project Gutenberg)
              </p>
              <div className="max-h-48 overflow-y-auto rounded-xl bg-[var(--bg-1)] p-4 text-sm leading-7 text-[var(--fg-0)] whitespace-pre-wrap font-serif">
                {excerpt}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Public domain excerpt. Continue reading via the links below.
              </p>
            </div>
          )}

          {/* Read online links */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Read this book</h3>
            <div className="flex flex-wrap gap-2">
              {readLinks.map(link => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                >
                  <ExternalLink size={12} />
                  {link.label}
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Opens in a new tab. Public domain books are freely available; copyrighted books require library access or purchase.
            </p>
          </div>

          {/* Quiz section */}
          <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--bg-2)] p-4">
            {!quiz ? (
              <div className="text-center">
                <BookMarked size={28} className="mx-auto mb-2 text-emerald-600" />
                <h3 className="font-semibold text-foreground">Reading Comprehension Quiz</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Test your understanding of this book after reading.
                </p>
                {quizError && (
                  <p className="mt-2 text-xs text-rose-600">{quizError}</p>
                )}
                <button
                  type="button"
                  onClick={handleTakeQuiz}
                  disabled={quizLoading}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {quizLoading ? 'Loading quiz…' : 'Take Reading Quiz'}
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Reading Quiz</h3>
                  {quiz.submitted && (
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${
                      quizScore >= quiz.questions.length * 0.7
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {quizScore}/{quiz.questions.length} correct
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {quiz.questions.map((q, qi) => {
                    const userAnswer = quiz.answers[qi]
                    const isCorrect = quiz.submitted && q.answer &&
                      userAnswer?.toLowerCase().trim() === q.answer.toLowerCase().trim()
                    const isWrong = quiz.submitted && userAnswer && !isCorrect

                    return (
                      <div key={qi} className={`rounded-xl border p-4 ${
                        quiz.submitted
                          ? isCorrect ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/20' :
                            isWrong ? 'border-rose-200 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-900/20' : 'border-[var(--line)] bg-[var(--bg-1)]'
                          : 'border-[var(--line)] bg-[var(--bg-1)]'
                      }`}>
                        <p className="text-sm font-semibold text-foreground">
                          {qi + 1}. {q.question}
                        </p>

                        {q.options?.length ? (
                          <div className="mt-3 space-y-2">
                            {q.options.map((opt, oi) => {
                              const isSelected = userAnswer === opt
                              const isAnswer = quiz.submitted && q.answer === opt
                              return (
                                <button
                                  key={oi}
                                  type="button"
                                  disabled={quiz.submitted}
                                  onClick={() => handleQuizAnswer(qi, opt)}
                                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition text-[var(--fg-0)] ${
                                    isAnswer && quiz.submitted
                                      ? 'border-emerald-500 bg-emerald-100 font-semibold text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300'
                                      : isSelected && !quiz.submitted
                                        ? 'border-emerald-500 bg-emerald-50 font-semibold dark:bg-emerald-900/20'
                                        : isSelected && isWrong
                                          ? 'border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-400'
                                          : 'border-[var(--line)] bg-[var(--bg-1)] hover:border-emerald-300'
                                  }`}
                                >
                                  {quiz.submitted && isAnswer && <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />}
                                  {quiz.submitted && isSelected && isWrong && <XCircle size={14} className="shrink-0 text-rose-500" />}
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="mt-3">
                            <input
                              type="text"
                              value={userAnswer || ''}
                              onChange={e => handleQuizAnswer(qi, e.target.value)}
                              disabled={quiz.submitted}
                              placeholder="Type your answer…"
                              className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--fg-0)] placeholder:text-[var(--fg-3)] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-[var(--bg-2)] disabled:opacity-70"
                            />
                            {quiz.submitted && q.answer && (
                              <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 size={12} /> Expected: {q.answer}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {!quiz.submitted && (
                  <button
                    type="button"
                    onClick={handleQuizSubmit}
                    className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Submit quiz
                  </button>
                )}
                {quiz.submitted && (
                  <button
                    type="button"
                    onClick={() => setQuiz(null)}
                    className="mt-4 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-5 py-2.5 text-sm font-semibold text-[var(--fg-0)] hover:bg-[var(--bg-2)]"
                  >
                    Take another quiz
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function LibraryPage() {
  const [books, setBooks] = useState<Book[]>(MOCK_BOOKS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { recent, bookmarks, openBook, toggleBookmark, isBookmarked, getProgress } = useLibraryProgress()

  const filteredLocalBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return MOCK_BOOKS.filter(book => {
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'african') {
          if (!['african', 'ghanaian'].includes(book.category)) return false
        } else if (selectedCategory === 'ghanaian') {
          if (book.category !== 'ghanaian') return false
        } else if (book.category !== selectedCategory) {
          return false
        }
      }
      if (!query) return true
      return [book.title, book.author, book.description, book.category, book.source]
        .filter(Boolean)
        .some(v => (v as string).toLowerCase().includes(query))
    })
  }, [searchQuery, selectedCategory])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await libraryApi.search(searchQuery, selectedCategory)
        if (active) setBooks(data)
      } catch (err) {
        if (active) {
          setError(extractError(err, 'Could not reach the online library. Showing local results.'))
          setBooks(filteredLocalBooks)
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 350)
    return () => { active = false; window.clearTimeout(timer) }
  }, [searchQuery, selectedCategory, filteredLocalBooks])

  const handleOpenBook = (book: Book) => {
    openBook(book.id, book.title, book.author, getProgress(book.id))
    setSelectedBook(book)
  }
  const closeBook = () => setSelectedBook(null)

  return (
    <PageLayout
      eyebrow="Prep"
      title="Digital Library"
      subtitle="Browse Ghanaian classics, global bestsellers, and study guides. Read online or take a comprehension quiz."
      width="wide"
      noHeaderBorder
    >
      {/* Continue reading & bookmarks */}
      {(recent.length > 0 || bookmarks.length > 0) && (
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {recent.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock size={14} /> Continue Reading
              </h2>
              <div className="space-y-2">
                {recent.map(item => {
                  const book = books.find(b => b.id === item.bookId) || MOCK_BOOKS.find(b => b.id === item.bookId)
                  if (!book) return null
                  return (
                    <button
                      key={item.bookId}
                      onClick={() => handleOpenBook(book)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-indigo-500/30"
                    >
                      <BookCover book={book} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <Progress value={item.progress} className="mt-2" />
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
            </section>
          )}
          {bookmarks.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Bookmark size={14} className="fill-current text-amber-400" /> Bookmarks
              </h2>
              <div className="flex flex-wrap gap-2">
                {bookmarks.map(item => {
                  const book = books.find(b => b.id === item.bookId) || MOCK_BOOKS.find(b => b.id === item.bookId)
                  if (!book) return null
                  return (
                    <button
                      key={item.bookId}
                      onClick={() => handleOpenBook(book)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-indigo-500/30"
                    >
                      {item.title}
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" size={18} />
        <Input
          type="text"
          placeholder="Search by title, author, subject, or keyword…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-11"
        />
      </div>

      <FilterChips
        className="mt-6"
        items={CATEGORIES.map(cat => ({ id: cat.value, label: cat.label }))}
        value={selectedCategory}
        onChange={setSelectedCategory}
      />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{books.length}</span> books
          {error && <span className="ml-2 text-amber-600 text-xs">(offline — local results only)</span>}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-lg p-2 ${viewMode === 'grid' ? 'bg-indigo-500/15 text-indigo-400' : 'border border-input text-muted-foreground hover:bg-background'}`}
          >
            <Grid3X3 size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-lg p-2 ${viewMode === 'list' ? 'bg-indigo-500/15 text-indigo-400' : 'border border-input text-muted-foreground hover:bg-background'}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <LoadingBlock label="Searching library…" icon={<BookOpen size={22} />} />
        ) : books.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={22} />}
            title="No books found"
            body="Try a different keyword or category — we search local favorites and OpenLibrary."
          />
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {books.map(book => (
              <div key={book.id} className="group relative">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); toggleBookmark(book.id, book.title, book.author) }}
                  className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-card/90 text-muted-foreground transition hover:text-amber-400"
                  aria-label="Bookmark"
                >
                  <Bookmark size={14} className={isBookmarked(book.id) ? 'fill-amber-400 text-amber-400' : ''} />
                </button>
                <button
                onClick={() => handleOpenBook(book)}
                className="group w-full rounded-2xl border border-input bg-card p-4 text-left transition hover:border-indigo-500/30 hover:shadow-glow-sm"
              >
                <div className="mb-4 flex justify-center">
                  <BookCover book={book} size="md" />
                </div>
                <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-indigo-400">{book.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{book.author}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    <span className="text-xs font-semibold text-foreground">{book.rating}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{book.pages ?? '—'} pages</span>
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 group-hover:gap-2">
                  Open book <ChevronRight size={14} />
                </div>
              </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {books.map(book => (
              <button
                key={book.id}
                onClick={() => handleOpenBook(book)}
                className="w-full rounded-2xl border border-input bg-card p-4 text-left transition hover:border-indigo-500/30 hover:bg-indigo-500/5"
              >
                <div className="flex gap-4">
                  <BookCover book={book} size="sm" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{book.title}</h3>
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{book.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        <span className="font-semibold">{book.rating}</span>
                      </div>
                      <span className="text-muted-foreground">{book.pages ?? '—'} pages</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 capitalize">
                        {book.category === 'entrepreneur' ? 'Business' : book.category}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="flex-shrink-0 self-center text-indigo-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedBook && (
        <BookReader book={selectedBook} onClose={closeBook} />
      )}
    </PageLayout>
  )
}
