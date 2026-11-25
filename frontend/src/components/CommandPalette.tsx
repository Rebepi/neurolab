import { useState, useEffect, useRef } from 'react'
import {
  Search, LayoutDashboard, Sparkles, Brain, FolderKanban,
  Database, Network, Play, BarChart2, Package, FileText,
  Settings, Sun, Moon, Palette, Shield, ArrowRight, X, CornerDownLeft, ScrollText, BookOpen
} from 'lucide-react'
import { useTheme, PALETTE_META, AccentPalette } from '../context/ThemeContext'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigate: (module: string) => void
}

interface CommandItem {
  id: string
  category: string
  title: string
  subtitle: string
  shortcut?: string
  Icon: any
  action: () => void
}

export default function CommandPalette({ open, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { mode, toggleMode, setPalette } = useTheme()

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const items: CommandItem[] = [
    {
      id: 'nav-dashboard',
      category: 'Centro Corporativo Aura Telecom',
      title: 'M01 · Centro de Mando Multi-Área',
      subtitle: 'Las 4 áreas de Aura Telecom y topología neuronal viva',
      shortcut: 'G D',
      Icon: LayoutDashboard,
      action: () => { onNavigate('dashboard'); onClose() }
    },
    {
      id: 'nav-visualizer',
      category: 'Centro Corporativo Aura Telecom',
      title: 'M11 · Inspector Sináptico Real (.keras)',
      subtitle: 'Pesos W, sesgos b y activaciones reales del modelo entrenado',
      shortcut: 'G V',
      Icon: Sparkles,
      action: () => { onNavigate('visualizer'); onClose() }
    },
    {
      id: 'nav-fundamentals',
      category: 'Centro Corporativo Aura Telecom',
      title: 'M03 · Fundamentos de Redes Neuronales',
      subtitle: 'Simulador interactivo de neurona, activaciones, catálogo y glosario',
      shortcut: 'G F',
      Icon: BookOpen,
      action: () => { onNavigate('fundamentals'); onClose() }
    },
    {
      id: 'nav-projects',
      category: 'Pipeline por Área IA',
      title: 'Paso 01 · Áreas Corporativas Aura Telecom (M02)',
      subtitle: 'Gestionar áreas operativas, miembros y alcance',
      shortcut: '1',
      Icon: FolderKanban,
      action: () => { onNavigate('projects'); onClose() }
    },
    {
      id: 'nav-datasets',
      category: 'Pipeline por Área IA',
      title: 'Paso 02 · Datasets, Auto-EDA & Splits 70/15/15 (M05)',
      subtitle: 'Cargar CSV, limpiar nulos, One-Hot y aislar conjunto Test',
      shortcut: '2',
      Icon: Database,
      action: () => { onNavigate('datasets'); onClose() }
    },
    {
      id: 'nav-architectures',
      category: 'Pipeline por Área IA',
      title: 'Paso 03 · Diseñador de Arquitecturas Neuronales (M04)',
      subtitle: 'Configurar capas Dense/Dropout/BatchNorm y código Keras',
      shortcut: '3',
      Icon: Network,
      action: () => { onNavigate('architectures'); onClose() }
    },
    {
      id: 'nav-training',
      category: 'Pipeline por Área IA',
      title: 'Paso 04 · Entrenamientos TensorFlow/Keras en Vivo (M06)',
      subtitle: 'Lanzar entrenamientos reales con streaming SSE época por época',
      shortcut: '4',
      Icon: Play,
      action: () => { onNavigate('training'); onClose() }
    },
    {
      id: 'nav-evaluation',
      category: 'Pipeline por Área IA',
      title: 'Paso 05 · Evaluación, Curvas & Matriz de Confusión (M07)',
      subtitle: 'Inspeccionar Loss/Accuracy y evaluar contra Test aislado',
      shortcut: '5',
      Icon: BarChart2,
      action: () => { onNavigate('evaluation'); onClose() }
    },
    {
      id: 'nav-models',
      category: 'Pipeline por Área IA',
      title: 'Paso 06 · Model Registry & Certificación SHA-256 (M08)',
      subtitle: 'Versiones inmutables SHA-256 y descarga .keras',
      shortcut: '6',
      Icon: Package,
      action: () => { onNavigate('models'); onClose() }
    },
    {
      id: 'nav-predict',
      category: 'Centro Corporativo',
      title: 'Usar Modelos IA (Predicción Directa y CSV)',
      subtitle: 'Ingresar datos reales en español o subir CSV para predecir al instante',
      Icon: Brain,
      action: () => { onNavigate('predict'); onClose() }
    },
    {
      id: 'nav-inference',
      category: 'Pipeline por Área IA',
      title: 'Paso 07 · Inferencia en Vivo & Simulador What-If (M10)',
      subtitle: 'Inferencia real Keras, grafo neuronal, simulación What-If y radar batch',
      shortcut: '7',
      Icon: Brain,
      action: () => { onNavigate('inference'); onClose() }
    },
    {
      id: 'nav-reports',
      category: 'Gobernanza & Reportes',
      title: 'M09 · Certificación y Exportación PDF / CSV',
      subtitle: 'Generar reporte técnico completo del proyecto y modelos',
      Icon: FileText,
      action: () => { onNavigate('reports'); onClose() }
    },
    {
      id: 'nav-admin',
      category: 'Gobernanza & Reportes',
      title: 'Usuarios & RBAC',
      subtitle: 'Gestionar usuarios, altas y permisos por rol RBAC',
      Icon: Shield,
      action: () => { onNavigate('admin'); onClose() }
    },
    {
      id: 'nav-audit',
      category: 'Gobernanza & Reportes',
      title: 'Auditoría Global',
      subtitle: 'Bitácora inmutable de eventos del sistema y exportación JSON',
      Icon: ScrollText,
      action: () => { onNavigate('audit'); onClose() }
    },
    {
      id: 'nav-settings',
      category: 'Gobernanza & Reportes',
      title: 'Configuración & Cuotas',
      subtitle: 'Límites de entrenamiento, aceleración GPU y apariencia visual',
      Icon: Settings,
      action: () => { onNavigate('settings'); onClose() }
    },
    {
      id: 'theme-toggle',
      category: 'Apariencia & Sistema de Diseño',
      title: mode === 'dark' ? 'Cambiar a Modo Claro (Editorial Daylight)' : 'Cambiar a Modo Oscuro (Obsidian Carbon)',
      subtitle: 'Alternar luminancia global de toda la estación de trabajo',
      shortcut: '⌘ J',
      Icon: mode === 'dark' ? Sun : Moon,
      action: () => { toggleMode(); onClose() }
    },
    ...(Object.entries(PALETTE_META) as Array<[AccentPalette, typeof PALETTE_META[AccentPalette]]>).map(([key, meta]) => ({
      id: `palette-${key}`,
      category: 'Firmas Cromáticas',
      title: `Firma: ${meta.name}`,
      subtitle: meta.subtitle,
      Icon: Palette,
      action: () => { setPalette(key); onClose() }
    }))
  ]

  const filtered = items.filter(it => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      it.title.toLowerCase().includes(q) ||
      it.subtitle.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (filtered.length > 0 ? (i + 1) % filtered.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0))
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault()
        filtered[selectedIndex].action()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, filtered, selectedIndex, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-md animate-backdrop-fade"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-2xl nl-cyber-panel rounded-2xl overflow-hidden shadow-2xl animate-pop-in">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800/80">
          <Search className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar módulo, comando, modo claro/oscuro, paleta o rol RBAC..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No se encontraron comandos para "{query}"
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.Icon
              const isSel = idx === selectedIndex
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    isSel ? 'bg-cyan-500/15 border border-cyan-500/40 shadow-sm shadow-cyan-500/10' : 'border border-transparent hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSel ? 'nl-accent-bg shadow-sm' : 'bg-slate-800 text-slate-300'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{item.title}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                        {item.shortcut}
                      </span>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 transition-transform ${
                      isSel ? 'text-cyan-400 translate-x-0.5' : 'text-slate-500'
                    }`} />
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" /> Ejecutar
            </span>
            <span>↑↓ Navegar</span>
            <span>ESC Cerrar</span>
          </div>
          <span className="font-mono text-[10px]">NeuroLab Spotlight Engine</span>
        </div>
      </div>
    </div>
  )
}

