import { useState, useEffect } from 'react'
import {
  CheckCircle2, FolderKanban, Database, Network,
  Play, BarChart2, PackageCheck, ChevronUp, ChevronDown
} from 'lucide-react'
import { api } from '../services/api'
import { InfoTip, SystemTooltip } from './InfoTip'

interface WorkflowStepperProps {
  activeModule: string
  onNavigate: (module: string) => void
  currentProject: { id: string; name: string } | null
}

const STEPS = [
  { id: 'projects', num: '01', label: 'Proyecto', sublabel: 'Workspace & RBAC', icon: FolderKanban },
  { id: 'datasets', num: '02', label: 'Dataset', sublabel: 'Auto-EDA & Splits', icon: Database },
  { id: 'architectures', num: '03', label: 'Arquitectura', sublabel: 'Topología & Capas', icon: Network },
  { id: 'training', num: '04', label: 'Entrenamiento', sublabel: 'Motor TensorFlow', icon: Play },
  { id: 'evaluation', num: '05', label: 'Evaluación', sublabel: 'Curvas & Test', icon: BarChart2 },
  { id: 'models', num: '06', label: 'Registry', sublabel: 'Versión & Export', icon: PackageCheck },
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
    return false
  }

  const completedCount = STEPS.filter(s => isStepCompleted(s.id)).length
  const progressPct = Math.round((completedCount / STEPS.length) * 100)

  if (minimized) {
    return (
      <div className="mb-4 flex items-center justify-between px-4 py-2 rounded-xl bg-slate-900/70 backdrop-blur-md border border-slate-800/80 text-xs animate-pop-in">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-indigo-400">Pipeline IA ({progressPct}%)</span>
          <div className="w-32 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full nl-progress-shimmer bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-slate-400 hidden sm:inline">
            {completedCount} de {STEPS.length} etapas completadas en <strong className="text-slate-200">{currentProject.name}</strong>
          </span>
        </div>
        <button
          onClick={() => setMinimized(false)}
          className="text-slate-400 hover:text-white flex items-center gap-1 font-medium"
        >
          <span>Expandir pasos</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative nl-glass rounded-2xl px-4 py-3 mb-5 animate-card-reveal">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-300">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Pipeline Operativo Secuencial
          </span>
          <InfoTip
            title="Progreso del Proyecto"
            text="Rastrea las 6 etapas obligatorias desde la creación del workspace hasta el registro de un modelo certificado."
          />
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full nl-progress-shimmer bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-500"
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {STEPS.map((step) => {
          const completed = isStepCompleted(step.id)
          const active = activeModule === step.id
          const Icon = step.icon

          return (
            <button
              key={step.id}
              onClick={() => onNavigate(step.id)}
              className={`nl-card-interactive group relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-200 border ${
                active
                  ? 'bg-gradient-to-r from-indigo-600/30 to-violet-600/20 border-indigo-500/60 text-white shadow-md nl-accent-glow'
                  : completed
                    ? 'bg-slate-950/60 hover:bg-slate-800/80 border-emerald-500/25 text-slate-200'
                    : 'bg-slate-950/40 hover:bg-slate-900 border-slate-800/80 text-slate-400'
              }`}
            >
              <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3 ${
                active
                  ? 'nl-accent-bg shadow-sm'
                  : completed
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-900 text-slate-500'
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
                  <span className="text-[9px] font-mono text-slate-500">{step.num}</span>
                </div>
                <p className={`text-[10px] truncate leading-tight mt-0.5 ${
                  active ? 'text-indigo-200' : 'text-slate-500'
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
