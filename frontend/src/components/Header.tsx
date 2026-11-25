import { useState, useEffect } from 'react'
import {
  LogOut, ChevronDown, Shield,
  Sun, Moon
} from 'lucide-react'
import { User } from '../types'
import { useTheme } from '../context/ThemeContext'
import { api } from '../services/api'
import { SystemTooltip } from './InfoTip'

const MODULE_LABELS: Record<string, { title: string; description: string }> = {
  dashboard: {
    title: 'Centro de Mando',
    description: 'Resumen operativo, métricas clave en tiempo real, estado del motor TensorFlow y ejecuciones recientes.',
  },
  predict: {
    title: 'Usar Modelos IA',
    description: 'Ingresa datos reales en lenguaje sencillo o sube un CSV nuevo para obtener predicciones inmediatas y recomendaciones.',
  },
  visualizer: {
    title: 'Motor Sináptico Real',
    description: 'Inspección capa por capa de pesos W, sesgos b y activaciones reales del modelo entrenado .keras.',
  },
  projects: {
    title: 'Áreas Corporativas',
    description: 'Gestiona áreas de trabajo de aprendizaje profundo, miembros y fusión cross-área 360°.',
  },
  fundamentals: {
    title: 'Fundamentos IA',
    description: 'Laboratorio interactivo de neuronas artificiales, funciones de activación, fronteras 2D, redes y glosario.',
  },
  architectures: {
    title: 'Diseñador de Arquitecturas',
    description: 'Constructor visual de topologías neuronales compatibles con el dataset, parámetros y código Keras.',
  },
  datasets: {
    title: 'Datasets & Auto-EDA',
    description: 'Carga archivos CSV, fusiona datasets por área e inspecciona particiones 70/15/15 Train/Val/Test.',
  },
  training: {
    title: 'Entrenamientos Keras',
    description: 'Configura hiperparámetros, lanza entrenamientos reales con TensorFlow y monitorea curvas SSE en vivo.',
  },
  evaluation: {
    title: 'Evaluación & Matriz Test',
    description: 'Curvas de aprendizaje Train/Val, métricas sobre Test sellado (15%), matriz de confusión y comparativa.',
  },
  models: {
    title: 'Model Registry',
    description: 'Versiones inmutables, verificación SHA-256, descarga de artefactos .keras, simulador y aprobación.',
  },
  inference: {
    title: 'Inferencia en Vivo',
    description: 'Ejecuta predicciones reales sobre modelos .keras entrenados con grafo neuronal capa por capa y simulación What-If.',
  },
  reports: {
    title: 'Reportes Ejecutivos',
    description: 'Consolidado técnico verificable, diagnóstico de generalización, notas de auditoría y exportación PDF/JSON/CSV.',
  },
  admin: {
    title: 'Usuarios & RBAC',
    description: 'Directorio de usuarios, creación de cuentas, estados de acceso y asignación de roles RBAC.',
  },
  audit: {
    title: 'Auditoría Global',
    description: 'Bitácora cronológica inmutable de eventos del sistema, filtros por acción y exportación JSON.',
  },
  settings: {
    title: 'Configuración',
    description: 'Cuotas operativas del sistema, límites de entrenamiento, aceleración TensorFlow y preferencias visuales.',
  },
}

interface HeaderProps {
  activeModule: string
  currentProject?: { id: string; name: string } | null
  onSelectProject?: (proj: { id: string; name: string }) => void
  onOpenCommandPalette?: () => void
  onLogout: () => void
  user: User
}

