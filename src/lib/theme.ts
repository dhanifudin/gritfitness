// Light/dark theme, same mechanism as the official member app: a `.dark` class on <html>,
// persisted in localStorage, light by default. Applied before the app mounts (imported by main.ts).
const KEY = 'grit.theme'

export type Theme = 'light' | 'dark'

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0F172A' : '#1B2A6B')
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* applies for this load only */
  }
  applyTheme(theme)
}

export const toggleTheme = (): Theme => {
  const next = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

applyTheme(getTheme())
