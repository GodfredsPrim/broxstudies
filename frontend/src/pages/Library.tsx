import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen, Search, Grid3X3, List, ChevronRight, Star,
  ExternalLink, BookMarked, X, CheckCircle2, XCircle,
} from 'lucide-react'
import { extractError } from '@/api/client'
import { libraryApi } from '@/api/endpoints'
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
    african: 'from-orange-200 to-red-300',
    novel: 'from-blue-200 to-indigo-300',
    storybook: 'from-pink-200 to-rose-300',
    entrepreneur: 'from-emerald-200 to-teal-300',
    subject: 'from-violet-200 to-purple-300',
  }
  const grad = gradients[book.category] || 'from-emerald-100 to-blue-100'

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
                <Star size={12} className="fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{book.rating}</span>
                {book.pages && <span>· {book.pages} pages</span>}
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 capitalize">
                  {book.category === 'entrepreneur' ? 'Business' : book.category}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 hover:bg-slate-200">
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
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Reading Excerpt (Project Gutenberg)
              </p>
              <div className="max-h-48 overflow-y-auto rounded-xl bg-white p-4 text-sm leading-7 text-foreground whitespace-pre-wrap font-serif">
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
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
          <div className="mt-6 rounded-2xl border border-input bg-slate-50 p-4">
            {!quiz ? (
              <div className="text-center">
                <BookMarked size={28} className="mx-auto mb-2 text-emerald-600" />
                <h3 className="font-semibold text-foreground">Reading Comprehension Quiz</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Test your understanding of this book after reading.
                </p>
                {quizError && (
                  <p className="mt-2 text-xs text-red-600">{quizError}</p>
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
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
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
                          ? isCorrect ? 'border-emerald-200 bg-emerald-50' :
                            isWrong ? 'border-red-200 bg-red-50' : 'border-input'
                          : 'border-input bg-white'
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
                                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                                    isAnswer && quiz.submitted
                                      ? 'border-emerald-500 bg-emerald-100 font-semibold text-emerald-900'
                                      : isSelected && !quiz.submitted
                                        ? 'border-emerald-500 bg-emerald-50 font-semibold'
                                        : isSelected && isWrong
                                          ? 'border-red-400 bg-red-50 text-red-800'
                                          : 'border-input bg-white hover:border-emerald-300'
                                  }`}
                                >
                                  {quiz.submitted && isAnswer && <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />}
                                  {quiz.submitted && isSelected && isWrong && <XCircle size={14} className="shrink-0 text-red-500" />}
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
                              className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
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
                    className="mt-4 w-full rounded-2xl border border-input bg-white px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-slate-50"
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

  const openBook = (book: Book) => setSelectedBook(book)
  const closeBook = () => setSelectedBook(null)

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
      <div className="mt-6">
        <h1 className="text-3xl font-black text-foreground">Digital Library</h1>
        <p className="mt-2 text-muted-foreground">
          Browse Ghanaian classics, global bestsellers, and study guides. Read online or take a comprehension quiz to deepen your understanding.
        </p>
      </div>

      <div className="mt-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input
            type="text"
            placeholder="Search by title, author, subject, or keyword…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-input bg-background pl-12 pr-4 py-3 text-sm text-foreground shadow-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selectedCategory === cat.value
                ? 'bg-emerald-600 text-white'
                : 'border border-input bg-background text-foreground hover:border-emerald-300'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{books.length}</span> books
          {error && <span className="ml-2 text-amber-600 text-xs">(offline — local results only)</span>}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-lg p-2 ${viewMode === 'grid' ? 'bg-emerald-100 text-emerald-700' : 'border border-input text-muted-foreground hover:bg-background'}`}
          >
            <Grid3X3 size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-lg p-2 ${viewMode === 'list' ? 'bg-emerald-100 text-emerald-700' : 'border border-input text-muted-foreground hover:bg-background'}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
            <p className="mt-4 text-muted-foreground">Searching library…</p>
          </div>
        ) : books.length === 0 ? (
          <div className="rounded-3xl border border-input bg-card p-12 text-center">
            <BookOpen size={48} className="mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No books found. Try a different keyword or category.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {books.map(book => (
              <button
                key={book.id}
                onClick={() => openBook(book)}
                className="group rounded-2xl border border-input bg-card p-4 text-left transition hover:border-emerald-300 hover:shadow-lg"
              >
                <div className="mb-4 flex justify-center">
                  <BookCover book={book} size="md" />
                </div>
                <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-emerald-600">{book.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{book.author}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-semibold text-foreground">{book.rating}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{book.pages ?? '—'} pages</span>
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 group-hover:gap-2">
                  Open book <ChevronRight size={14} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {books.map(book => (
              <button
                key={book.id}
                onClick={() => openBook(book)}
                className="w-full rounded-2xl border border-input bg-card p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/30"
              >
                <div className="flex gap-4">
                  <BookCover book={book} size="sm" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{book.title}</h3>
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{book.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Star size={12} className="fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{book.rating}</span>
                      </div>
                      <span className="text-muted-foreground">{book.pages ?? '—'} pages</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 capitalize">
                        {book.category === 'entrepreneur' ? 'Business' : book.category}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="flex-shrink-0 self-center text-emerald-600" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedBook && (
        <BookReader book={selectedBook} onClose={closeBook} />
      )}
    </div>
  )
}
