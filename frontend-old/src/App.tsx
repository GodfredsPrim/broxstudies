import React, { Suspense, lazy } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Brain, FileText, Zap, BarChart3, Trophy, BookOpen, Users, Clock,
  CreditCard, Hash, Settings, Moon, Sun, Menu, X, LayoutDashboard
} from 'lucide-react'
import './index.css'
import { SkeletonLines } from '@/components/ui/skeleton'
import {
  authAPI, adminAPI, questionsAPI, setAuthToken,
  type AuthConfigResponse, type AuthUser
} from './services/api'
import StudyCoach from './components/StudyCoach'
import LiveQuiz from './components/LiveQuiz'
import { QuestionGenerator } from './components/QuestionGenerator'
import { AnalysisDashboard } from './components/AnalysisDashboard'
import ResourceFetcher from './components/ResourceFetcher'
import { GlobalLeaderboard } from './components/Leaderboard'
import { CompetitionPortal } from './components/CompetitionPortal'

// Lazy-loaded admin screens
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminAnalytics = lazy(() => import('./components/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })))
const AdminUsers = lazy(() => import('./components/AdminUsers').then(m => ({ default: m.AdminUsers })))
const AdminPayments = lazy(() => import('./components/AdminPayments').then(m => ({ default: m.AdminPayments })))
const AdminCoupons = lazy(() => import('./components/AdminCoupons').then(m => ({ default: m.AdminCoupons })))
const AdminCompetitions = lazy(() => import('./components/AdminCompetitions').then(m => ({ default: m.AdminCompetitions })))
const AdminContent = lazy(() => import('./components/AdminContent').then(m => ({ default: m.AdminContent })))
const AdminSettings = lazy(() => import('./components/AdminSettings').then(m => ({ default: m.AdminSettings })))

function RouteFallback() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-gh-chalk" />
        <div className="h-8 w-1/2 animate-pulse rounded bg-gh-chalk" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-gh-chalk" />
      </div>
      <div className="rounded-xl border border-gh-chalk bg-gh-paper p-6 shadow-brand-sm">
        <SkeletonLines count={5} />
      </div>
    </div>
  )
}

type StudentTab = 'study' | 'generator' | 'live_quiz' | 'competitions' | 'analysis' | 'resources' | 'leaderboard' | 'history'
type AdminTab = 'dashboard' | 'analytics' | 'users' | 'payments' | 'coupons' | 'competitions' | 'content' | 'settings'
type AuthMode = 'login' | 'signup'
type AuthStep = 'auth' | 'verify_code'

const GUEST_CHAT_LIMIT = 3
const CHAT_TARGET: StudentTab = 'study'
const GOOGLE_SCRIPT_ID = 'google-identity-services'

const STUDENT_NAV_ITEMS: Array<{ tab: StudentTab; label: string; icon: React.ReactNode }> = [
  { tab: 'study', label: 'Study with AI', icon: <Brain size={16} /> },
  { tab: 'generator', label: 'Practice', icon: <FileText size={16} /> },
  { tab: 'live_quiz', label: 'Live Quiz', icon: <Zap size={16} /> },
  { tab: 'competitions', label: 'Competitions', icon: <Trophy size={16} /> },
  { tab: 'analysis', label: 'WASSCE Prep', icon: <BarChart3 size={16} /> },
  { tab: 'resources', label: 'Library', icon: <BookOpen size={16} /> },
  { tab: 'leaderboard', label: 'Ranking', icon: <Users size={16} /> },
  { tab: 'history', label: 'History', icon: <Clock size={16} /> },
]

