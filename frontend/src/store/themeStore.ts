import { create } from 'zustand'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'dtsys-theme'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

function getStoredTheme(): Theme {
  const theme = localStorage.getItem(STORAGE_KEY)
  return theme === 'light' ? 'light' : 'dark'
}

interface ThemeState {
  theme: Theme
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getStoredTheme(),
  toggle: () => {
    const nextTheme: Theme = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, nextTheme)
    applyTheme(nextTheme)
    set({ theme: nextTheme })
  },
}))

export function initializeTheme() {
  applyTheme(getStoredTheme())
}
