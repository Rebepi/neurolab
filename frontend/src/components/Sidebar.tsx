import { useState, useEffect } from 'react'
import {
  LayoutDashboard, FolderKanban, Brain, Network, Database,
  Play, BarChart2, Package, FileText, Settings,
  Sparkles, PanelLeftClose, PanelLeftOpen, ChevronDown, Check,
  Shield, ScrollText
} from 'lucide-react'
import { api } from '../services/api'
import { InfoTip, SystemTooltip } from './InfoTip'

interface NavItem {
  id: string
  label: string
  Icon: any
  badge?: string
  isPipeline?: boolean
  countKey?: 'datasets' | 'architectures' | 'jobs' | 'models'
}

interface NavGroup {
  id: string
  title: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'core',
    title: 'Espacio Principal',
    items: [
      { id: 'dashboard', label: 'Centro de Mando', Icon: LayoutDashboard },
      { id: 'visualizer', label: 'Motor Sináptico', Icon: Sparkles, badge: '60 FPS' },
      { id: 'fundamentals', label: 'Fundamentos IA', Icon: Brain },
    ]
  },
  {
    id: 'pipeline',
    title: 'Pipeline Secuencial IA',
    items: [
      { id: 'projects', label: 'Proyectos & RBAC', Icon: FolderKanban, isPipeline: true },
      { id: 'datasets', label: 'Datasets & EDA', Icon: Database, isPipeline: true, countKey: 'datasets' },
      { id: 'architectures', label: 'Arquitecturas', Icon: Network, isPipeline: true, countKey: 'architectures' },
      { id: 'training', label: 'Entrenamientos', Icon: Play, isPipeline: true, countKey: 'jobs' },
      { id: 'evaluation', label: 'Evaluación Test', Icon: BarChart2, isPipeline: true },
      { id: 'models', label: 'Model Registry', Icon: Package, isPipeline: true, countKey: 'models' },
    ]
  },
  {
    id: 'governance',
    title: 'Gobernanza',
    items: [
      { id: 'reports', label: 'Reportes & PDF', Icon: FileText },
      { id: 'admin', label: 'Usuarios & RBAC', Icon: Shield },
      { id: 'audit', label: 'Auditoría', Icon: ScrollText },
      { id: 'settings', label: 'Configuración', Icon: Settings },
    ]
  }
]

interface SidebarProps {
  activeModule: string
  onNavigate: (module: string) => void
  currentProject?: { id: string; name: string } | null
}

