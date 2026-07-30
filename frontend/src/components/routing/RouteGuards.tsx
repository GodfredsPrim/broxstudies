import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/** Signed-in users skip the marketing landing page. */
export function WelcomeRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Authentication is only needed to decide the /welcome redirect. Blocking
  // every route here creates an empty frame during startup for signed-in users.
  if (loading && location.pathname === '/welcome') return null
  if (user && location.pathname === '/welcome') {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