export default function Header({
  activeModule,
  currentProject,
  onLogout,
  user
}: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [cpuInfo, setCpuInfo] = useState<{ cpuPct: number; ramPct: number } | null>(null)
  const [tipDiscovered, setTipDiscovered] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nl_header_title_tip_seen') === '1'
    } catch {
      return false
    }
  })
  const { mode, preference, toggleMode } = useTheme()

  function handleDiscoverTitleTip() {
    if (tipDiscovered) return
    setTipDiscovered(true)
    try {
      localStorage.setItem('nl_header_title_tip_seen', '1')
    } catch {}
  }

  useEffect(() => {
    api.getOverview().then(ov => {
      if (ov.compute_telemetry) {
        setCpuInfo({ cpuPct: ov.compute_telemetry.cpu_pct, ramPct: ov.compute_telemetry.ram_pct })
      }
    }).catch(() => {})
  }, [activeModule, currentProject?.id])

  const initials = user.display_name
    ? user.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'NL'

  const modInfo = MODULE_LABELS[activeModule] || {
    title: activeModule,
    description: 'Módulo operativo de Aura Telecom AI Studio.',
  }

  return (
    <header className="relative h-16 shrink-0 bg-[#050d1e]/92 backdrop-blur-xl border-b border-cyan-500/20 px-5 flex items-center justify-between gap-4 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <SystemTooltip title={modInfo.title} label={modInfo.description} side="bottom">
          <div
            key={activeModule}
            tabIndex={0}
            onMouseEnter={handleDiscoverTitleTip}
            onFocus={handleDiscoverTitleTip}
            className={`group flex items-center gap-2 min-w-0 animate-pop-in cursor-help py-1.5 px-3 rounded-xl border hover:bg-slate-800/40 transition-colors focus:outline-none ${
              !tipDiscovered ? 'nl-title-hint-pulse border-cyan-400/40' : 'border-transparent hover:border-slate-700/60'
            }`}
          >
            <h2 className="text-white font-bold text-sm sm:text-base tracking-tight truncate">
              {modInfo.title}
            </h2>
          </div>
        </SystemTooltip>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {cpuInfo && (
          <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#071329]/95 border border-emerald-500/30 text-[11px] font-mono shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span className="text-slate-200 font-semibold">TensorFlow · CPU</span>
            <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
                style={{ width: `${Math.max(6, Math.min(100, cpuInfo.cpuPct))}%` }}
              />
            </div>
            <span className="text-emerald-300 font-bold">{cpuInfo.cpuPct.toFixed(0)}%</span>
            <span className="text-slate-600 hidden 2xl:inline">·</span>
            <span className="text-cyan-300 hidden 2xl:inline">RAM {cpuInfo.ramPct.toFixed(0)}%</span>
          </div>
        )}

        <SystemTooltip
          title={
            preference === 'system'
              ? `Tema del sistema (${mode === 'dark' ? 'Oscuro' : 'Claro'})`
              : mode === 'dark'
                ? 'Modo Oscuro activo'
                : 'Modo Claro activo'
          }
          label={
            mode === 'dark'
              ? 'Haz clic para cambiar a Modo Claro. Puedes volver a «Sistema (Auto)» en Configuración.'
              : 'Haz clic para cambiar a Modo Oscuro. Puedes volver a «Sistema (Auto)» en Configuración.'
          }
          side="bottom"
        >
          <button
            type="button"
            onClick={toggleMode}
            className="p-2 rounded-xl bg-[#071329]/95 hover:bg-slate-800 border border-cyan-500/25 hover:border-cyan-400/50 text-cyan-300 transition-all"
            aria-label="Cambiar tema"
          >
            {mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </SystemTooltip>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(d => !d)}
            className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#071329]/95 hover:bg-slate-800 border border-cyan-500/25 transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950 flex items-center justify-center text-[11px] font-extrabold shadow-xs group-hover:scale-105 transition-transform">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-white text-xs font-bold leading-tight max-w-28 truncate">{user.display_name}</p>
              <p className="text-cyan-300 text-[10px] font-mono leading-tight">{user.role}</p>
            </div>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-64 z-20 nl-cyber-panel rounded-2xl overflow-hidden shadow-2xl animate-pop-in">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 space-y-1.5">
                  <p className="text-white text-sm font-bold">{user.display_name}</p>
                  <p className="text-slate-400 text-xs font-mono">{user.email}</p>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 text-[10px] font-mono font-semibold">
                    <Shield className="w-3 h-3" />
                    {user.role}
                  </span>
                </div>

                <button
                  onClick={() => { setShowDropdown(false); onLogout() }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold text-rose-400 hover:bg-rose-950/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
