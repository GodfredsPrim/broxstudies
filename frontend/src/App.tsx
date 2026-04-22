import React from 'react'
import { Brain, FileText, Zap, Megaphone, BarChart3, BookOpen, Trophy, Shield, Clock, Moon, Sun, Eye, EyeOff, Ticket, Menu, X } from 'lucide-react'
import { cn } from "@/lib/utils"
import './index.css'
import { QuestionGenerator } from './components/QuestionGenerator'
import StudyCoach from './components/StudyCoach'
import LiveQuiz from './components/LiveQuiz'
import { AnalysisDashboard } from './components/AnalysisDashboard'
import ResourceFetcher from './components/ResourceFetcher'
import { AdminDashboard } from './components/AdminDashboard'
import { GlobalLeaderboard } from './components/Leaderboard'
import { CompetitionPortal } from './components/CompetitionPortal'
import { authAPI, adminAPI, questionsAPI, setAuthToken, type AuthConfigResponse, type AuthUser } from './services/api'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './components/ui/sheet'

type AppTab = 'study' | 'generator' | 'live_quiz' | 'competitions' | 'analysis' | 'resources' | 'leaderboard' | 'admin' | 'history'
type AuthTarget = AppTab
type AuthMode = 'login' | 'signup'
type AuthStep = 'auth' | 'verify_code' | 'active'

const GUEST_CHAT_LIMIT = 2
const CHAT_TARGET: AuthTarget = 'study'
const GOOGLE_SCRIPT_ID = 'google-identity-services'

