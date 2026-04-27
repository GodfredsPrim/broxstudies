import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { TrackSelector } from '@/components/TrackSelector'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Button } from '@/components/ui/Button'

export function TrackSelectionPage() {
  const { selectedTrack, setSelectedTrack, loading } = useAcademicTrack()
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && selectedTrack && user) {
      navigate('/', { replace: true })
    }
  }, [loading, selectedTrack, user, navigate])

  const handleSelect = (track: 'shs' | 'tvet') => {
    setSelectedTrack(track)
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_35%)]" />
      <div className="relative w-full max-w-3xl">
        <Card padded={false} className="overflow-hidden border border-white/10 bg-[var(--bg-1)] shadow-xl">
          <div className="p-8 sm:p-10">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-3xl bg-emerald-500/10 text-emerald-300">
                <Sparkles size={20} />
              </div>
              <Eyebrow className="mb-3">Welcome</Eyebrow>
              <h1 className="text-3xl font-semibold tracking-tight text-ink-0 sm:text-4xl">
                Choose SHS or TVET to begin
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-ink-300">
                Select the curriculum that matches your path. After that, log in with the same account flow we already have for SHS.
              </p>
            </div>

            <TrackSelector selectedTrack={selectedTrack} onSelect={handleSelect} />

            {selectedTrack && (
              <div className="mt-8 flex flex-col gap-4 text-center">
                <p className="text-sm text-ink-200">
                  You selected <span className="font-semibold text-emerald-300">{selectedTrack.toUpperCase()}</span>. You can now study with AI for up to 3 chats before signing in.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link to="/" className="v2-btn v2-btn-primary inline-flex items-center justify-center px-4 py-3 text-sm font-semibold transition-all">
                    Continue to Study
                  </Link>
                  {user ? (
                    <Button onClick={() => navigate('/')} variant="ghost" fullWidth>
                      Continue as signed-in user
                    </Button>
                  ) : (
                    <Link to="/login" className="v2-btn v2-btn-ghost inline-flex items-center justify-center px-4 py-3 text-sm font-semibold transition-all">
                      Log in / Sign up
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
