import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/** Signed-in users skip the marketing landing page. */
export function WelcomeRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (user && location.pathname === '/welcome') {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
