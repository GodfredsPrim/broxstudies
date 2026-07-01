import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'brox.library'

export interface BookProgress {
  bookId: string
  title: string
  author: string
  progress: number
  lastOpened: string
  bookmarked: boolean
}

interface LibraryState {
  books: Record<string, BookProgress>
}

function load(): LibraryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* noop */ }
  return { books: {} }
}

function save(state: LibraryState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useLibraryProgress() {
  const [state, setState] = useState<LibraryState>(load)

  useEffect(() => {
    setState(load())
  }, [])

  const openBook = useCallback((bookId: string, title: string, author: string, progress = 0) => {
    setState(prev => {
      const existing = prev.books[bookId]
      const next: LibraryState = {
        books: {
          ...prev.books,
          [bookId]: {
            bookId,
            title,
            author,
            progress: Math.max(progress, existing?.progress ?? 0),
            lastOpened: new Date().toISOString(),
            bookmarked: existing?.bookmarked ?? false,
          },
        },
      }
      save(next)
      return next
    })
  }, [])

  const updateProgress = useCallback((bookId: string, progress: number) => {
    setState(prev => {
      const existing = prev.books[bookId]
      if (!existing) return prev
      const next: LibraryState = {
        books: {
          ...prev.books,
          [bookId]: { ...existing, progress: Math.min(100, Math.max(0, progress)) },
        },
      }
      save(next)
      return next
    })
  }, [])

  const toggleBookmark = useCallback((bookId: string, title: string, author: string) => {
    setState(prev => {
      const existing = prev.books[bookId]
      const next: LibraryState = {
        books: {
          ...prev.books,
          [bookId]: {
            bookId,
            title,
            author,
            progress: existing?.progress ?? 0,
            lastOpened: existing?.lastOpened ?? new Date().toISOString(),
            bookmarked: !(existing?.bookmarked ?? false),
          },
        },
      }
      save(next)
      return next
    })
  }, [])

  const recent = Object.values(state.books)
    .sort((a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime())
    .slice(0, 4)

  const bookmarks = Object.values(state.books).filter(b => b.bookmarked)

  const isBookmarked = (bookId: string) => state.books[bookId]?.bookmarked ?? false
  const getProgress = (bookId: string) => state.books[bookId]?.progress ?? 0

  return { recent, bookmarks, openBook, updateProgress, toggleBookmark, isBookmarked, getProgress }
}
