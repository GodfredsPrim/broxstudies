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
  isLocked: boolean   // true when the user's subscription has locked their track
  loading: boolean
}

const AcademicTrackContext = createContext<AcademicTrackContextValue | null>(null)
const STORAGE_KEY = 'brox.selected-track'

export function AcademicTrackProvider({
  children,
  serverTrack,        // track locked by server (from AuthUser.track)
  hasActiveSubscription,
}: {
  children: ReactNode
  serverTrack?: 'shs' | 'tvet' | null
  hasActiveSubscription?: boolean
}) {
  const [selectedTrack, setSelectedTrackState] = useState<AcademicTrack | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Server-locked track takes priority when subscription is active
    if (hasActiveSubscription && serverTrack) {
      setSelectedTrackState(serverTrack)
      localStorage.setItem(STORAGE_KEY, serverTrack)
      setLoading(false)
      return
    }
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'shs' || stored === 'tvet') {
      setSelectedTrackState(stored)
    }
    setLoading(false)
  }, [serverTrack, hasActiveSubscription])

  const isLocked = Boolean(hasActiveSubscription && serverTrack)

  const setSelectedTrack = useCallback((track: AcademicTrack) => {
    // Prevent switching tracks when subscription is active
    if (isLocked) return
    setSelectedTrackState(track)
    localStorage.setItem(STORAGE_KEY, track)
  }, [isLocked])

  const resetAcademicTrack = useCallback(() => {
    if (isLocked) return
    setSelectedTrackState(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [isLocked])

  const value = useMemo(
    () => ({ selectedTrack, setSelectedTrack, resetAcademicTrack, isLocked, loading }),
    [selectedTrack, setSelectedTrack, resetAcademicTrack, isLocked, loading],
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