const TAB_COPY: Record<AuthTarget, { label: string; reason: string; icon: string }> = {
  study: {
    label: 'Study with AI',
    icon: '🧠',
    reason: 'You have used your two free study chats. Create an account to continue learning and save your history.',
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
    label: 'Announcements',
    icon: '📢',
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
  admin: {
    label: 'Administration',
    icon: '🛡️',
    reason: 'Manage system settings and user accounts.',
  },
  history: {
    label: 'History',
    icon: '🕒',
    reason: 'Review your past generated questions and session analysis.',
  },
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

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

function App() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    return (window.localStorage.getItem('broxstudies_theme') as 'light' | 'dark') || 'light';
  });
  const [activeTab, setActiveTab] = React.useState<AppTab>('study')
  const [isExamSimulating, setIsExamSimulating] = React.useState(false)
  const [account, setAccount] = React.useState<AuthUser | null>(null)
  const [authMode, setAuthMode] = React.useState<AuthMode>('signup')
  const [authOpen, setAuthOpen] = React.useState(false)
  const [authStep, setAuthStep] = React.useState<AuthStep>('auth')
  const [authTarget, setAuthTarget] = React.useState<AuthTarget>(CHAT_TARGET)
  const [authForm, setAuthForm] = React.useState({ fullName: '', email: '', password: '' })
  const [authError, setAuthError] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [guestChatsUsed, setGuestChatsUsed] = React.useState(0)
  const [authConfig, setAuthConfig] = React.useState<AuthConfigResponse>({
    google_client_id: '',
    google_enabled: false,
    facebook_enabled: false,
    tiktok_enabled: false,
    passkey_enabled: false,
  })
  const [authLoading, setAuthLoading] = React.useState(false)
  const [googleReady, setGoogleReady] = React.useState(false)
  const [accessCode, setAccessCode] = React.useState('')
  const [codeError, setCodeError] = React.useState('')
  const [codeLoading, setCodeLoading] = React.useState(false)
  const [adminAuthOpen, setAdminAuthOpen] = React.useState(false)
  const [adminSecretIn, setAdminSecretIn] = React.useState('')
  const [adminAuthError, setAdminAuthError] = React.useState('')
  const [adminAuthLoading, setAdminAuthLoading] = React.useState(false)

  // Manual payment entry
  const [manualForm, setManualForm] = React.useState({ momoName: '', momoNumber: '', reference: '' })
  const [manualLoading] = React.useState(false)
  const [manualSuccess] = React.useState(false)

  // Subscription info banner
  const [subDaysLeft, setSubDaysLeft] = React.useState<number | null>(null)

  const hasActiveSubscription = (user: AuthUser | null) =>
    Boolean(user?.is_admin || user?.subscription_status === 'active')

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('broxstudies_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const canAccessTab = (tab: AppTab, user: AuthUser | null) => {
    if (tab === 'study') return true
    if (tab === 'admin') return Boolean(user?.is_admin)
    return hasActiveSubscription(user)
  }

  React.useEffect(() => {
    questionsAPI.loadDeferred().catch((err) => {
      console.log('Deferred loading not available or already running:', err)
    })
  }, [])

  React.useEffect(() => {
    const bootstrap = async () => {
      try {
        const [config] = await Promise.all([authAPI.getConfig()])
        setAuthConfig(config)
      } catch (err) {
        console.error('Failed to load auth config', err)
      }

      const guestUsage = window.localStorage.getItem('broxstudies_guest_chats_used')
      if (guestUsage) {
        setGuestChatsUsed(Number(guestUsage) || 0)
      }

      const storedToken = window.localStorage.getItem('broxstudies_access_token')
      if (!storedToken) {
        return
      }

      try {
        setAuthToken(storedToken)
        const user = await authAPI.me()
        setAccount(user)
        
        // Admins bypass subscription verification automatically
        if (user.is_admin) {
          setAuthStep('auth') // Reset step
          setAuthOpen(false)
          setActiveTab('admin')
        } else if (user.subscription_status === 'active') {
          try {
            const sub = await authAPI.getSubscription()
            setSubDaysLeft(sub.days_remaining ?? null)
          } catch { /* non-critical */ }
        } else if (storedToken) {
          // If inactive and not admin, show verify code step
          setAuthStep('verify_code')
          setAuthOpen(true)
        }
      } catch (err) {
        console.error('Stored session is invalid', err)
        window.localStorage.removeItem('broxstudies_access_token')
        setAuthToken(null)
      }
    }

    void bootstrap()
  }, [])

  React.useEffect(() => {
    if (!authConfig.google_enabled || !authConfig.google_client_id) {
      return
    }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null
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

  // Secret Admin Route Detection
  React.useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#admin') {
        if (account?.is_admin) {
          setActiveTab('admin');
        } else {
          setAdminAuthOpen(true);
        }
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [account]);

  const openAuthGate = (target: AuthTarget, mode: AuthMode = 'signup') => {
    if (account && canAccessTab(target, account)) {
      setActiveTab(target)
      return
    }

    setAuthTarget(target)
    setAuthMode(mode)
    setAuthError('')
    setAuthStep(account && !hasActiveSubscription(account) ? 'verify_code' : 'auth')
    setAccessCode('')
    setCodeError('')
    setAuthOpen(true)
  }

  const persistSession = (accessToken: string, user: AuthUser) => {
    window.localStorage.setItem('broxstudies_access_token', accessToken)
    window.localStorage.setItem('broxstudies_guest_chats_used', '0')
    setAuthToken(accessToken)
    setAccount(user)
    setGuestChatsUsed(0)

    // Admins bypass subscription verification and go to dashboard
    if (user.is_admin) {
      setAuthOpen(false)
      setActiveTab('admin')
      return
    }

    // If user is not subscribed yet, move to code-entry step
    if (user.subscription_status !== 'active') {
      setAuthStep('verify_code')
      return
    }

    setAuthOpen(false)
    if (authTarget !== CHAT_TARGET) {
      setActiveTab(authTarget)
    }
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
      setAuthError(err?.response?.data?.detail || 'Authentication failed. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

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
      setActiveTab('admin')
    } catch (err: any) {
      console.error('Admin Auth Error:', err);
      const detail = err?.response?.data?.detail || 
                     (err.code === 'ECONNABORTED' ? 'Connection timed out. Please check your internet.' : 'Invalid admin access code or network error.');
      setAdminAuthError(detail);
    } finally {
      setAdminAuthLoading(false);
    }
  }

  const handleGoogleAuth = () => {
    if (!authConfig.google_enabled || !authConfig.google_client_id) {
      setAuthError('Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID in backend/.env.')
      return
    }

    const googleApi = (window as any).google
    if (!googleReady || !googleApi?.accounts?.id) {
      setAuthError('Google sign-in is still loading. Please try again.')
      return
    }

    setAuthError('')
    try {
      // Trigger the Google Identity prompt (One Tap / Credential Selector)
      googleApi.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed()) {
          console.warn('One Tap not displayed:', notification.getNotDisplayedReason())
          // If One Tap is suppressed (e.g. user closed it before), we might want to 
          // tell the user to try again or use another method, or render a button.
          setAuthError('Sign-in prompt was suppressed. Please try again or use email.')
        }
      })
    } catch (err) {
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

      // Fetch days remaining
      try {
        const sub = await authAPI.getSubscription()
        setSubDaysLeft(sub.days_remaining ?? null)
      } catch { /* non-critical */ }

      setAuthOpen(false)
      if (authTarget !== CHAT_TARGET) {
        setActiveTab(authTarget)
      }
    } catch (err: any) {
      setCodeError(err?.response?.data?.detail || 'Invalid code. Please try again.')
    } finally {
      setCodeLoading(false)
    }
  }

  const handleManualPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
  }

  const handleSkipCode = () => {
    // Allow limited access even without subscription (study tab only, with guest-like restrictions)
    setAuthStep('active')
    setAuthOpen(false)
    setActiveTab('study')
  }

  const handleLogout = () => {
    window.localStorage.removeItem('broxstudies_access_token')
    setAuthToken(null)
    setAccount(null)
    setActiveTab('study')
    setSubDaysLeft(null)
  }

  const consumeGuestChat = () => {
    if (account) {
      return true
    }

    if (guestChatsUsed >= GUEST_CHAT_LIMIT) {
      openAuthGate(CHAT_TARGET, 'signup')
      return false
    }

    const nextValue = guestChatsUsed + 1
    setGuestChatsUsed(nextValue)
    window.localStorage.setItem('broxstudies_guest_chats_used', String(nextValue))
    return true
  }

  const guestChatsRemaining = Math.max(0, GUEST_CHAT_LIMIT - guestChatsUsed)

  const isSubscribed = account?.subscription_status === 'active'

  React.useEffect(() => {
    if (!canAccessTab(activeTab, account)) {
      setActiveTab('study')
    }
  }, [activeTab, account])

  return (
    <div className="app-shell">
      {!isExamSimulating && (
        <header className="topbar">
          <div className="topbar__inner">
            <div className="topbar__brand">
              <div className="brand-mark">B</div>
              BroxStudies
            </div>

            <nav className="topbar__nav">
              <button className={`topbar__nav-btn ${activeTab === 'study' ? 'active' : ''}`} onClick={() => setActiveTab('study')}>
                <Brain size={16} /> Study
              </button>
              <button className={`topbar__nav-btn ${activeTab === 'generator' ? 'active' : ''}`} onClick={() => openAuthGate('generator')}>
                <FileText size={16} /> Practice
              </button>
              <button className={`topbar__nav-btn ${activeTab === 'live_quiz' ? 'active' : ''}`} onClick={() => openAuthGate('live_quiz')}>
                <Zap size={16} /> Live
              </button>
              <button className={`topbar__nav-btn ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => openAuthGate('analysis')}>
                <BarChart3 size={16} /> WASSCE
              </button>
              <button className={`topbar__nav-btn ${activeTab === 'competitions' ? 'active' : ''}`} onClick={() => openAuthGate('competitions')}>
                <Megaphone size={16} /> Competitions
              </button>
              <button className={`topbar__nav-btn ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => openAuthGate('resources')}>
                <BookOpen size={16} /> Library
              </button>
              <button className={`topbar__nav-btn ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => openAuthGate('leaderboard')}>
                <Trophy size={16} /> Ranking
              </button>
              <button className={`topbar__nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => openAuthGate('history')}>
                <Clock size={16} /> History
              </button>
              {account?.is_admin && (
                <button className={`topbar__nav-btn ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')}>
                  <Shield size={16} /> Admin
                </button>
              )}
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <button className="topbar__nav-btn" onClick={toggleTheme}>
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              {account ? (
                <button className="btn-premium btn-premium--primary" onClick={handleLogout}>Log out</button>
              ) : (
                <button className="btn-premium btn-premium--primary" onClick={() => openAuthGate(CHAT_TARGET)}>Login</button>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="app-content">
        {activeTab === 'study' && (
          <StudyCoach
            isAuthenticated={Boolean(account)}
            guestChatsRemaining={guestChatsRemaining}
            guestChatLimit={GUEST_CHAT_LIMIT}
            onRequireAuth={() => openAuthGate(CHAT_TARGET)}
            onConsumeGuestChat={consumeGuestChat}
            userId={account?.id ?? null}
          />
        )}
        {activeTab === 'generator' && <QuestionGenerator onSimulationToggle={(val) => setIsExamSimulating(val)} isSimulating={isExamSimulating} />}
        {activeTab === 'live_quiz' && <LiveQuiz />}
        {activeTab === 'competitions' && <CompetitionPortal />}
        {activeTab === 'analysis' && <AnalysisDashboard />}
        {activeTab === 'resources' && <ResourceFetcher />}
        {activeTab === 'leaderboard' && <GlobalLeaderboard />}
        {activeTab === 'history' && <QuestionGenerator showHistoryOnly={true} />}
        {activeTab === 'admin' && <AdminDashboard />}
      </main>

      {/* ── Auth / Subscription Modal ─────────────────────────────────────── */}
      {authOpen && !isExamSimulating && (
        <div className="auth-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setAuthOpen(false) }}>
          <div className="auth-modal-v2">

            {/* ── Step 1: Login / Signup ───────────────────────────────────── */}
            {authStep === 'auth' && (
              <>
                {/* Header */}
                <div className="authv2__header">
                  <div className="authv2__logo">
                    <div className="authv2__logo-mark">B</div>
                    <span>BroxStudies</span>
                  </div>
                  <h2 className="authv2__title">
                    {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
                  </h2>
                  <p className="authv2__subtitle">
                    {TAB_COPY[authTarget].icon}&nbsp;{TAB_COPY[authTarget].reason}
                  </p>
                </div>

                {/* Tab switcher */}
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

                {/* Google button */}
                <button
                  className="authv2__google-btn"
                  onClick={() => void handleGoogleAuth()}
                  disabled={authLoading || !authConfig.google_enabled}
                  title={!authConfig.google_enabled ? 'Google sign-in not configured' : ''}
                >
                  <GoogleIcon />
                  <span>Continue with Google</span>
                  {!authConfig.google_enabled && <small className="authv2__soon">Coming soon</small>}
                </button>

                {/* Divider */}
                <div className="authv2__divider">
                  <span>or continue with email</span>
                </div>

                {/* Email form */}
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

                <button className="authv2__close" onClick={() => setAuthOpen(false)} aria-label="Close">✕</button>
              </>
            )}

            {/* ── Step 2: Access Code Entry ──────────────────────────────── */}
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
                        Activate Premium
                      </button>
                    </form>
                  </div>

                  {/* Option B: Manual MoMo Submit */}
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
                          onChange={e => setManualForm({...manualForm, momoName: e.target.value})}
                        />
                        <input
                          className="authv2__input"
                          style={{ marginBottom: '8px', fontSize: '0.8rem', padding: '8px' }}
                          type="text"
                          placeholder="Your MoMo Number"
                          required
                          value={manualForm.momoNumber}
                          onChange={e => setManualForm({...manualForm, momoNumber: e.target.value})}
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

                <button className="authv2__close" onClick={() => setAuthOpen(false)} aria-label="Close">✕</button>
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
                {adminAuthLoading ? <span className="authv2__spinner" /> : 'Verification Access'}
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
