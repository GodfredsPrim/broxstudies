import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

/** No explicit user preference yet: light by day, dark by night. */
function timeBasedTheme(): Theme {
  const hour = new Date().getHours()
  return hour >= 19 || hour < 6 ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    applyTheme(theme)
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem('brox.theme', newTheme)
    } catch {
      // Storage may be unavailable in Safari private browsing.
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return { theme, setTheme, toggleTheme, mounted }
}

function readInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    const html = document.documentElement
    if (html.classList.contains('dark')) return 'dark'
    if (html.classList.contains('light')) return 'light'
  }
  try {
    const saved = localStorage.getItem('brox.theme') as Theme | null
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // Fall through to the time-based default.
  }
  return timeBasedTheme()
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.classList.toggle('light', theme === 'light')
  html.classList.toggle('dark', theme === 'dark')
  html.style.colorScheme = theme
}
