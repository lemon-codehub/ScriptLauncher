import { create } from 'zustand'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const storageKey = 'script-launcher-theme'
const systemThemeQuery = '(prefers-color-scheme: dark)'

function storedPreference(): ThemePreference {
  const value = window.localStorage.getItem(storageKey)
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference
  return window.matchMedia(systemThemeQuery).matches ? 'dark' : 'light'
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

const initialPreference = storedPreference()
const initialResolvedTheme = resolveTheme(initialPreference)
applyTheme(initialResolvedTheme)

interface ThemeStore {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  syncSystemTheme: () => void
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  preference: initialPreference,
  resolvedTheme: initialResolvedTheme,
  setPreference: (preference) => {
    const resolvedTheme = resolveTheme(preference)
    window.localStorage.setItem(storageKey, preference)
    applyTheme(resolvedTheme)
    set({ preference, resolvedTheme })
  },
  syncSystemTheme: () => {
    if (get().preference !== 'system') return
    const resolvedTheme = resolveTheme('system')
    applyTheme(resolvedTheme)
    set({ resolvedTheme })
  },
}))

export function watchSystemTheme() {
  const media = window.matchMedia(systemThemeQuery)
  const onChange = () => useThemeStore.getState().syncSystemTheme()
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
