import React, { createContext, useContext, useState, useEffect } from 'react'

export type ThemeMode = 'dark' | 'light'
export type ThemePreference = 'system' | ThemeMode
export type AccentPalette = 'emerald_copper' | 'cobalt_gold' | 'crimson_titanium' | 'quantum_indigo'

interface ThemeContextType {
  mode: ThemeMode
  preference: ThemePreference
  systemMode: ThemeMode
  palette: AccentPalette
  toggleMode: () => void
  setMode: (m: ThemePreference) => void
  setPalette: (p: AccentPalette) => void
}

function getSystemThemeMode(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const PALETTE_META: Record<AccentPalette, {
  name: string
  subtitle: string
  primaryHex: string
  secondaryHex: string
}> = {
  emerald_copper: {
    name: 'Esmeralda Suiza & Cobre',
    subtitle: 'Instrumentación Científica',
    primaryHex: '#0d9488',
    secondaryHex: '#d97706'
  },
  cobalt_gold: {
    name: 'Cobalto & Oro Ámbar',
    subtitle: 'Ingeniería Aeroespacial',
    primaryHex: '#0284c7',
    secondaryHex: '#ca8a04'
  },
  crimson_titanium: {
    name: 'Láser Carmesí & Titanio',
    subtitle: 'Alto Contraste Táctico',
    primaryHex: '#e11d48',
    secondaryHex: '#0891b2'
  },
  quantum_indigo: {
    name: 'Índigo Cuántico & Cian',
    subtitle: 'Laboratorio Deep Learning',
    primaryHex: '#4f46e5',
    secondaryHex: '#06b6d4'
  }
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  preference: 'system',
  systemMode: 'dark',
  palette: 'emerald_copper',
  toggleMode: () => {},
  setMode: () => {},
  setPalette: () => {}
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [systemMode, setSystemMode] = useState<ThemeMode>(getSystemThemeMode)
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('nl_theme_mode')
    return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system'
  })

  const [palette, setPaletteState] = useState<AccentPalette>(() => {
    const saved = localStorage.getItem('nl_theme_palette') as AccentPalette
    return saved && PALETTE_META[saved] ? saved : 'emerald_copper'
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const mode: ThemeMode = preference === 'system' ? systemMode : preference

  useEffect(() => {
    localStorage.setItem('nl_theme_mode', preference)
    document.documentElement.setAttribute('data-theme', mode)
  }, [preference, mode])

  useEffect(() => {
    localStorage.setItem('nl_theme_palette', palette)
    document.documentElement.setAttribute('data-palette', palette)
  }, [palette])

  function toggleMode() {
    setPreferenceState(mode === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider
      value={{
        mode,
        preference,
        systemMode,
        palette,
        toggleMode,
        setMode: setPreferenceState,
        setPalette: setPaletteState
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

