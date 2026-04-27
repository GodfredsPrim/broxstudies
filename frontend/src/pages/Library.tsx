import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Search, Grid3X3, List, ChevronRight, Star, ArrowLeft } from 'lucide-react'
import { extractError } from '@/api/client'
import { libraryApi } from '@/api/endpoints'
import type { Book, BookQuizQuestion } from '@/api/types'

const MOCK_BOOKS: Book[] = [
  {
    id: 'ghanaian-beautyful-ones',
    title: 'The Beautyful Ones Are Not Yet Born',
    author: 'Ayi Kwei Armah',
    category: 'ghanaian',
    rating: 4.8,
    description: 'A powerful Ghanaian novel about corruption, dignity, and post-independence life in Accra.',
    pages: 277,
    isbn: '9780141187806',
    source: 'Ghanaian Classics',
  },
  {
    id: 'ghanaian-anansi-stories',
    title: 'Anansi Stories from Ghana',
    author: 'Traditional',
    category: 'storybook',
    rating: 4.8,
    description: 'Beloved Ghanaian folk tales with wisdom, magic, and playful characters.',
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
    description: 'A practical guide to starting and growing a small business in Ghana.',
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
    description: 'A student-friendly mathematics guide covering algebra, geometry, and exam practice.',
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
    description: 'A classic African novel that explores culture, colonial change, and tradition.',
    pages: 209,
    isbn: '9780141180283',
    source: 'African Literature',
  },
  {
    id: 'novel-half-of-a-yellow-sun',
    title: 'Half of a Yellow Sun',
    author: 'Chimamanda Ngozi Adichie',
    category: 'african',
    rating: 4.8,
    description: 'A moving historical novel about love, war, and hope in Nigeria.',
    pages: 433,
    isbn: '9780393328465',
    source: 'Modern African Fiction',
  },
  {
    id: 'entrepreneur-lean-startup',
    title: 'The Lean Startup',
    author: 'Eric Ries',
    category: 'entrepreneur',
    rating: 4.6,
    description: 'A startup playbook for building companies with fast experimentation and customer focus.',
    pages: 320,
    isbn: '9780307887894',
    source: 'Global Business',
  },
  {
    id: 'storybook-little-prince',
    title: 'The Little Prince',
    author: 'Antoine de Saint-Exupéry',
    category: 'storybook',
    rating: 4.9,
    description: 'A timeless story about imagination, friendship, and the lessons of childhood.',
    pages: 96,
    isbn: '9780156012195',
    source: 'Children’s Classics',
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

export function LibraryPage() {
  const [books, setBooks] = useState<Book[]>(MOCK_BOOKS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quizQuestions, setQuizQuestions] = useState<BookQuizQuestion[]>([])
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizError, setQuizError] = useState<string | null>(null)

  const filteredLocalBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return MOCK_BOOKS.filter((book) => {
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
        .some((value) => (value as string).toLowerCase().includes(query))
    })
  }, [searchQuery, selectedCategory])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await libraryApi.search(searchQuery, selectedCategory)
        if (active) {
          setBooks(data)
        }
      } catch (err) {
        if (active) {
          setError(extractError(err, 'Unable to search the library.'))
          setBooks(filteredLocalBooks)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchQuery, selectedCategory, filteredLocalBooks])

  const selectBook = (book: Book) => {
    setSelectedBook(book)
    setIsReading(true)
    setQuizQuestions([])
    setQuizError(null)
  }

  const closeModal = () => {
    setSelectedBook(null)
    setIsReading(false)
    setQuizQuestions([])
    setQuizError(null)
  }

  const handleTakeQuiz = async () => {
    if (!selectedBook) return

    setQuizLoading(true)
    setQuizError(null)
    setQuizQuestions([])

    try {
      const response = await libraryApi.quiz({ book_id: selectedBook.id, num_questions: 4 })
      setQuizQuestions(response.questions)
    } catch (err) {
      setQuizError(extractError(err, 'Failed to load reading quiz.'))
    } finally {
      setQuizLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 sm:px-8 lg:px-12">
      <div className="mt-6">
        <h1 className="text-3xl font-black text-foreground">Digital Library</h1>
        <p className="mt-2 text-muted-foreground">
          Browse a premium global library powered by local favorites and OpenLibrary discovery. Find Ghanaian classics, global bestsellers, study guides, and post-reading quizzes.
        </p>
      </div>

      <div className="mt-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input
            type="text"
            placeholder="Search by title, author, subject, or Ghanaian author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-input bg-background pl-12 pr-4 py-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2 sm:gap-3">
        {CATEGORIES.map((cat) => (
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

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{books.length}</span> books
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-lg p-2 ${
              viewMode === 'grid'
                ? 'bg-emerald-100 text-emerald-700'
                : 'border border-input text-muted-foreground hover:bg-background'
            }`}
          >
            <Grid3X3 size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-lg p-2 ${
              viewMode === 'list'
                ? 'bg-emerald-100 text-emerald-700'
                : 'border border-input text-muted-foreground hover:bg-background'
            }`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="mt-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600"></div>
            <p className="mt-4 text-muted-foreground">Searching library...</p>
          </div>
        ) : books.length === 0 ? (
          <div className="rounded-3xl border border-input bg-card p-12 text-center">
            <BookOpen size={48} className="mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No books found. Try a new keyword, category, or broaden your search.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => (
              <button
                key={book.id}
                onClick={() => selectBook(book)}
                className="group rounded-2xl border border-input bg-card p-4 text-left transition hover:border-emerald-300 hover:shadow-lg"
              >
                <div className="aspect-video rounded-xl bg-gradient-to-br from-emerald-100 to-blue-100 flex items-center justify-center mb-4">
                  <BookOpen size={32} className="text-emerald-600" />
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
            {books.map((book) => (
              <button
                key={book.id}
                onClick={() => selectBook(book)}
                className="w-full rounded-2xl border border-input bg-card p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <div className="flex gap-4">
                  <div className="h-20 w-16 flex-shrink-0 rounded-lg bg-gradient-to-br from-emerald-100 to-blue-100 flex items-center justify-center">
                    <BookOpen size={24} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{book.title}</h3>
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{book.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Star size={12} className="fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{book.rating}</span>
                      </div>
                      <span className="text-muted-foreground">{book.pages ?? '—'} pages</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700 capitalize">
                        {book.category === 'entrepreneur' ? 'Business' : book.category}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="flex-shrink-0 text-emerald-600" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-2xl rounded-3xl bg-background p-8 shadow-2xl">
            <div className="flex flex-col gap-6 sm:flex-row">
              <div className="h-40 w-full sm:w-32 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-100 to-blue-100 flex items-center justify-center">
                <BookOpen size={48} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{selectedBook.title}</h2>
                    <p className="mt-1 text-lg text-muted-foreground">{selectedBook.author}</p>
                  </div>
                  <div className="rounded-3xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    {selectedBook.source ?? 'Library'}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Star size={16} className="fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold text-foreground">{selectedBook.rating}</span>
                  </div>
                  <span className="text-muted-foreground">{selectedBook.pages ?? '—'} pages</span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700 capitalize">
                    {selectedBook.category === 'entrepreneur' ? 'Business' : selectedBook.category}
                  </span>
                </div>
                <p className="mt-4 text-sm text-foreground">{selectedBook.description}</p>
                {selectedBook.isbn && (
                  <p className="mt-2 text-xs text-muted-foreground">ISBN: {selectedBook.isbn}</p>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setIsReading(true)}
                className="rounded-2xl border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-slate-50"
              >
                Open & Read
              </button>
              <button
                type="button"
                onClick={handleTakeQuiz}
                disabled={quizLoading}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {quizLoading ? 'Preparing quiz…' : 'Take Reading Quiz'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReading(false)
                  setQuizQuestions([])
                  setQuizError(null)
                }}
                className="rounded-2xl border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-slate-50"
              >
                {isReading ? 'Back to details' : 'Read summary'}
              </button>
            </div>

            {isReading && (
              <div className="mt-6 rounded-3xl border border-input bg-slate-50 p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <ArrowLeft size={16} />
                  <span>Reading mode enabled — review the details and tap the quiz button when ready.</span>
                </div>
                <p className="text-sm leading-6 text-foreground">{selectedBook.description}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Category</p>
                    <p className="mt-1 font-semibold text-foreground">{selectedBook.category === 'entrepreneur' ? 'Business' : selectedBook.category}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Source</p>
                    <p className="mt-1 font-semibold text-foreground">{selectedBook.source ?? 'Library'}</p>
                  </div>
                </div>
              </div>
            )}

            {quizError && (
              <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                {quizError}
              </div>
            )}

            {quizQuestions.length > 0 && (
              <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-foreground">Reading Quiz</h3>
                <p className="mt-2 text-sm text-muted-foreground">Use these questions to check your understanding after reading.</p>
                <div className="mt-4 space-y-4">
                  {quizQuestions.map((question, index) => (
                    <div key={`${question.question}-${index}`} className="rounded-3xl border border-input p-4">
                      <p className="font-semibold text-foreground">{index + 1}. {question.question}</p>
                      {question.options && (
                        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                          {question.options.map((option) => (
                            <li key={option} className="rounded-2xl bg-slate-50 px-3 py-2">
                              {option}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-full bg-slate-100 p-2 text-sm hover:bg-slate-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
