import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Brain, FileText, TrendingUp, Zap, Megaphone, Trophy, BookOpen, Clock,
  LogOut, ChevronsLeft, Menu, X, LogIn, UserPlus, Sparkles, Moon, Sun, Settings,
  WifiOff, Download,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useAcademicTrack } from '@/hooks/useAcademicTrack'
import { useTheme } from '@/hooks/useTheme'
import { usePWA } from '@/hooks/usePWA'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { useGuestChats } from '@/hooks/useGuestChats'

interface NavDef {
  to: string
  label: string
  short?: string
  icon: typeof Brain
  group?: 'primary' | 'compete' | 'prep'
}

const NAV: NavDef[] = [
  { to: '/',         label: 'Study with AI',            short: 'Study',     icon: Brain,       group: 'primary' },
  { to: '/practice', label: 'Practice Questions',       short: 'Practice',  icon: FileText,    group: 'primary' },
  { to: '/wassce',   label: 'Likely WASSCE Questions',  short: 'Likely',    icon: TrendingUp,  group: 'primary' },
  { to: '/quiz',     label: 'Quiz Challenge',           short: 'Quiz',      icon: Zap,         group: 'compete' },
  { to: '/news',     label: 'News & Updates',           short: 'News',      icon: Megaphone,   group: 'compete' },
  { to: '/rankings', label: 'Rankings',                 short: 'Rankings',  icon: Trophy,      group: 'compete' },
  { to: '/library',  label: 'Library',                  short: 'Library',   icon: BookOpen,    group: 'prep' },
  { to: '/history',  label: 'History',                  short: 'History',   icon: Clock,       group: 'prep' },
]

