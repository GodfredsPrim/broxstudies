import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { AcademicTrackProvider } from '@/hooks/useAcademicTrack'
import './styles/tokens.css'

function TrackBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const isActive = user?.subscription_status === 'active'
  return (
    <AcademicTrackProvider
      serverTrack={user?.track ?? null}
      hasActiveSubscription={isActive}
    >
      {children}
    </AcademicTrackProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TrackBridge>
          <App />
        </TrackBridge>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
