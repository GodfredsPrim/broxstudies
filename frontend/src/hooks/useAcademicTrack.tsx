import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AcademicTrack = 'shs' | 'tvet'

interface AcademicTrackContextValue {
  selectedTrack: AcademicTrack | null
  setSelectedTrack: (track: AcademicTrack) => void
  resetAcademicTrack: () => void
  loading: boolean
}

const AcademicTrackContext = createContext<AcademicTrackContextValue | null>(null)
const STORAGE_KEY = 'brox.selected-track'

export function AcademicTrackProvider({ children }: { children: ReactNode }) {
  const [selectedTrack, setSelectedTrackState] = useState<AcademicTrack | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'shs' || stored === 'tvet') {
      setSelectedTrackState(stored)
    }
    setLoading(false)
  }, [])

  const setSelectedTrack = useCallback((track: AcademicTrack) => {
    setSelectedTrackState(track)
    localStorage.setItem(STORAGE_KEY, track)
  }, [])

  const resetAcademicTrack = useCallback(() => {
    setSelectedTrackState(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = useMemo(
    () => ({ selectedTrack, setSelectedTrack, resetAcademicTrack, loading }),
    [selectedTrack, setSelectedTrack, resetAcademicTrack, loading],
  )

  return (
    <AcademicTrackContext.Provider value={value}>
      {children}
    </AcademicTrackContext.Provider>
  )
}

export function useAcademicTrack() {
  const ctx = useContext(AcademicTrackContext)
  if (!ctx) {
    throw new Error('useAcademicTrack must be used inside <AcademicTrackProvider>')
  }
  return ctx
}