const ADMIN_NAV_ITEMS: Array<{ tab: AdminTab; label: string; icon: React.ReactNode }> = [
  { tab: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { tab: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
  { tab: 'users', label: 'Users', icon: <Users size={16} /> },
  { tab: 'payments', label: 'Payments', icon: <CreditCard size={16} /> },
  { tab: 'coupons', label: 'Coupons', icon: <Hash size={16} /> },
  { tab: 'competitions', label: 'Competitions', icon: <Trophy size={16} /> },
  { tab: 'content', label: 'Content', icon: <FileText size={16} /> },
  { tab: 'settings', label: 'Settings', icon: <Settings size={16} /> },
]

const TAB_COPY: Record<StudentTab, { label: string; reason: string; icon: string }> = {
  study: {
    label: 'Study with AI',
    icon: '🧠',
    reason: 'You have used your free study chats. Create an account to continue learning and save your history.',
  },
  generator: {
    label: 'Generate Questions',
    icon: '📝',
    reason: 'Save generated practice sets, revisit answers, and keep your progress organised.',
  },
  live_quiz: {
    label: 'Quiz Challenge',
    icon: '⚡',
    reason: 'Join timed challenges, keep scores, and track performance with your own account.',
  },
  competitions: {
    label: 'Competitions',
    icon: '🏆',
    reason: 'View current announcements, rewards, and competition updates.',
  },
  analysis: {
    label: 'Likely WASSCE Questions',
    icon: '📊',
    reason: 'Unlock deeper pattern insights and keep your personal exam-prep history.',
  },
  resources: {
    label: 'Library',
    icon: '📚',
    reason: 'Download and manage your learning resources from one account.',
  },
  leaderboard: {
    label: 'Leaderboard',
    icon: '🏆',
    reason: 'Compete globally and track your ranking.',
  },
  history: {
    label: 'History',
    icon: '🕒',
    reason: 'Review your past generated questions and session analysis.',
  },
}

// ── SVG icons ────────────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const EyeIcon = ({ visible }: { visible: boolean }) => visible ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

const TicketIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z"/>
  </svg>
)

function hasActiveSubscription(user: AuthUser | null) {
  return Boolean(user?.is_admin || user?.subscription_status === 'active')
}

function canAccessTab(tab: StudentTab, user: AuthUser | null) {
  if (tab === 'study') return true
  return hasActiveSubscription(user)
}

function App() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    const saved = window.localStorage.getItem('broxstudies_theme') as 'light' | 'dark' | null
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const [activeStudentTab, setActiveStudentTab] = React.useState<StudentTab>('study')
  const [activeAdminTab, setActiveAdminTab] = React.useState<AdminTab>('dashboard')
  const [account, setAccount] = React.useState<AuthUser | null>(null)
  const [isExamSimulating, setIsExamSimulating] = React.useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [route, setRoute] = React.useState<'/' | '/admin'>(() => window.location.pathname === '/admin' ? '/admin' : '/')

  // Guest chat tracking (tracks used so we persist exactly what the old app did)
  const [guestChatsUsed, setGuestChatsUsed] = React.useState<number>(() => {
    const saved = window.localStorage.getItem('broxstudies_guest_chats_used')
    return saved ? Number(saved) || 0 : 0
  })
  const guestChatsRemaining = Math.max(0, GUEST_CHAT_LIMIT - guestChatsUsed)

  // Primary auth modal (login/signup + access-code gate)
  const [authModalOpen, setAuthModalOpen] = React.useState(false)
  const [authMode, setAuthMode] = React.useState<AuthMode>('signup')
  const [authStep, setAuthStep] = React.useState<AuthStep>('auth')
  const [authTarget, setAuthTarget] = React.useState<StudentTab>(CHAT_TARGET)
  const [authForm, setAuthForm] = React.useState({ fullName: '', email: '', password: '' })
  const [authError, setAuthError] = React.useState('')
  const [authLoading, setAuthLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  // Google OAuth
  const [authConfig, setAuthConfig] = React.useState<AuthConfigResponse>({
    google_client_id: '',
    google_enabled: false,
    facebook_enabled: false,
    tiktok_enabled: false,
    passkey_enabled: false,
  })
  const [googleReady, setGoogleReady] = React.useState(false)

  // Access code entry
  const [accessCode, setAccessCode] = React.useState('')
  const [codeError, setCodeError] = React.useState('')
  const [codeLoading, setCodeLoading] = React.useState(false)

  // Manual MoMo payment form (hidden by default — reserved for future enable)
  const [manualForm, setManualForm] = React.useState({ momoName: '', momoNumber: '', reference: '' })
  const [manualLoading, setManualLoading] = React.useState(false)
  const [manualSuccess, setManualSuccess] = React.useState(false)

  // Subscription days remaining
  const [, setSubDaysLeft] = React.useState<number | null>(null)

  // Admin-secret gate modal
  const [adminAuthOpen, setAdminAuthOpen] = React.useState(false)
  const [adminSecretIn, setAdminSecretIn] = React.useState('')
  const [adminAuthError, setAdminAuthError] = React.useState('')
  const [adminAuthLoading, setAdminAuthLoading] = React.useState(false)

  const isAdmin = account?.is_admin === true
  const isAdminRoute = route === '/admin'
  const showAdminContent = isAdmin && isAdminRoute

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('broxstudies_theme', theme)
  }, [theme])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mobileMenuOpen) setMobileMenuOpen(false)
        if (adminAuthOpen) setAdminAuthOpen(false)
        if (authModalOpen) setAuthModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [mobileMenuOpen, adminAuthOpen, authModalOpen])

  // Kick off deferred content loading on the backend (no-op if unavailable)
  React.useEffect(() => {
    questionsAPI.loadDeferred().catch((err) => {
      console.log('Deferred loading not available or already running:', err)
    })
  }, [])

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light')

  const setBrowserRoute = (nextRoute: '/' | '/admin') => {
    if (window.location.pathname !== nextRoute) {
      window.history.pushState({}, '', nextRoute)
    }
    setRoute(nextRoute)
  }

  const persistSession = (accessToken: string, user: AuthUser) => {
    window.localStorage.setItem('broxstudies_access_token', accessToken)
    window.localStorage.setItem('broxstudies_guest_chats_used', '0')
    setAuthToken(accessToken)
    setAccount(user)
    setGuestChatsUsed(0)

    // Admins go straight to /admin
    if (user.is_admin) {
      setAuthModalOpen(false)
      setActiveAdminTab('dashboard')
      setBrowserRoute('/admin')
      return
    }

    // Non-admin without active sub → show access-code step
    if (user.subscription_status !== 'active') {
      setAuthStep('verify_code')
      return
    }

    // Subscribed: close modal and route to the originally-requested tab
    setAuthModalOpen(false)
    if (authTarget !== CHAT_TARGET) {
      setActiveStudentTab(authTarget)
    }
  }

  const openAuthGate = (target: StudentTab, mode: AuthMode = 'signup') => {
    if (account && canAccessTab(target, account)) {
      setActiveStudentTab(target)
      return
    }
    setAuthTarget(target)
    setAuthMode(mode)
    setAuthError('')
    setAccessCode('')
    setCodeError('')
    setAuthStep(account && !hasActiveSubscription(account) ? 'verify_code' : 'auth')
    setAuthModalOpen(true)
  }

  const handleRequireAuth = () => {
    openAuthGate(CHAT_TARGET, 'signup')
  }

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      if (authMode === 'signup') {
        const result = await authAPI.signup(
          authForm.fullName.trim(),
          authForm.email.trim().toLowerCase(),
          authForm.password.trim(),
        )
        persistSession(result.access_token, result.user)
      } else {
        const result = await authAPI.login(
          authForm.email.trim().toLowerCase(),
          authForm.password.trim(),
        )
        persistSession(result.access_token, result.user)
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail ||
                     (err?.code === 'ECONNABORTED' ? 'Connection timed out.' : 'Authentication failed. Please try again.')
      setAuthError(detail)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGoogleAuth = () => {
    if (!authConfig.google_enabled || !authConfig.google_client_id) {
      setAuthError('Google sign-in is not configured yet.')
      return
    }
    const googleApi = (window as any).google
    if (!googleReady || !googleApi?.accounts?.id) {
      setAuthError('Google sign-in is still loading. Please try again.')
      return
    }
    setAuthError('')
    try {
      googleApi.accounts.id.prompt((notification: any) => {
        if (notification?.isNotDisplayed?.()) {
          console.warn('One Tap not displayed:', notification.getNotDisplayedReason?.())
          setAuthError('Sign-in prompt was suppressed. Please try again or use email.')
        }
      })
    } catch {
      setAuthError('Unable to start Google sign-in right now.')
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account || !accessCode.trim()) return
    setCodeLoading(true)
    setCodeError('')
    try {
      const updatedUser = await authAPI.verifyCode(accessCode.trim())
      setAccount(updatedUser)
      try {
        const sub = await authAPI.getSubscription()
        setSubDaysLeft(sub.days_remaining ?? null)
      } catch { /* non-critical */ }
      setAuthModalOpen(false)
      if (authTarget !== CHAT_TARGET) {
        setActiveStudentTab(authTarget)
      }
    } catch (err: any) {
      setCodeError(err?.response?.data?.detail || 'Invalid code. Please try again.')
    } finally {
      setCodeLoading(false)
    }
  }

  const handleManualPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualForm.momoName.trim() || !manualForm.momoNumber.trim()) return
    setManualLoading(true)
    try {
      await authAPI.requestManualPayment({
        momo_name: manualForm.momoName.trim(),
        momo_number: manualForm.momoNumber.trim(),
        reference: manualForm.reference.trim(),
      })
      setManualSuccess(true)
    } catch (err) {
      console.error('Manual payment submission failed', err)
    } finally {
      setManualLoading(false)
    }
  }

  const handleSkipCode = () => {
    setAuthModalOpen(false)
    setActiveStudentTab('study')
  }

  const handleConsumeGuestChat = () => {
    if (account) return true
    if (guestChatsUsed >= GUEST_CHAT_LIMIT) {
      openAuthGate(CHAT_TARGET, 'signup')
      return false
    }
    const next = guestChatsUsed + 1
    setGuestChatsUsed(next)
    window.localStorage.setItem('broxstudies_guest_chats_used', String(next))
    return true
  }

  // Bootstrap on mount: load auth config + stored session
  React.useEffect(() => {
    const bootstrap = async () => {
      try {
        const config = await authAPI.getConfig()
        setAuthConfig(config)
      } catch (err) {
        console.error('Failed to load auth config', err)
      }

      const storedToken = window.localStorage.getItem('broxstudies_access_token')
      if (!storedToken) return

      try {
        setAuthToken(storedToken)
        const user = await authAPI.me()
        setAccount(user)

        if (user.is_admin) {
          if (window.location.pathname === '/admin') {
            setActiveAdminTab('dashboard')
          }
        } else if (user.subscription_status === 'active') {
          try {
            const sub = await authAPI.getSubscription()
            setSubDaysLeft(sub.days_remaining ?? null)
          } catch { /* non-critical */ }
        } else {
          // logged in but not subscribed — invite to activate
          setAuthStep('verify_code')
          setAuthModalOpen(true)
        }
      } catch (err) {
        console.error('Stored session is invalid', err)
        window.localStorage.removeItem('broxstudies_access_token')
        setAuthToken(null)
      }
    }

    const handlePopState = () => {
      setRoute(window.location.pathname === '/admin' ? '/admin' : '/')
    }

    void bootstrap()
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Google Identity Services loader — depends on authConfig
  React.useEffect(() => {
    if (!authConfig.google_enabled || !authConfig.google_client_id) return

    const initGoogle = () => {
      const googleApi = (window as any).google
      if (googleApi?.accounts?.id) {
        googleApi.accounts.id.initialize({
          client_id: authConfig.google_client_id,
          callback: async (response: { credential: string }) => {
            setAuthLoading(true)
            setAuthError('')
            try {
              const result = await authAPI.google(response.credential)
              persistSession(result.access_token, result.user)
            } catch (err: any) {
              setAuthError(err?.response?.data?.detail || 'Google sign-in failed.')
            } finally {
              setAuthLoading(false)
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        setGoogleReady(true)
      }
    }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID)
    if (existing) {
      initGoogle()
      return
    }
    const script = document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initGoogle
    document.body.appendChild(script)
  }, [authConfig.google_client_id, authConfig.google_enabled])

  // Secret hash route (#admin) — opens admin gate, or jumps to /admin if already admin
  React.useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#admin') {
        if (account?.is_admin) {
          setBrowserRoute('/admin')
        } else {
          setAdminAuthOpen(true)
        }
      }
    }
    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [account])

  // Force-fallback to study if an unauthed user is somehow on a gated tab
  React.useEffect(() => {
    if (!canAccessTab(activeStudentTab, account)) {
      setActiveStudentTab('study')
    }
  }, [activeStudentTab, account])

  const handleAdminAuthViaSecret = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminSecretIn.trim()) return
    setAdminAuthLoading(true)
    setAdminAuthError('')
    try {
      const result = await adminAPI.loginWithSecret(adminSecretIn.trim())
      persistSession(result.access_token, result.user)
      setAdminAuthOpen(false)
      setAdminSecretIn('')
    } catch (err: any) {
      const detail = err?.response?.data?.detail ||
                     (err?.code === 'ECONNABORTED' ? 'Connection timed out.' : 'Invalid admin access code.')
      setAdminAuthError(detail)
    } finally {
      setAdminAuthLoading(false)
    }
  }

  const handleLogout = () => {
    window.localStorage.removeItem('broxstudies_access_token')
    setAuthToken(null)
    setAccount(null)
    setActiveAdminTab('dashboard')
    setSubDaysLeft(null)
    setBrowserRoute('/')
  }

  return (
    <div className="app-shell">
      {!isExamSimulating && (
        <header className="topbar">
          <div className="topbar__inner">
            <div className="topbar__brand">
              <div className="brand-mark">B</div>
              <span>{isAdmin && isAdminRoute ? 'BroxStudies Admin' : 'BroxStudies'}</span>
            </div>

            {!isAdminRoute ? (
              <nav className="topbar__nav" aria-label="Student navigation">
                {STUDENT_NAV_ITEMS.map(({ tab, label, icon }) => (
                  <button
                    key={tab}
                    className={`topbar__nav-btn ${activeStudentTab === tab ? 'active' : ''}`}
                    onClick={() => (tab === 'study' ? setActiveStudentTab('study') : openAuthGate(tab))}
                  >
                    {icon} {label}
                  </button>
                ))}
              </nav>
            ) : isAdmin ? (
              <nav className="topbar__nav" aria-label="Administration navigation">
                {ADMIN_NAV_ITEMS.map(({ tab, label, icon }) => (
                  <button
                    key={tab}
                    className={`topbar__nav-btn ${activeAdminTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveAdminTab(tab)}
                  >
                    {icon} {label}
                  </button>
                ))}
              </nav>
            ) : null}

            <div className="topbar__tools" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="topbar__nav-btn" onClick={toggleTheme}>
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              {!isAdminRoute && !account && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-premium btn-premium--secondary" onClick={() => openAuthGate(CHAT_TARGET, 'login')}>
                    Log in
                  </button>
                  <button className="btn-premium btn-premium--primary" onClick={() => openAuthGate(CHAT_TARGET, 'signup')}>
                    Sign up
                  </button>
                </div>
              )}
              {account && (
                <button className="btn-premium btn-premium--primary" onClick={handleLogout}>Log out</button>
              )}
              <button className="topbar__hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
                <Menu size={22} />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Mobile Navigation Drawer */}
      <div className={`mobile-menu-overlay${mobileMenuOpen ? ' open' : ''}`}>
        <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />
        <div className="mobile-menu-drawer">
          <div className="mobile-menu-header">
            <div className="topbar__brand" style={{ fontSize: '1.2rem' }}>
              <div className="brand-mark" style={{ width: 32, height: 32, fontSize: '1rem' }}>B</div>
              <span>{isAdmin && isAdminRoute ? 'BroxStudies Admin' : 'BroxStudies'}</span>
            </div>
            <button className="topbar__hamburger" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
              <X size={22} />
            </button>
          </div>
          {!isAdminRoute && STUDENT_NAV_ITEMS.map(({ tab, label, icon }) => (
            <button
              key={tab}
              className={`mobile-nav-btn${activeStudentTab === tab ? ' active' : ''}`}
              onClick={() => {
                if (tab === 'study') {
                  setActiveStudentTab('study')
                } else {
                  openAuthGate(tab)
                }
                setMobileMenuOpen(false)
              }}
            >
              {icon} {label}
            </button>
          ))}
          {isAdminRoute && isAdmin && ADMIN_NAV_ITEMS.map(({ tab, label, icon }) => (
            <button
              key={tab}
              className={`mobile-nav-btn${activeAdminTab === tab ? ' active' : ''}`}
              onClick={() => { setActiveAdminTab(tab); setMobileMenuOpen(false); }}
            >
              {icon} {label}
            </button>
          ))}
          <div className="mobile-menu-actions">
            <button className="topbar__nav-btn" onClick={toggleTheme} style={{ justifyContent: 'flex-start', gap: 10 }}>
              {theme === 'light' ? <><Moon size={18} /> Dark mode</> : <><Sun size={18} /> Light mode</>}
            </button>
            {account ? (
              <button className="btn-premium btn-premium--primary" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>
                Log out
              </button>
            ) : (
              <button className="btn-premium btn-premium--primary" onClick={() => { openAuthGate(CHAT_TARGET, 'signup'); setMobileMenuOpen(false); }}>
                Login / Sign up
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="app-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${route}-${isAdminRoute ? activeAdminTab : activeStudentTab}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<RouteFallback />}>
              {isAdminRoute ? (
                showAdminContent ? (
                  <>
                    {activeAdminTab === 'dashboard' && <AdminDashboard />}
                    {activeAdminTab === 'analytics' && <AdminAnalytics />}
                    {activeAdminTab === 'users' && <AdminUsers />}
                    {activeAdminTab === 'payments' && <AdminPayments />}
                    {activeAdminTab === 'coupons' && <AdminCoupons />}
                    {activeAdminTab === 'competitions' && <AdminCompetitions />}
                    {activeAdminTab === 'content' && <AdminContent />}
                    {activeAdminTab === 'settings' && <AdminSettings />}
                  </>
                ) : (
                  <div style={{ padding: '48px 24px', maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Admin access required</h1>
                    <p style={{ color: '#475569', marginBottom: '24px' }}>
                      This page is reserved for administrators. If you are an admin, enter the secure code to continue.
                      Otherwise, return to the student homepage.
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn-premium btn-premium--primary" onClick={() => setAdminAuthOpen(true)}>
                        Enter Admin Code
                      </button>
                      <button className="btn-secondary" onClick={() => setBrowserRoute('/')}>Student Home</button>
                    </div>
                  </div>
                )
              ) : (
                <div style={{ padding: '32px 20px', minHeight: 'calc(100vh - var(--topbar-height))' }}>
                  {activeStudentTab === 'study' && (
                    <StudyCoach
                      isAuthenticated={!!account}
                      guestChatsRemaining={guestChatsRemaining}
                      onRequireAuth={handleRequireAuth}
                      onConsumeGuestChat={handleConsumeGuestChat}
                      userId={account?.id ?? null}
                    />
                  )}
                  {activeStudentTab === 'generator' && (
                    <QuestionGenerator
                      onSimulationToggle={(val) => setIsExamSimulating(val)}
                      isSimulating={isExamSimulating}
                    />
                  )}
                  {activeStudentTab === 'live_quiz' && <LiveQuiz />}
                  {activeStudentTab === 'competitions' && <CompetitionPortal />}
                  {activeStudentTab === 'analysis' && <AnalysisDashboard />}
                  {activeStudentTab === 'resources' && <ResourceFetcher />}
                  {activeStudentTab === 'leaderboard' && <GlobalLeaderboard />}
                  {activeStudentTab === 'history' && <QuestionGenerator showHistoryOnly={true} />}
                </div>
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Auth / Subscription Modal ─────────────────────────────────────── */}
      {authModalOpen && !isExamSimulating && (
        <div
          className="auth-backdrop"
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setAuthModalOpen(false) }}
        >
          <div className="auth-modal-v2">

            {/* Step 1: Login / Signup */}
            {authStep === 'auth' && (
              <>
                <div className="authv2__header">
                  <div className="authv2__logo">
                    <div className="authv2__logo-mark">B</div>
                    <span className="brand-text">BroxStudies</span>
                  </div>
                  <h2 className="authv2__title">
                    {authMode === 'signup' ? 'Begin Your Journey' : 'Welcome Back'}
                  </h2>
                  <p className="authv2__subtitle">
                    {TAB_COPY[authTarget].reason}
                  </p>
                </div>

                <div className="authv2__tabs">
                  <button
                    className={`authv2__tab ${authMode === 'signup' ? 'authv2__tab--active' : ''}`}
                    onClick={() => { setAuthMode('signup'); setAuthError('') }}
                  >
                    Create account
                  </button>
                  <button
                    className={`authv2__tab ${authMode === 'login' ? 'authv2__tab--active' : ''}`}
                    onClick={() => { setAuthMode('login'); setAuthError('') }}
                  >
                    Log in
                  </button>
                </div>

                <button
                  className="authv2__google-btn"
                  onClick={() => handleGoogleAuth()}
                  disabled={authLoading || !authConfig.google_enabled}
                  title={!authConfig.google_enabled ? 'Google sign-in not configured' : ''}
                >
                  <GoogleIcon />
                  <span>Continue with Google</span>
                  {!authConfig.google_enabled && <small className="authv2__soon">Coming soon</small>}
                </button>

                <div className="authv2__divider">
                  <span>or continue with email</span>
                </div>

                <form className="authv2__form" onSubmit={(e) => void handleAuthSubmit(e)}>
                  {authMode === 'signup' && (
                    <div className="authv2__field">
                      <label className="authv2__label">Full name</label>
                      <input
                        className="authv2__input"
                        type="text"
                        autoComplete="name"
                        placeholder="Ama Mensah"
                        value={authForm.fullName}
                        onChange={(e) => setAuthForm((prev) => ({ ...prev, fullName: e.target.value }))}
                        required
                      />
                    </div>
                  )}

                  <div className="authv2__field">
                    <label className="authv2__label">Email address</label>
                    <input
                      className="authv2__input"
                      type="email"
                      autoComplete="email"
                      placeholder="student@example.com"
                      value={authForm.email}
                      onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="authv2__field">
                    <label className="authv2__label">Password</label>
                    <div className="authv2__password-wrap">
                      <input
                        className="authv2__input authv2__input--password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                        placeholder={authMode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                        value={authForm.password}
                        onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                        required
                      />
                      <button
                        type="button"
                        className="authv2__eye"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                      >
                        <EyeIcon visible={showPassword} />
                      </button>
                    </div>
                  </div>

                  {authError && <div className="authv2__error">{authError}</div>}

                  <button type="submit" className="authv2__submit" disabled={authLoading}>
                    {authLoading ? (
                      <span className="authv2__spinner" />
                    ) : (
                      authMode === 'signup' ? 'Create account' : 'Log in'
                    )}
                  </button>
                </form>

                <p className="authv2__footer-note">
                  {authMode === 'signup'
                    ? 'Already have an account? '
                    : "Don't have an account? "}
                  <button
                    className="authv2__link"
                    onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthError('') }}
                  >
                    {authMode === 'signup' ? 'Log in' : 'Sign up for free'}
                  </button>
                </p>

                <button className="authv2__close" onClick={() => setAuthModalOpen(false)} aria-label="Close">✕</button>
              </>
            )}

            {/* Step 2: Access Code Entry */}
            {authStep === 'verify_code' && (
              <>
                <div className="authv2__header">
                  <div className="authv2__ticket-icon"><TicketIcon /></div>
                  <h2 className="authv2__title">Premium Activation</h2>
                  <p className="authv2__subtitle">
                    Pay <strong>GH₵ 10</strong> via MoMo to <strong>0248317900</strong>.<br/>
                    After payment, enter the access code given to you to unlock premium features.
                  </p>
                </div>

                <div className="glass-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '15px', color: '#1e293b' }}>🎟️ Have a code?</h4>
                  <form onSubmit={(e) => void handleVerifyCode(e)}>
                    <input
                      className="authv2__input authv2__input--code"
                      style={{ marginBottom: '10px' }}
                      type="text"
                      placeholder="BROX-XXXX"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    />
                    {codeError && (
                      <div className="authv2__error" style={{ marginBottom: '10px' }}>
                        {codeError}
                      </div>
                    )}
                    <button type="submit" className="authv2__submit" style={{ padding: '10px' }} disabled={codeLoading}>
                      {codeLoading ? 'Verifying…' : 'Activate Premium'}
                    </button>
                  </form>
                </div>

                {/* Option B: Manual MoMo Submit — kept hidden until enabled */}
                <div className="glass-card" style={{ display: 'none', padding: '20px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <h4 style={{ marginBottom: '15px', color: '#1e293b' }}>📱 Paid via MoMo?</h4>
                  {manualSuccess ? (
                    <div style={{ color: '#059669', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
                      ✅ Request submitted!<br/>Admin will verify soon.
                    </div>
                  ) : (
                    <form onSubmit={(e) => void handleManualPaymentSubmit(e)}>
                      <input
                        className="authv2__input"
                        style={{ marginBottom: '8px', fontSize: '0.8rem', padding: '8px' }}
                        type="text"
                        placeholder="Your MoMo Name"
                        required
                        value={manualForm.momoName}
                        onChange={(e) => setManualForm({ ...manualForm, momoName: e.target.value })}
                      />
                      <input
                        className="authv2__input"
                        style={{ marginBottom: '8px', fontSize: '0.8rem', padding: '8px' }}
                        type="text"
                        placeholder="Your MoMo Number"
                        required
                        value={manualForm.momoNumber}
                        onChange={(e) => setManualForm({ ...manualForm, momoNumber: e.target.value })}
                      />
                      <input
                        className="authv2__input"
                        style={{ marginBottom: '8px', fontSize: '0.8rem', padding: '8px' }}
                        type="text"
                        placeholder="Transaction Reference (optional)"
                        value={manualForm.reference}
                        onChange={(e) => setManualForm({ ...manualForm, reference: e.target.value })}
                      />
                      <button type="submit" className="authv2__submit" style={{ padding: '10px', background: '#3b82f6' }} disabled={manualLoading}>
                        {manualLoading ? 'Submitting...' : 'Submit Reference'}
                      </button>
                    </form>
                  )}
                </div>

                <button className="authv2__skip-link" onClick={handleSkipCode}>
                  I'll activate later — continue with limited access
                </button>

                <button className="authv2__close" onClick={() => setAuthModalOpen(false)} aria-label="Close">✕</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Admin Access Gate Modal ─────────────────────────────────────── */}
      {adminAuthOpen && (
        <div className="auth-backdrop" style={{ zIndex: 2000 }} onClick={(e) => { if (e.target === e.currentTarget) setAdminAuthOpen(false) }}>
          <div className="auth-modal-v2" style={{ maxWidth: '400px' }}>
            <div className="authv2__header">
              <div className="authv2__logo" style={{ marginBottom: '20px' }}>
                <div className="authv2__logo-mark" style={{ background: '#0f172a' }}>🛡️</div>
                <span>Admin Gate</span>
              </div>
              <h2 className="authv2__title">Administrative Access</h2>
              <p className="authv2__subtitle">
                Please enter the secure <strong>Admin Access Code</strong> to manage the BroxStudies system.
              </p>
            </div>

            <form className="authv2__form" onSubmit={(e) => void handleAdminAuthViaSecret(e)}>
              <div className="authv2__field">
                <label className="authv2__label">Access Code</label>
                <input
                  className="authv2__input"
                  type="password"
                  placeholder="Enter secret code"
                  value={adminSecretIn}
                  onChange={(e) => setAdminSecretIn(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {adminAuthError && <div className="authv2__error">{adminAuthError}</div>}

              <button type="submit" className="authv2__submit" style={{ background: '#0f172a' }} disabled={adminAuthLoading}>
                {adminAuthLoading ? <span className="authv2__spinner" /> : 'Verify Access'}
              </button>
            </form>

            <button className="authv2__close" onClick={() => setAdminAuthOpen(false)}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
