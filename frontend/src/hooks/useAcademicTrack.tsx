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

/** Display labels for academic tracks — 'shs' stays the internal value, "SHS/STEM" is what users see. */
export const TRACK_LABELS: Record<AcademicTrack, string> = {
  shs: 'SHS/STEM',
  tvet: 'TVET',
}

export function trackLabel(track: AcademicTrack | null | undefined, fallback = 'SHS/STEM & TVET'): string {
  return track ? TRACK_LABELS[track] : fallback
}

interface AcademicTrackContextValue {
  selectedTrack: AcademicTrack | null
  setSelectedTrack: (track: AcademicTrack) => void
  resetAcademicTrack: () => void
  isLocked: boolean   // true when the user's subscription has locked their track
  loading: boolean
}

const AcademicTrackContext = createContext<AcademicTrackContextValue | null>(null)
const STORAGE_KEY = 'brox.selected-track'

function readStoredTrack(): AcademicTrack | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'shs' || stored === 'tvet' ? stored : null
  } catch {
    return null
  }
}

function storeTrack(track: AcademicTrack | null) {
  try {
    if (track) localStorage.setItem(STORAGE_KEY, track)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Keep the in-memory selection working when Safari blocks storage.
  }
}

export function AcademicTrackProvider({
  children,
  serverTrack,        // track locked by server (from AuthUser.track)
  hasActiveSubscription,
}: {
  children: ReactNode
  serverTrack?: 'shs' | 'tvet' | null
  hasActiveSubscription?: boolean
}) {
  const [selectedTrack, setSelectedTrackState] = useState<AcademicTrack | null>(readStoredTrack)
  const syncingServerTrack = Boolean(
    hasActiveSubscription && serverTrack && selectedTrack !== serverTrack,
  )

  useEffect(() => {
    // Server-locked track takes priority when subscription is active
    if (hasActiveSubscription && serverTrack) {
      setSelectedTrackState(serverTrack)
      storeTrack(serverTrack)
      return
    }
    const stored = readStoredTrack()
    if (stored) {
      setSelectedTrackState(stored)
    }
  }, [serverTrack, hasActiveSubscription])

  const isLocked = Boolean(hasActiveSubscription && serverTrack)

  const setSelectedTrack = useCallback((track: AcademicTrack) => {
    // Prevent switching tracks when subscription is active
    if (isLocked) return
    setSelectedTrackState(track)
    storeTrack(track)
  }, [isLocked])

  const resetAcademicTrack = useCallback(() => {
    if (isLocked) return
    setSelectedTrackState(null)
    storeTrack(null)
  }, [isLocked])

  const value = useMemo(
    () => ({
      selectedTrack,
      setSelectedTrack,
      resetAcademicTrack,
      isLocked,
      loading: syncingServerTrack,
    }),
    [selectedTrack, setSelectedTrack, resetAcademicTrack, isLocked, syncingServerTrack],
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
