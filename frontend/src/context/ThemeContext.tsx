import React, { createContext, useContext, useState, useEffect } from 'react'

export type ThemeMode = 'dark' | 'light'
export type AccentPalette = 'emerald_copper' | 'cobalt_gold' | 'crimson_titanium' | 'quantum_indigo'

interface ThemeContextType {
  mode: ThemeMode
  palette: AccentPalette
  toggleMode: () => void
  setMode: (m: ThemeMode) => void
  setPalette: (p: AccentPalette) => void
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
  mode: 'light',
  palette: 'emerald_copper',
  toggleMode: () => {},
  setMode: () => {},
  setPalette: () => {}
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('nl_theme_mode')
    return (saved === 'light' || saved === 'dark') ? saved : 'light'
  })

  const [palette, setPaletteState] = useState<AccentPalette>(() => {
    const saved = localStorage.getItem('nl_theme_palette') as AccentPalette
    return saved && PALETTE_META[saved] ? saved : 'emerald_copper'
  })

  useEffect(() => {
    localStorage.setItem('nl_theme_mode', mode)
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  useEffect(() => {
    localStorage.setItem('nl_theme_palette', palette)
    document.documentElement.setAttribute('data-palette', palette)
  }, [palette])

  function toggleMode() {
    setModeState(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider
      value={{
        mode,
        palette,
        toggleMode,
        setMode: setModeState,
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