export function AppShell() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const { remaining, limit } = useGuestChats()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [devMode, setDevMode] = useState(false)

  useEffect(() => {
    const isDev = localStorage.getItem('brox.admin.dev') === 'true'
    setDevMode(isDev)
  }, [])

  const { selectedTrack, resetAcademicTrack } = useAcademicTrack()
  const { installPrompt, isOffline, install } = usePWA()
  const [installDismissed, setInstallDismissed] = useState(() =>
    localStorage.getItem('brox.pwa.dismissed') === '1'
  )

  const logout = () => {
    signOut()
    navigate('/', { replace: true })
  }

  const initials = (user?.full_name || user?.email || 'BX')
    .split(/[\s@]/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const pageNav = NAV.map(item =>
    item.to === '/wassce' && selectedTrack === 'tvet'
      ? { ...item, label: 'Likely NAPTEX Questions', short: 'NAPTEX' }
      : item,
  )

  const activeNav = pageNav.find(n => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)))
  const isAdmin = location.pathname.startsWith('/admin')
  const currentTitle = isAdmin ? 'Admin Dashboard' : (activeNav?.label || 'BroxStudies')

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — desktop */}
      {!isAdmin && (
        <aside
          className={cn(
            'relative hidden shrink-0 flex-col border-r border-white/5 bg-[var(--bg-1)]/80 backdrop-blur-sm lg:flex',
            collapsed ? 'w-[76px]' : 'w-[256px]',
            'transition-[width] duration-300',
          )}
          style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <Brand collapsed={collapsed} selectedTrack={selectedTrack} />

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
            <NavGroup label="Studio" collapsed={collapsed}>
              {pageNav.filter(n => n.group === 'primary').map(item => (
                <NavItem key={item.to} item={item} collapsed={collapsed} />
              ))}
            </NavGroup>
            <NavGroup label="Compete" collapsed={collapsed}>
              {NAV.filter(n => n.group === 'compete').map(item => (
                <NavItem key={item.to} item={item} collapsed={collapsed} />
              ))}
            </NavGroup>
            <NavGroup label="Prep" collapsed={collapsed}>
              {NAV.filter(n => n.group === 'prep').map(item => (
                <NavItem key={item.to} item={item} collapsed={collapsed} />
              ))}
            </NavGroup>
          </nav>

          {/* Bottom card */}
          <div className="mx-3 mb-3 rounded-xl border border-white/5 bg-[var(--bg-2)] p-3">
            {user ? (
              <>
                {!collapsed && (
                  <div className="mb-2">
                    <div className="v2-eyebrow mb-1.5">Signed in</div>
                    <div className="truncate text-sm font-semibold text-ink-0">{user.full_name || user.email}</div>
                    <div className="truncate text-xs text-ink-400">{user.email}</div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-[13px] font-bold text-emerald-300 ring-1 ring-emerald-400/20">
                    {initials}
                  </div>
                  {!collapsed && (
                    <div className="flex flex-1 justify-end gap-1">
                      <button
                        onClick={logout}
                        className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                        aria-label="Sign out"
                      >
                        <LogOut size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {!collapsed && (
                  <>
                    <div className="v2-eyebrow mb-1.5">Guest</div>
                    <div className="mb-2 text-xs text-ink-300">
                      {remaining}/{limit} free AI chats
                    </div>
                  </>
                )}
                <div className="flex flex-col gap-1.5">
                  <NavLink to="/signup" className="v2-btn v2-btn-primary h-9 !px-3 text-[12.5px]">
                    <UserPlus size={13} /> {!collapsed && 'Sign up'}
                  </NavLink>
                  <NavLink to="/login" className="v2-btn v2-btn-ghost h-9 !px-3 text-[12.5px]">
                    <LogIn size={13} /> {!collapsed && 'Log in'}
                  </NavLink>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setCollapsed(c => !c)}
            className="absolute -right-3 top-24 grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-[var(--bg-1)] text-ink-400 transition-colors hover:bg-[var(--bg-2)] hover:text-ink-0"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronsLeft size={12} className={cn('transition-transform', collapsed && 'rotate-180')} />
          </button>
        </aside>
      )}

      {/* Mobile drawer */}
      {!isAdmin && (
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col border-r border-white/5 bg-[var(--bg-1)] lg:hidden"
              >
                <div className="flex items-center justify-between px-4 py-4">
                  <Brand collapsed={false} selectedTrack={selectedTrack} />
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-white/5 hover:text-ink-0"
                    aria-label="Close menu"
                  >
                    <X size={18} />
                  </button>
                </div>
                <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
                  <NavGroup label="Studio" collapsed={false}>
                    {pageNav.filter(n => n.group === 'primary').map(item => (
                      <NavItem key={item.to} item={item} collapsed={false} onNavigate={() => setMobileOpen(false)} />
                    ))}
                  </NavGroup>
                  <NavGroup label="Compete" collapsed={false}>
                    {NAV.filter(n => n.group === 'compete').map(item => (
                      <NavItem key={item.to} item={item} collapsed={false} onNavigate={() => setMobileOpen(false)} />
                    ))}
                  </NavGroup>
                  <NavGroup label="Prep" collapsed={false}>
                    {NAV.filter(n => n.group === 'prep').map(item => (
                      <NavItem key={item.to} item={item} collapsed={false} onNavigate={() => setMobileOpen(false)} />
                    ))}
                  </NavGroup>
                </nav>
                <div className="mx-3 mb-3 rounded-xl border border-white/5 bg-[var(--bg-2)] p-3">
                  {user ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-[13px] font-bold text-emerald-300 ring-1 ring-emerald-400/20">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink-0">{user.full_name || user.email}</div>
                          <div className="truncate text-xs text-ink-400">{user.email}</div>
                        </div>
                      </div>
                      {selectedTrack && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-300">
                            {selectedTrack.toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={resetAcademicTrack}
                            className="text-xs font-semibold text-ink-300 underline underline-offset-2 decoration-ink-500/20 hover:text-ink-0"
                          >
                            Change track
                          </button>
                        </div>
                      )}
                      <button
                        onClick={logout}
                        className="mt-3 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-rose-500/10 hover:text-rose-400"
                        aria-label="Sign out"
                      >
                        <LogOut size={16} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="v2-eyebrow">Guest — {remaining}/{limit} free chats</div>
                      <div className="flex gap-2">
                        <NavLink
                          to="/signup"
                          onClick={() => setMobileOpen(false)}
                          className="v2-btn v2-btn-primary h-9 flex-1 !px-3 text-[12.5px]"
                        >
                          <UserPlus size={13} /> Sign up
                        </NavLink>
                        <NavLink
                          to="/login"
                          onClick={() => setMobileOpen(false)}
                          className="v2-btn v2-btn-ghost h-9 flex-1 !px-3 text-[12.5px]"
                        >
                          <LogIn size={13} /> Log in
                        </NavLink>
                      </div>
                    </div>
                  )}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/5 bg-[var(--bg-0)]/70 px-4 backdrop-blur-xl lg:px-8">
          {!isAdmin && (
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-white/5 hover:text-ink-0 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          )}
          <div className="v2-eyebrow hidden sm:flex sm:items-center sm:gap-2">
            <span>BroxStudies · {selectedTrack ? selectedTrack.toUpperCase() : 'SHS / TVET'}</span>
            <span className="text-[var(--fg-3)]">/</span>
            <span className="text-[var(--fg-1)]">{currentTitle}</span>
          </div>
          <div className="flex-1" />
          {!user && (
            <Badge tone="accent" className="hidden sm:inline-flex">
              <Sparkles size={10} /> {remaining}/{limit} free
            </Badge>
          )}
          <button
            onClick={toggleTheme}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-white/5 hover:text-ink-0 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {user?.is_admin || devMode ? (
            <NavLink
              to="/admin"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-white/5 hover:text-ink-0 transition-colors"
              title="Admin Dashboard"
            >
              <Settings size={16} />
            </NavLink>
          ) : null}
          <NavLink
            to="/"
            className={({ isActive }) =>
              cn('v2-btn v2-btn-primary h-9 !px-4 text-[13px]', isActive && 'pointer-events-none opacity-70')
            }
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">Start studying</span>
            <span className="sm:hidden">Study</span>
          </NavLink>
        </header>

        {/* Offline indicator */}
        {isOffline && (
          <div className="flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
            <WifiOff size={14} />
            You're offline — previously loaded content is still available
          </div>
        )}

        {/* PWA install banner */}
        {installPrompt && !installDismissed && !isOffline && (
          <div className="flex items-center justify-between gap-3 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 sm:px-8">
            <p className="text-sm text-emerald-300">
              Install BroxStudies for offline access and a better experience.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => install()}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Download size={12} />
                Install
              </button>
              <button
                onClick={() => { setInstallDismissed(true); localStorage.setItem('brox.pwa.dismissed', '1') }}
                className="grid h-7 w-7 place-items-center rounded-lg text-emerald-400 hover:bg-white/5"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

function Brand({ collapsed, selectedTrack }: { collapsed: boolean; selectedTrack: string | null }) {
  return (
    <NavLink to="/" className={cn('flex items-center gap-3 px-5 pb-5 pt-6', collapsed && 'justify-center px-0')}>
      <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 shadow-glow-sm">
        <div className="v2-mesh" style={{ inset: 0, filter: 'blur(8px)', opacity: 0.8 }} />
        <span className="relative font-display text-lg text-[#02180F]">Bx</span>
      </div>
       {!collapsed && (
         <div className="min-w-0">
           <div className="truncate font-display text-[20px] leading-none text-[var(--fg-0)]">BroxStudies</div>
           <div className="mt-1 text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
             {selectedTrack ? `for ${selectedTrack.toUpperCase()}` : 'for SHS & TVET'}
           </div>
         </div>
       )}
    </NavLink>
  )
}

function NavGroup({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed: boolean
  children: React.ReactNode
}) {
  return (
    <div className="pt-3 first:pt-0">
      {!collapsed && (
        <div className="px-3 pb-1.5">
          <span className="v2-eyebrow !text-[9.5px]">{label}</span>
        </div>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

interface NavItemProps {
  item: NavDef
  collapsed: boolean
  onNavigate?: () => void
}

function NavItem({ item, collapsed, onNavigate }: NavItemProps) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
          isActive
            ? 'bg-emerald-500/10 text-emerald-200'
            : 'text-ink-300 hover:bg-white/5 hover:text-ink-0',
          collapsed && 'justify-center px-0',
        )
      }
      title={collapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <motion.span
              layoutId="nav-active"
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            />
          )}
          <Icon size={16} className="shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  )
}
