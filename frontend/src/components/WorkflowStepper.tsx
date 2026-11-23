import { useState, useEffect } from 'react'
import {
  CheckCircle2, FolderKanban, Database, Network,
  Play, BarChart2, PackageCheck, ChevronUp, ChevronDown, Cpu
} from 'lucide-react'
import { api } from '../services/api'
import { InfoTip, SystemTooltip } from './InfoTip'

interface WorkflowStepperProps {
  activeModule: string
  onNavigate: (module: string) => void
  currentProject: { id: string; name: string } | null
}

const STEPS: Array<{
  id: string
  num: string
  label: string
  sublabel: string
  icon: typeof FolderKanban
  countKey?: 'datasets' | 'architectures' | 'jobs' | 'models'
}> = [
  { id: 'projects', num: '01', label: 'Proyecto', sublabel: 'Workspace & RBAC', icon: FolderKanban },
  { id: 'datasets', num: '02', label: 'Dataset', sublabel: 'Auto-EDA & Splits', icon: Database, countKey: 'datasets' },
  { id: 'architectures', num: '03', label: 'Arquitectura', sublabel: 'Topología & Capas', icon: Network, countKey: 'architectures' },
  { id: 'training', num: '04', label: 'Entrenamiento', sublabel: 'Motor TensorFlow', icon: Play, countKey: 'jobs' },
  { id: 'evaluation', num: '05', label: 'Evaluación', sublabel: 'Curvas & Test', icon: BarChart2 },
  { id: 'models', num: '06', label: 'Registry', sublabel: 'Versión & Export', icon: PackageCheck, countKey: 'models' },
  { id: 'inference', num: '07', label: 'Uso Modelo', sublabel: 'Predicción Animada', icon: Cpu },
]

export default function WorkflowStepper({ activeModule, onNavigate, currentProject }: WorkflowStepperProps) {
  const [counts, setCounts] = useState({ datasets: 0, architectures: 0, jobs: 0, models: 0 })
  const [minimized, setMinimized] = useState(false)

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
  }, [currentProject, activeModule])

  if (!currentProject) return null

  function isStepCompleted(stepId: string): boolean {
    if (stepId === 'projects') return true
    if (stepId === 'datasets') return counts.datasets > 0
    if (stepId === 'architectures') return counts.architectures > 0
    if (stepId === 'training') return counts.jobs > 0
    if (stepId === 'evaluation') return counts.jobs > 0
    if (stepId === 'models') return counts.models > 0
    if (stepId === 'inference') return counts.models > 0
    return false
  }

  const completedCount = STEPS.filter(s => isStepCompleted(s.id)).length
  const progressPct = Math.round((completedCount / STEPS.length) * 100)

  if (minimized) {
    return (
      <div className="mb-4 flex items-center justify-between px-4 py-2 rounded-xl nl-cyber-panel text-xs animate-pop-in">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-cyan-300">Pipeline IA ({progressPct}%)</span>
          <div className="w-32 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full nl-progress-shimmer bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-slate-400 hidden sm:inline">
            {completedCount} de {STEPS.length} etapas completadas en <strong className="text-slate-200">{currentProject.name}</strong>
          </span>
        </div>
        <button
          onClick={() => setMinimized(false)}
          className="text-cyan-300 hover:text-white flex items-center gap-1 font-medium"
        >
          <span>Expandir pasos</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative nl-cyber-panel rounded-2xl px-4 py-3 mb-5 animate-card-reveal">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/35 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Pipeline Operativo Secuencial
          </span>
          <InfoTip
            title="Progreso del Proyecto"
            text="Rastrea las 7 etapas del pipeline desde el workspace hasta el gemelo 3D en vivo."
          />
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full nl-progress-shimmer bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-emerald-400 font-bold">{progressPct}%</span>
          </div>
        </div>

        <SystemTooltip label="Ocultar temporalmente la barra de progreso del pipeline" side="top">
          <button
            onClick={() => setMinimized(true)}
            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
            aria-label="Minimizar barra de flujo"
          >
            <span className="hidden sm:inline">Compactar</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </SystemTooltip>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {STEPS.map((step) => {
          const completed = isStepCompleted(step.id)
          const active = activeModule === step.id
          const Icon = step.icon
          const stepCount = step.countKey ? counts[step.countKey] : null

          return (
            <button
              key={step.id}
              onClick={() => onNavigate(step.id)}
              className={`nl-card-interactive group relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-200 border ${
                active
                  ? 'bg-gradient-to-r from-cyan-500/25 via-teal-500/15 to-indigo-600/20 border-cyan-400/65 text-white shadow-[0_0_20px_rgba(34,211,238,0.22)] ring-1 ring-cyan-400/35'
                  : completed
                    ? 'bg-slate-950/65 hover:bg-slate-800/75 border-emerald-500/30 text-slate-200'
                    : 'bg-slate-950/45 hover:bg-slate-900 border-slate-800/80 text-slate-400'
              }`}
            >
              <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3 ${
                active
                  ? 'nl-accent-bg shadow-sm'
                  : completed
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                    : 'bg-slate-900 text-cyan-300 border border-slate-800'
              }`}>
                {completed && !active ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className={`text-xs font-bold truncate leading-tight ${
                    active ? 'text-white' : completed ? 'text-slate-100' : 'text-slate-400'
                  }`}>
                    {step.label}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    {stepCount !== null && stepCount > 0 && (
                      <span className="px-1.5 py-0 rounded bg-slate-900/90 border border-cyan-500/30 text-[9px] font-mono font-bold text-cyan-300">
                        {stepCount}
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-slate-500">{step.num}</span>
                  </div>
                </div>
                <p className={`text-[10px] truncate leading-tight mt-0.5 ${
                  active ? 'text-cyan-200' : 'text-slate-500'
                }`}>
                  {step.sublabel}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
