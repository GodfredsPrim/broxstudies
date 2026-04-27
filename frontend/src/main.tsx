import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from '@/hooks/useAuth'
import { AcademicTrackProvider } from '@/hooks/useAcademicTrack'
import './styles/tokens.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AcademicTrackProvider>
          <App />
        </AcademicTrackProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)