export type Theme = "system" | "light" | "dark"
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "theme"

export function getStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if (value === "light" || value === "dark" || value === "system") {
      return value
    }
  } catch {
    // ignore
  }
  return "system"
}

export function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") {
    return getSystemDark() ? "dark" : "light"
  }
  return theme
}

export function applyTheme(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme)
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved
  return resolved
}
