import { useState, useEffect } from 'react'
import {
  LogOut, ChevronDown, Shield, Check, FolderKanban,
  Layers, Sun, Moon
} from 'lucide-react'
import { User, UserRole, Project } from '../types'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { api } from '../services/api'
import { SystemTooltip } from './InfoTip'
import { useToast } from './toast/ToastContext'

const MODULE_LABELS: Record<string, { title: string; description: string }> = {
  dashboard: {
    title: 'Centro de Mando',
    description: 'Resumen operativo, métricas clave en tiempo real, estado del motor TensorFlow y ejecuciones recientes.',
  },
  visualizer: {
    title: 'Motor Sináptico en Vivo',
    description: 'Simulación interactiva capa por capa de Forward Pass, retropropagación, gradientes y pesos sinápticos.',
  },
  projects: {
    title: 'Proyectos & Workspaces',
    description: 'Gestiona espacios de trabajo de aprendizaje profundo, miembros, etiquetas y bitácoras por proyecto.',
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
    description: 'Carga archivos CSV, inspecciona estadísticas, nulos, correlación y particiones 70/15/15 Train/Val/Test.',
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
    description: 'Cuotas operativas del sistema, límites de entrenamiento, aceleración GPU y preferencias visuales.',
  },
}

const ROLES_LIST: UserRole[] = [
  'Administrador',
  'Responsable de proyecto',
  'Ingeniero/analista de IA',
  'Revisor',
  'Lector',
]

interface HeaderProps {
  activeModule: string
  currentProject?: { id: string; name: string } | null
  onSelectProject?: (proj: { id: string; name: string }) => void
  onLogout: () => void
  user: User
}

export default function Header({
  activeModule,
  currentProject,
  onSelectProject,
  onLogout,
  user
}: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const { switchDemoRole } = useAuth()
  const { mode, setMode } = useTheme()
  const toast = useToast()

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {})
  }, [activeModule, currentProject?.id])

  const initials = user.display_name
    ? user.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'NL'

  const modInfo = MODULE_LABELS[activeModule] || {
    title: activeModule,
    description: 'Módulo operativo de NeuroLab Deep Learning Studio.',
  }

  return (
    <header className="relative h-16 shrink-0 nl-surface border-b border-slate-800/80 px-5 flex items-center justify-between gap-3 z-30">
      <div className="flex items-center gap-2 min-w-0">
        <SystemTooltip title={modInfo.title} label={modInfo.description} side="bottom">
          <div key={activeModule} className="flex items-center min-w-0 animate-pop-in cursor-help py-1 px-2 -ml-2 rounded-xl hover:bg-slate-800/40 transition-colors">
            <h2 className="text-white font-bold text-xs sm:text-sm truncate">
              {modInfo.title}
            </h2>
          </div>
        </SystemTooltip>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {currentProject && (
          <div className="relative">
            <button
              onClick={() => setShowProjectMenu(p => !p)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-white transition-all group"
            >
              <FolderKanban className="w-3.5 h-3.5 text-indigo-400 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate max-w-40">{currentProject.name}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 shrink-0 transition-transform duration-200 ${showProjectMenu ? 'rotate-180' : ''}`} />
            </button>

            {showProjectMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowProjectMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 z-20 nl-surface rounded-2xl p-2 shadow-2xl animate-pop-in">
                  <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-indigo-400" />
                    Cambiar Workspace Activo
                  </p>
                  <div className="space-y-0.5 max-h-56 overflow-y-auto mt-1">
                    {projects.map(p => {
                      const isCur = p.id === currentProject.id
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            onSelectProject?.({ id: p.id, name: p.name })
                            setShowProjectMenu(false)
                            if (p.id !== currentProject.id) {
                              toast.info('Proyecto activo cambiado', p.name)
                            }
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors ${
                            isCur
                              ? 'bg-slate-800 text-white font-bold border border-slate-700'
                              : 'text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <span className="truncate">{p.name}</span>
                          {isCur && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="relative grid grid-cols-2 p-0.5 rounded-xl bg-slate-950 border border-slate-800">
          <span
            className={`pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-lg nl-accent-bg nl-accent-glow transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              mode === 'dark' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />
          <SystemTooltip label="Activar Modo Claro (Editorial Daylight)" side="bottom">
            <button
              onClick={() => setMode('light')}
              className={`relative z-10 flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                mode === 'light'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              aria-label="Activar Modo Claro"
            >
              <Sun className={`w-3 h-3 transition-transform duration-300 ${mode === 'light' ? 'rotate-0 scale-110' : '-rotate-45'}`} />
              <span className="hidden sm:inline">Claro</span>
            </button>
          </SystemTooltip>
          <SystemTooltip label="Activar Modo Oscuro (Obsidian Carbon)" side="bottom">
            <button
              onClick={() => setMode('dark')}
              className={`relative z-10 flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                mode === 'dark'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              aria-label="Activar Modo Oscuro"
            >
              <Moon className={`w-3 h-3 transition-transform duration-300 ${mode === 'dark' ? 'rotate-0 scale-110' : 'rotate-12'}`} />
              <span className="hidden sm:inline">Oscuro</span>
            </button>
          </SystemTooltip>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(d => !d)}
            className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-all group"
          >
            <div className="w-6 h-6 rounded-lg nl-accent-bg flex items-center justify-center text-[11px] font-bold shadow-xs group-hover:scale-105 transition-transform">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-white text-xs font-bold leading-tight max-w-28 truncate">{user.display_name}</p>
              <p className="text-indigo-400 text-[10px] font-mono leading-tight">{user.role}</p>
            </div>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-64 z-20 nl-surface rounded-2xl overflow-hidden shadow-2xl animate-pop-in">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60">
                  <p className="text-white text-sm font-bold">{user.display_name}</p>
                  <p className="text-slate-400 text-xs mt-0.5 font-mono">{user.email}</p>
                </div>

                <div className="p-2 border-b border-slate-800">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-indigo-400" />
                    Rol Activo (RBAC)
                  </p>
                  <div className="space-y-0.5 mt-1">
                    {ROLES_LIST.map(r => {
                      const active = user.role === r
                      return (
                        <button
                          key={r}
                          onClick={() => {
                            switchDemoRole(r)
                            setShowDropdown(false)
                            toast.info('Rol de sesión actualizado', `Operando como ${r}`)
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                            active
                              ? 'bg-slate-800 text-white font-bold border border-slate-700'
                              : 'text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <span>{r}</span>
                          {active && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                        </button>
                      )
                    })}
                  </div>
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
