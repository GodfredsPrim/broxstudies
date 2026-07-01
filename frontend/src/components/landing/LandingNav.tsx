import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Sparkles, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/shadcn-button'
import { useTheme } from '@/hooks/useTheme'

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#testimonials', label: 'Testimonials' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export function LandingNavbar() {
  const [open, setOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-[var(--bg-1)]/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-glow-sm">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">BroxStudies</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link to="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Get started free</Button>
            </Link>
            <button
              className="grid h-9 w-9 place-items-center rounded-lg border border-border md:hidden"
              onClick={() => setOpen(v => !v)}
              aria-label="Menu"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-4 mt-2 rounded-2xl border border-border bg-card p-4 md:hidden"
          >
            {LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <Link to="/login" onClick={() => setOpen(false)} className="mt-2 block">
              <Button variant="outline" className="w-full" size="sm">Log in</Button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-[var(--bg-1)]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <Sparkles size={14} className="text-white" />
              </div>
              <span className="font-bold">BroxStudies</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              AI-powered learning for Ghanaian SHS and TVET students. Master WASSCE with confidence.
            </p>
          </div>
          {[
            { title: 'Product', links: ['AI Tutor', 'Practice Exams', 'Study Library', 'Live Quiz'] },
            { title: 'Resources', links: ['Curriculum', 'Past Questions', 'Blog', 'Help Center'] },
            { title: 'Company', links: ['About', 'Contact', 'Privacy', 'Terms'] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold">{col.title}</h4>
              <ul className="mt-4 space-y-2">
                {col.links.map(l => (
                  <li key={l}>
                    <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} BroxStudies. Built for Ghanaian students.</p>
          <p className="text-sm text-muted-foreground">🇬🇭 Proudly Ghanaian</p>
        </div>
      </div>
    </footer>
  )
}
