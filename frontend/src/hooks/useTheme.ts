import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('brox.theme') as Theme | null
    const initial: Theme = saved === 'dark' || saved === 'light' ? saved : 'light'
    setThemeState(initial)
    applyTheme(initial)
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('brox.theme', newTheme)
    applyTheme(newTheme)
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return { theme, setTheme, toggleTheme, mounted }
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'light') {
    html.classList.add('light')
    html.classList.remove('dark')
  } else {
    html.classList.remove('light')
    html.classList.add('dark')
  }
}
