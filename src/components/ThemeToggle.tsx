import { useState } from 'react'

type Theme = 'auto' | 'light' | 'dark'
const SUIVANT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }
const LIBELLE: Record<Theme, string> = { auto: 'Auto', light: 'Clair', dark: 'Sombre' }

/** Bouton de thème commun à tout le site : auto (système) → clair → sombre ; appliqué par data-theme sur <html> (voir index.html). */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const t = document.documentElement.dataset.theme
    return t === 'light' || t === 'dark' ? t : 'auto'
  })
  const changer = () => {
    const t = SUIVANT[theme]
    if (t === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = t
    try {
      if (t === 'auto') localStorage.removeItem('theme')
      else localStorage.setItem('theme', t)
    } catch {
      // stockage indisponible (navigation privée) : le choix vaut pour la session
    }
    setTheme(t)
  }
  return (
    <button
      type="button"
      onClick={changer}
      aria-label={`Thème : ${LIBELLE[theme]} (changer)`}
      title="Changer de thème"
      className="fixed right-3 bottom-3 z-50 inline-flex h-8 items-center gap-1.5 rounded-full bg-card px-3 font-mono text-xs text-ink shadow-sm ring-1 ring-line hover:bg-card-2 print:hidden"
    >
      <span aria-hidden>{theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}</span>
      {LIBELLE[theme]}
    </button>
  )
}