export default function Sidebar({
  activeModule,
  onNavigate,
  currentProject
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    core: true,
    pipeline: true,
    governance: true
  })
  const [counts, setCounts] = useState({ datasets: 0, architectures: 0, jobs: 0, models: 0 })

  useEffect(() => {
    if (!currentProject) return
    Promise.all([
      api.getProjectDatasets(currentProject.id).then(r => r.length).catch(() => 0),
      api.getProjectArchitectures(currentProject.id).then(r => r.length).catch(() => 0),
      api.getProjectJobs(currentProject.id).then(r => r.length).catch(() => 0),
      api.getProjectModels(currentProject.id).then(r => r.length).catch(() => 0),
    ]).then(([d, a, j, m]) => {
      setCounts({ datasets: d, architectures: a, jobs: j, models: m })
    })
  }, [currentProject?.id, activeModule])

  function isPipelineDone(id: string): boolean {
    if (id === 'projects') return Boolean(currentProject)
    if (id === 'datasets') return counts.datasets > 0
    if (id === 'architectures') return counts.architectures > 0
    if (id === 'training') return counts.jobs > 0
    if (id === 'evaluation') return counts.jobs > 0
    if (id === 'models') return counts.models > 0
    return false
  }

  function toggleGroup(id: string) {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <aside
      className={`relative flex flex-col nl-surface border-r border-slate-800/80 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] select-none z-30 ${
        collapsed ? 'w-[68px]' : 'w-[252px]'
      }`}
    >
      <div className={`flex items-center h-16 shrink-0 border-b border-slate-800/80 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        <button
          onClick={() => onNavigate('dashboard')}
          className={`flex items-center group focus:outline-none p-1 rounded-xl ${collapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}
        >
          <div className="relative shrink-0 w-9 h-9 rounded-xl nl-accent-bg flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth={2}>
              <circle cx="5" cy="7" r="2" />
              <circle cx="5" cy="17" r="2" />
              <circle cx="12" cy="12" r="2.5" />
              <circle cx="19" cy="7" r="2" />
              <circle cx="19" cy="17" r="2" />
              <path d="M7 7.5L9.8 10.8M7 16.5L9.8 13.2M14.2 10.8L17 7.5M14.2 13.2L17 16.5" />
            </svg>
          </div>

          {!collapsed && (
            <div className="text-left min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-extrabold text-sm tracking-tight leading-none">
                  NeuroLab
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-md bg-slate-800 text-indigo-300 border border-slate-700">
                  OS
                </span>
              </div>
              <p className="text-slate-400 text-[10px] font-medium tracking-wide mt-1">
                Deep Learning Studio
              </p>
            </div>
          )}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2.5 space-y-5 overflow-y-auto overflow-x-hidden">
        {NAV_GROUPS.map(group => {
          const isOpen = openGroups[group.id] ?? true
          const isPipelineGroup = group.id === 'pipeline'

          return (
            <div key={group.id} className="space-y-1">
              {!collapsed && (
                <div className="w-full flex items-center justify-between px-2 py-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors group"
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-slate-500 group-hover:text-white transition-transform duration-200 ${
                        isOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>
                  {isPipelineGroup && (
                    <InfoTip
                      title="Pipeline Secuencial IA"
                      text="Flujo ordenado de ingeniería: Proyecto → Dataset 70/15/15 → Arquitectura → Entrenamiento Keras → Evaluación Test → Registro."
                      side="bottom"
                    />
                  )}
                </div>
              )}

              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isOpen || collapsed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className={`relative ${!collapsed && isPipelineGroup ? 'pl-2' : ''}`}>
                    {!collapsed && isPipelineGroup && (
                      <div className="pointer-events-none absolute left-[32px] top-6 bottom-6 w-[1.5px] bg-slate-800/90 rounded-full z-0" />
                    )}

                    <ul className="relative z-10 space-y-1">
                      {group.items.map(({ id, label, Icon, badge, isPipeline, countKey }) => {
                        const isActive = activeModule === id
                        const countVal = countKey ? counts[countKey] : null
                        const stepCompleted = isPipeline ? isPipelineDone(id) : false
                        const isVisualizer = id === 'visualizer'

                        const navButton = (
                          <button
                            onClick={() => onNavigate(id)}
                            className={`relative w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-200 group ${
                              collapsed ? 'justify-center' : ''
                            } ${
                              isActive
                                ? 'bg-slate-800/95 text-white border border-slate-700 shadow-sm nl-accent-glow'
                                : isVisualizer && !collapsed
                                  ? 'bg-slate-900/70 hover:bg-slate-800/80 text-slate-200 border border-slate-800/90'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                            }`}
                          >
                            {isActive && (
                              <span
                                className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all duration-300 animate-pop-in"
                                style={{
                                  backgroundColor: 'var(--nl-accent-light)',
                                  boxShadow: '0 0 12px var(--nl-accent-light)'
                                }}
                              />
                            )}

                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="relative z-10 shrink-0 rounded-lg transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3"
                                style={{ backgroundColor: 'var(--nl-bg-surface)' }}
                              >
                                <div
                                  className={`relative w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                                    isActive
                                      ? 'nl-accent-bg shadow-sm'
                                      : stepCompleted
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-slate-950 text-slate-400 group-hover:text-white border border-slate-800'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  {stepCompleted && !isActive && (
                                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-slate-950">
                                      <Check className="w-1.5 h-1.5 stroke-[3]" />
                                    </span>
                                  )}
                                </div>
                              </div>

                              {!collapsed && (
                                <span
                                  className={`text-xs font-semibold truncate transition-transform duration-200 ${
                                    isActive
                                      ? 'text-white font-bold translate-x-0.5'
                                      : 'text-slate-300 group-hover:text-white group-hover:translate-x-1'
                                  }`}
                                >
                                  {label}
                                </span>
                              )}
                            </div>

                            {!collapsed && (badge || (countVal !== null && countVal > 0)) && (
                              <div className="flex items-center gap-1 shrink-0">
                                {badge && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-extrabold rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {badge}
                                  </span>
                                )}
                                {countVal !== null && countVal > 0 && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-slate-950 border border-slate-800 text-indigo-300 transition-transform group-hover:scale-105">
                                    {countVal}
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        )

                        return (
                          <li key={id} className="relative">
                            {collapsed ? (
                              <SystemTooltip
                                label={label}
                                side="right"
                                className="w-full flex"
                              >
                                {navButton}
                              </SystemTooltip>
                            ) : (
                              navButton
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      <div className="p-2.5 border-t border-slate-800/80">
        <SystemTooltip
          label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          className="w-full flex"
          side="top"
        >
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-white transition-all duration-200 group ${
              collapsed ? 'justify-center' : 'justify-start'
            }`}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-indigo-400 group-hover:-translate-x-0.5 transition-transform" />
            )}
            {!collapsed && (
              <span className="text-xs font-semibold">Colapsar panel</span>
            )}
          </button>
        </SystemTooltip>
      </div>
    </aside>
  )
}
