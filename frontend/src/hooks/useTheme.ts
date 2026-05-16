import { useState, useEffect } from 'react'

export type Theme = 'dark'

export function useTheme() {
  const [theme] = useState<Theme>('dark')

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark'
    localStorage.setItem('qontint-theme', 'dark')
  }, [])

  const toggleTheme = () => {
    // Disabled
  }

  const setTheme = (_newTheme: Theme) => {
    // Disabled
  }

  return { theme, toggleTheme, setTheme }
}
