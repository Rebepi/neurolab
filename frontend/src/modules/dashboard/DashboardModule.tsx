import { useState, useEffect } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart2,
  Brain,
  CheckCircle2,
  Cpu,
  Database,
  FolderKanban,
  GitMerge,
  HardDrive,
  Network,
  Package,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { api } from '../../services/api'
import { DashboardOverview, Project, ModelVersion } from '../../types'
import { useTheme } from '../../context/ThemeContext'
import { InfoTip, SystemTooltip } from '../../components/InfoTip'
import { EngineDiagnosticCard } from './components/EngineDiagnosticCard'
import { RecentJobsTable } from './components/RecentJobsTable'
import { DashboardNeuralCanvas } from './components/DashboardNeuralCanvas'
import { DashboardHero3D } from './components/DashboardHero3D'
import { TelecomGlobe3D } from './components/TelecomGlobe3D'
import { CrossAreaFusionModal } from '../../components/CrossAreaFusionModal'
import { useToast } from '../../components/toast/ToastContext'

interface AreaSummary {
  project: Project
  datasetsCount: number
  modelsCount: number
  bestAccuracy: number | null
  datasetRows: number
  targetCol: string | null
  problemType: string | null
}

function OpenArcGauge({
  pct,
  label,
  sub,
  strokeStart,
  strokeEnd,
  glowColor,
  gradId,
}: {
  pct: number
  label: string
  sub: string
  strokeStart: string
  strokeEnd: string
  glowColor: string
  gradId: string
}) {
  const clamped = Math.max(0, Math.min(100, pct))
  const r = 36
  const circ = 2 * Math.PI * r
  const arcLen = circ * 0.75
  const filledLen = (clamped / 100) * arcLen

  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="w-24 h-24 rotate-[135deg]" viewBox="0 0 88 88">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={strokeStart} />
              <stop offset="100%" stopColor={strokeEnd} />
            </linearGradient>
          </defs>
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke="var(--nl-gauge-track)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circ}`}
          />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${filledLen} ${circ}`}
            style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1.5">
          <span className="text-lg font-mono font-extrabold text-white leading-none">
            {Math.round(clamped)}%
          </span>
          <span className="text-[11px] font-bold text-slate-300 mt-1">{label}</span>
        </div>
      </div>
      <span className="text-[10px] font-mono text-slate-400 text-center truncate w-full">{sub}</span>
    </div>
  )
}

function buildSmoothSvgPath(pts: Array<{ x: number; y: number }>, maxY: number): { linePath: string; areaPath: string } {
  if (pts.length === 0) return { linePath: '', areaPath: '' }
  if (pts.length === 1) {
    const p = pts[0]
    return {
      linePath: `M 0 ${p.y} L 260 ${p.y}`,
      areaPath: `M 0 ${maxY} L 0 ${p.y} L 260 ${p.y} L 260 ${maxY} Z`,
    }
  }
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const mx = ((p0.x + p1.x) / 2).toFixed(1)
    d += ` C ${mx} ${p0.y.toFixed(1)}, ${mx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`
  }
  const last = pts[pts.length - 1]
  const area = `${d} L ${last.x.toFixed(1)} ${maxY} L ${pts[0].x.toFixed(1)} ${maxY} Z`
  return { linePath: d, areaPath: area }
}

function getDomainVisual(nameOrId: string) {
  const s = (nameOrId || '').toLowerCase()
  if (s.includes('noc')) {
    return {
      icon: Radio,
      boxCls: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/35',
      tag: 'NOC 5G',
      tagCls: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/35',
    }
  }
  if (s.includes('antifraude') || s.includes('fraude')) {
    return {
      icon: ShieldAlert,
      boxCls: 'bg-rose-500/15 text-rose-300 border-rose-400/35',
      tag: 'Antifraude',
      tagCls: 'bg-rose-500/15 text-rose-300 border-rose-400/35',
    }
  }
  if (s.includes('comercial') || s.includes('ltv')) {
    return {
      icon: TrendingUp,
      boxCls: 'bg-amber-500/15 text-amber-300 border-amber-400/35',
      tag: 'LTV USD',
      tagCls: 'bg-amber-500/15 text-amber-300 border-amber-400/35',
    }
  }
  if (s.includes('general') || s.includes('360')) {
    return {
      icon: Sparkles,
      boxCls: 'bg-violet-500/15 text-violet-300 border-violet-400/35',
      tag: 'Global 360°',
      tagCls: 'bg-violet-500/15 text-violet-300 border-violet-400/35',
    }
  }
  return {
    icon: Users,
    boxCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35',
    tag: 'Retención',
    tagCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35',
  }
}

export default function DashboardModule({
  onNavigate,
  currentProject,
  onSelectProject,
}: {
  onNavigate: (m: string) => void
  currentProject?: { id: string; name: string } | null
  onSelectProject?: (p: any) => void
}) {
  const { error: notifyError, info: notifyInfo } = useToast()
  const { mode } = useTheme()
  const isLight = mode === 'light'
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [areas, setAreas] = useState<AreaSummary[]>([])
  const [activeCounts, setActiveCounts] = useState({ datasets: 0, architectures: 0, jobs: 0, models: 0 })
  const [loading, setLoading] = useState(true)
  const [showCrossFusionModal, setShowCrossFusionModal] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [overview, projs] = await Promise.all([api.getOverview(), api.getProjects()])
      setData(overview)

      const enriched = await Promise.all(
        projs.slice(0, 5).map(async p => {
          const ds = await api.getProjectDatasets(p.id).catch(() => [])
          const ms = await api.getProjectModels(p.id).catch(() => [])
          const bestModel: ModelVersion | undefined = ms[0]
          const primaryDs = ds[0]
          let totalRowsArea = 0
          for (const d of ds) {
            totalRowsArea += (d.splits?.train_count || 0) + (d.splits?.val_count || 0) + (d.splits?.test_count || 0)
          }
          return {
            project: p,
            datasetsCount: ds.length,
            modelsCount: ms.length,
            bestAccuracy: bestModel?.test_metrics?.test_accuracy ?? null,
            datasetRows: totalRowsArea,
            targetCol: primaryDs?.target ?? null,
            problemType: primaryDs?.metadata?.problem_type ?? null,
          }
        })
      )
      setAreas(enriched)
    } catch (e: any) {
      notifyError('Error al sincronizar telemetría', e?.message ?? 'No se pudo conectar al servidor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const timer = window.setInterval(() => {
      api.getOverview().then(setData).catch(() => { })
    }, 6000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!currentProject?.id) return
    Promise.all([
      api.getProjectDatasets(currentProject.id).then(r => r.length).catch(() => 0),
      api.getProjectArchitectures(currentProject.id).then(r => r.length).catch(() => 0),
      api.getProjectJobs(currentProject.id).then(r => r.length).catch(() => 0),
      api.getProjectModels(currentProject.id).then(r => r.length).catch(() => 0),
    ]).then(([d, a, j, m]) => setActiveCounts({ datasets: d, architectures: a, jobs: j, models: m }))
  }, [currentProject?.id])

  function getAreaMeta(id: string) {
    if (id.includes('general')) {
      return {
        icon: Sparkles,
        badge: 'Global 360° · Multi-Área',
        accent: 'border-emerald-400/50 hover:border-emerald-300',
        iconBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      }
    }
    if (id.includes('noc')) {
      return {
        icon: Radio,
        badge: 'Multiclase · 3 Estados',
        accent: 'border-cyan-500/40 hover:border-cyan-400',
        iconBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      }
    }
    if (id.includes('antifraude')) {
      return {
        icon: ShieldAlert,
        badge: 'Binario · Seguridad',
        accent: 'border-rose-500/40 hover:border-rose-400',
        iconBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      }
    }
    if (id.includes('comercial')) {
      return {
        icon: TrendingUp,
        badge: 'Regresión · USD LTV',
        accent: 'border-amber-500/40 hover:border-amber-400',
        iconBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      }
    }
    return {
      icon: Users,
      badge: 'Binario · Retención',
      accent: 'border-teal-500/40 hover:border-teal-400',
      iconBg: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    }
  }

  function handleSelectAreaByKeyword(keyword: string) {
    const found = areas.find(a => a.project.id.toLowerCase().includes(keyword))
    if (found) {
      onSelectProject?.(found.project)
      notifyInfo('Área corporativa activada', found.project.name)
    } else {
      onNavigate('projects')
    }
  }

  const pipelineCards = [
    {
      num: '1',
      title: 'Dataset',
      sub: 'Importa y analiza CSVs',
      module: 'datasets',
      icon: Database,
      done: activeCounts.datasets > 0,
      cls: 'nl-step-cyan',
      iconColor: isLight ? '#0891b2' : '#22d3ee',
      glow: isLight ? 'rgba(8,145,178,0.22)' : 'rgba(34,211,238,0.65)',
    },
    {
      num: '2',
      title: 'Preparar',
      sub: 'Capas y Fusión IA',
      module: 'architectures',
      icon: Network,
      done: activeCounts.architectures > 0,
      cls: 'nl-step-violet',
      iconColor: isLight ? '#7c3aed' : '#a78bfa',
      glow: isLight ? 'rgba(124,58,237,0.22)' : 'rgba(167,139,250,0.65)',
    },
    {
      num: '3',
      title: 'Entrenar',
      sub: 'Motor TensorFlow SSE',
      module: 'training',
      icon: Play,
      done: activeCounts.jobs > 0,
      cls: 'nl-step-emerald',
      iconColor: isLight ? '#059669' : '#34d399',
      glow: isLight ? 'rgba(5,150,105,0.22)' : 'rgba(52,211,153,0.65)',
    },
    {
      num: '4',
      title: 'Evaluar',
      sub: 'Curvas y Test sellado',
      module: 'evaluation',
      icon: BarChart2,
      done: activeCounts.jobs > 0,
      cls: 'nl-step-amber',
      iconColor: isLight ? '#d97706' : '#fbbf24',
      glow: isLight ? 'rgba(217,119,6,0.22)' : 'rgba(251,191,36,0.65)',
    },
    {
      num: '5',
      title: 'Inferencia',
      sub: 'Simulador en vivo',
      module: 'inference',
      icon: Rocket,
      done: activeCounts.models > 0,
      cls: 'nl-step-purple',
      iconColor: isLight ? '#9333ea' : '#c084fc',
      glow: isLight ? 'rgba(147,51,234,0.22)' : 'rgba(192,132,252,0.65)',
    },
  ]

  const tele = data?.compute_telemetry
  const cpuHist = tele?.cpu_history || []
  const wavePts =
    cpuHist.length > 1
      ? cpuHist.map((pt, idx) => ({
        x: (idx / (cpuHist.length - 1)) * 260,
        y: 62 - (Math.min(100, pt.cpu) / 100) * 54,
      }))
      : [
        { x: 0, y: 42 },
        { x: 65, y: 36 },
        { x: 130, y: 40 },
        { x: 195, y: 30 },
        { x: 260, y: Math.max(8, 62 - ((tele?.cpu_pct ?? 15) / 100) * 54) },
      ]
  const { linePath, areaPath } = buildSmoothSvgPath(wavePts, 66)

  const diskUsedTb = tele ? (tele.disk_used_gb / 1024).toFixed(2) : '0.00'
  const diskTotalTb = tele ? (tele.disk_total_gb / 1024).toFixed(2) : '0.00'
  const firstTime = cpuHist[0]?.t?.slice(0, 5) || '--:--'
  const midTime = cpuHist[Math.floor(cpuHist.length / 2)]?.t?.slice(0, 5) || '--:--'
  const lastTime = cpuHist[cpuHist.length - 1]?.t?.slice(0, 5) || '--:--'

  const avgAccuracy = (() => {
    const all = (data?.trained_models || [])
      .map(m => m.test_metrics?.test_accuracy)
      .filter((v): v is number => typeof v === 'number' && v > 0)
    if (all.length === 0) return null
    return all.reduce((a, b) => a + b, 0) / all.length
  })()

  const completedJobs = (data?.recent_jobs || []).filter((j: any) => j.status === 'COMPLETED').length

  const ACTION_BADGE_CLS: Record<string, string> = {
    PROJECT_CREATED: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    DATASET_UPLOADED: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    ARCHITECTURE_CREATED: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    TRAINING_QUEUED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    TRAINING_COMPLETED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    TRAINING_FAILED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    MODEL_STATUS_CHANGED: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    CROSS_AREA_MODEL_FUSED: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div className="xl:col-span-8 flex flex-col gap-4">
          <DashboardHero3D
            activeProjectName={currentProject?.name}
            totalModels={data?.total_models ?? 0}
            totalDatasets={data?.total_datasets ?? 0}
            totalRowsCorpus={data?.total_rows_corpus ?? 0}
            onNavigate={onNavigate}
            onOpenCrossFusion={() => setShowCrossFusionModal(true)}
            onSelectAreaByKeyword={handleSelectAreaByKeyword}
          />

          <div className="nl-cyber-panel rounded-2xl p-4 space-y-3 animate-card-reveal">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs sm:text-sm font-bold text-white">
                  Flujo de trabajo de IA (end-to-end)
                </h2>
                <InfoTip
                  title="Pipeline Estructurado de Deep Learning"
                  text="Avanza secuencialmente sobre el área seleccionada o pulsa cualquier tarjeta para ir directamente a esa etapa."
                  size="xs"
                />
              </div>
              <span className="text-[11px] font-mono text-cyan-300 truncate max-w-xs">
                Activa: <strong>{currentProject?.name || 'Ninguna'}</strong>
              </span>
            </div>

            <div className="flex flex-col lg:flex-row items-stretch gap-3">
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-stretch">
                {pipelineCards.map((step, sIdx) => {
                  const StepIcon = step.icon
                  return (
                    <div key={step.num} className="relative flex items-stretch">
                      <button
                        type="button"
                        onClick={() => onNavigate(step.module)}
                        className={`w-full group rounded-xl border p-3 text-center transition-all flex flex-col items-center justify-between gap-2 hover:-translate-y-0.5 ${step.cls}`}
                      >
                        <div className="w-full flex items-center justify-between">
                          <span className="w-5 h-5 rounded-md bg-slate-950/90 border border-slate-700/80 text-[10px] font-mono font-bold text-white flex items-center justify-center">
                            {step.num}
                          </span>
                          {step.done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <StepIcon
                          className="w-6 h-6 transition-transform duration-200 group-hover:scale-110"
                          style={{ color: step.iconColor, filter: `drop-shadow(0 0 8px ${step.glow})` }}
                        />
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-200 transition-colors">
                            {step.title}
                          </p>
                          <p className="text-[10px] text-slate-300/85 leading-tight mt-0.5">
                            {step.sub}
                          </p>
                        </div>
                      </button>
                      {sIdx < pipelineCards.length - 1 && (
                        <ArrowRight className="hidden sm:block w-4 h-4 text-cyan-300/75 self-center -mx-2 shrink-0 z-10 pointer-events-none" />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex lg:flex-col justify-between gap-2 lg:w-44 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate('projects')}
                  className="nl-btn-shimmer flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-extrabold text-xs shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Proyecto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCrossFusionModal(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Unir Áreas · 360°</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('visualizer')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/30 text-slate-200 hover:text-cyan-300 text-xs font-semibold transition-all"
                >
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Motor Sináptico</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
            <div className="lg:col-span-6 nl-cyber-panel rounded-2xl p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Experimentos recientes</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('training')}
                  className="text-xs font-semibold text-cyan-300 hover:text-white flex items-center gap-1"
                >
                  <span>Ver todos</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="pb-2.5 pl-2 pr-2">Experimento</th>
                      <th className="pb-2.5 pr-2">Área</th>
                      <th className="pb-2.5 pr-2">Fecha</th>
                      <th className="pb-2.5 pl-2 pr-2 text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.recent_jobs || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500">
                          Sin corridas registradas aún.
                        </td>
                      </tr>
                    ) : (
                      (data?.recent_jobs || []).slice(0, 5).map((job: any) => {
                        const vis = getDomainVisual(`${job.project_id || ''} ${job.project_name || ''}`)
                        const DomIcon = vis.icon
                        const acc = typeof job.accuracy === 'number' ? `${(job.accuracy * 100).toFixed(1)}%` : job.status
                        const done = job.status === 'COMPLETED'
                        return (
                          <tr
                            key={job.id}
                            onClick={() => onNavigate('training')}
                            className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 pl-2 pr-2 rounded-l-lg">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${vis.boxCls}`}>
                                  <DomIcon className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p
                                    title={job.arch_name || job.id}
                                    className="font-semibold text-slate-100 truncate max-w-[148px]"
                                  >
                                    {job.arch_name || job.id}
                                  </p>
                                  <p
                                    title={job.project_name}
                                    className="text-[10px] text-slate-400 truncate max-w-[148px]"
                                  >
                                    {job.project_name}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 pr-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${vis.tagCls}`}>
                                {vis.tag}
                              </span>
                            </td>
                            <td className="py-2.5 pr-2 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                              {new Date(job.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                            </td>
                            <td className="py-2.5 pl-2 pr-2 rounded-r-lg text-right">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${done
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                                    : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
                                  }`}
                              >
                                {acc}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-6 nl-cyber-panel rounded-2xl p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-300" />
                  <h3 className="text-sm font-bold text-white">
                    Mis {data?.total_models ?? 0} modelos entrenados
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('models')}
                  className="text-xs font-semibold text-cyan-300 hover:text-white flex items-center gap-1"
                >
                  <span>Ver biblioteca</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="pb-2.5 pl-2 pr-2">Modelo</th>
                      <th className="pb-2.5 pr-2">Versión</th>
                      <th className="pb-2.5 pr-2">Estado</th>
                      <th className="pb-2.5 pl-2 pr-2 text-right">Métrica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.trained_models || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500">
                          Sin modelos entrenados aún.
                        </td>
                      </tr>
                    ) : (
                      (data?.trained_models || []).slice(0, 5).map(m => {
                        const vis = getDomainVisual(`${m.project_id} ${m.target_column || ''}`)
                        const DomIcon = vis.icon
                        const testAcc = m.test_metrics?.test_accuracy
                        const isReg = m.target_column === 'valor_anual_usd'
                        const metricText =
                          typeof testAcc === 'number'
                            ? isReg
                              ? `R² ${(testAcc * 100).toFixed(1)}%`
                              : `Acc ${(testAcc * 100).toFixed(1)}%`
                            : '—'
                        return (
                          <tr
                            key={m.id}
                            onClick={() => {
                              onSelectProject?.({ id: m.project_id, name: m.project_name })
                              onNavigate('inference')
                            }}
                            className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 pl-2 pr-2 rounded-l-lg">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${vis.boxCls}`}>
                                  <DomIcon className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p
                                    title={m.arch_name || m.project_name}
                                    className="font-semibold text-white truncate max-w-[138px]"
                                  >
                                    {m.arch_name || m.project_name}
                                  </p>
                                  <p
                                    title={m.target_column || m.project_name}
                                    className="text-[10px] text-slate-400 truncate max-w-[138px]"
                                  >
                                    {m.target_column || m.project_name}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 pr-2 font-mono text-[10px] text-slate-300">{m.version}</td>
                            <td className="py-2.5 pr-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Listo
                              </span>
                            </td>
                            <td className="py-2.5 pl-2 pr-2 rounded-r-lg text-right">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/35 font-mono text-[10px] font-bold text-emerald-300">
                                {metricText}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 flex flex-col gap-4">
          <div className="nl-cyber-panel rounded-2xl p-4 flex flex-col justify-between gap-3 animate-card-reveal">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
                <h2 className="text-sm font-bold text-white truncate">Red de Telecom (Vista Global)</h2>
                <InfoTip
                  title="Globo Holográfico WebGL y Métricas Reales"
                  text="Globo 3D rotatorio en tiempo real sincronizado con los conteos reales de SQLite y artefactos .keras."
                  size="xs"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2 py-0.5 rounded-lg bg-slate-900/90 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                  Tiempo real
                </span>
                <SystemTooltip label="Sincronizar telemetría" side="left">
                  <button
                    type="button"
                    onClick={loadData}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
                    aria-label="Sincronizar métricas"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </SystemTooltip>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-6 h-56 relative">
                <TelecomGlobe3D />
              </div>

              <div className="col-span-6 space-y-2">
                <button
                  type="button"
                  onClick={() => onNavigate('projects')}
                  className="w-full p-2.5 rounded-xl bg-slate-950/65 border border-cyan-500/20 hover:border-teal-400/55 flex items-center gap-2.5 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-400/30 flex items-center justify-center shrink-0">
                    <FolderKanban className="w-4 h-4 text-teal-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400">Áreas Corporativas</p>
                    <p className="text-base font-extrabold font-mono text-white leading-tight">
                      {data?.total_projects ?? '—'} <span className="text-[10px] font-semibold text-teal-300">activas</span>
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('datasets')}
                  className="w-full p-2.5 rounded-xl bg-slate-950/65 border border-cyan-500/20 hover:border-cyan-400/55 flex items-center gap-2.5 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4 text-cyan-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400">Datasets CSV</p>
                    <p className="text-base font-extrabold font-mono text-cyan-300 leading-tight">
                      {data?.total_datasets ?? 0} <span className="text-[10px] font-semibold text-slate-400">ficheros</span>
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('datasets')}
                  className="w-full p-2.5 rounded-xl bg-slate-950/65 border border-cyan-500/20 hover:border-indigo-400/55 flex items-center gap-2.5 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-indigo-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400">Registros Corpus</p>
                    <p className="text-base font-extrabold font-mono text-white leading-tight">
                      {data?.total_rows_corpus ? data.total_rows_corpus.toLocaleString() : '—'}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('models')}
                  className="w-full p-2.5 rounded-xl bg-slate-950/65 border border-cyan-500/20 hover:border-emerald-400/55 flex items-center gap-2.5 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400">Modelos .keras</p>
                    <p className="text-base font-extrabold font-mono text-emerald-300 leading-tight">
                      {data?.approved_models ?? 0}/{data?.total_models ?? 0} <span className="text-[10px] font-semibold text-emerald-400">SHA</span>
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="nl-cyber-panel rounded-2xl p-4 flex-1 flex flex-col justify-between gap-3 animate-card-reveal">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Uso de Cómputo y Recursos</h3>
                <InfoTip
                  title="Lectura Hardware Real (psutil)"
                  text="Muestra uso en vivo de CPU, RAM y disco del servidor ejecutando TensorFlow/Keras junto con el peso real en disco de CSVs y modelos."
                  size="xs"
                />
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/25 text-cyan-300">
                {tele?.runtime_device || 'CPU AVX2'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <OpenArcGauge
                pct={tele?.cpu_pct ?? 0}
                label="CPU"
                sub={`${tele?.cpu_cores ?? 1} núcleos`}
                strokeStart="#10b981"
                strokeEnd="#22d3ee"
                glowColor="rgba(45, 212, 191, 0.55)"
                gradId="cpuArcGrad"
              />
              <OpenArcGauge
                pct={tele?.ram_pct ?? 0}
                label="RAM"
                sub={`${(tele?.ram_used_gb ?? 0).toFixed(1)} / ${(tele?.ram_total_gb ?? 0).toFixed(1)} GB`}
                strokeStart="#8b5cf6"
                strokeEnd="#ec4899"
                glowColor="rgba(167, 139, 250, 0.55)"
                gradId="ramArcGrad"
              />
              <OpenArcGauge
                pct={tele?.disk_pct ?? 0}
                label="Disco"
                sub={`${diskUsedTb} / ${diskTotalTb} TB`}
                strokeStart="#f59e0b"
                strokeEnd="#fbbf24"
                glowColor="rgba(251, 191, 36, 0.5)"
                gradId="diskArcGrad"
              />
            </div>

            <div className="pt-2 border-t border-cyan-500/15 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-200">Utilización de CPU (servidor)</span>
                <span className="font-mono text-emerald-300 font-bold">
                  Promedio: {tele?.cpu_avg_pct ?? tele?.cpu_pct ?? 0}%
                </span>
              </div>
              <div className="flex items-stretch gap-2">
                <div className="flex flex-col justify-between text-[10px] font-mono font-medium text-slate-400 py-0.5 select-none">
                  <span>100%</span>
                  <span>50%</span>
                  <span>0%</span>
                </div>
                <svg viewBox="0 0 260 68" className="flex-1 h-18 overflow-visible">
                  <defs>
                    <linearGradient id="cpuWaveFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={isLight ? '#0284c7' : '#22d3ee'} stopOpacity={isLight ? '0.32' : '0.5'} />
                      <stop offset="55%" stopColor="#3b82f6" stopOpacity={isLight ? '0.12' : '0.18'} />
                      <stop offset="100%" stopColor={isLight ? '#0284c7' : '#22d3ee'} stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="8" x2="260" y2="8" stroke={isLight ? 'rgba(15,23,42,0.14)' : 'rgba(148,163,184,0.14)'} strokeDasharray="3 3" />
                  <line x1="0" y1="36" x2="260" y2="36" stroke={isLight ? 'rgba(15,23,42,0.14)' : 'rgba(148,163,184,0.14)'} strokeDasharray="3 3" />
                  <line x1="0" y1="64" x2="260" y2="64" stroke={isLight ? 'rgba(15,23,42,0.22)' : 'rgba(148,163,184,0.2)'} />
                  <path d={areaPath} fill="url(#cpuWaveFill)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke={isLight ? '#0284c7' : '#22d3ee'}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    style={{
                      filter: isLight
                        ? 'drop-shadow(0 2px 4px rgba(2,132,199,0.28))'
                        : 'drop-shadow(0 0 8px rgba(34,211,238,0.75))',
                    }}
                  />
                </svg>
              </div>
              <div className="flex items-center justify-between pl-8 text-[10px] font-mono font-medium text-slate-400">
                <span>{firstTime}</span>
                <span>{midTime}</span>
                <span>{lastTime}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1.5 border-t border-slate-800/80">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-teal-400" />
                  CSVs: <strong className="text-cyan-300">{tele?.datasets_storage_mb ?? 0} MB</strong>
                </span>
                <span>
                  Modelos .keras: <strong className="text-indigo-300">{tele?.models_storage_mb ?? 0} MB</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {areas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Áreas Corporativas de Aura Telecom ({areas.length} Divisiones IA)
              </h2>
              <InfoTip
                title="Arquitectura Multi-Área y Modelo Global 360°"
                text="Cada tarjeta representa un área operativa con múltiples datasets y modelos reales .keras. Haz clic en cualquiera para activarla o pulsa Inferencia."
                size="xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCrossFusionModal(true)}
              className="text-xs font-bold text-teal-300 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>+ Fusionar Áreas en Modelo 360°</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {areas.map((item, idx) => {
              const meta = getAreaMeta(item.project.id)
              const AreaIcon = meta.icon
              const isSelected = currentProject?.id === item.project.id
              const metricLabel = item.problemType === 'regression' ? 'R² Score' : 'Accuracy'
              return (
                <div
                  key={item.project.id}
                  onClick={() => {
                    onSelectProject?.(item.project)
                    notifyInfo('Área corporativa seleccionada', item.project.name)
                  }}
                  style={{ animationDelay: `${idx * 45}ms` }}
                  className={`nl-cyber-panel nl-card-interactive animate-card-reveal rounded-2xl p-4 border cursor-pointer transition-all flex flex-col justify-between gap-3 ${isSelected
                      ? 'border-cyan-400 ring-2 ring-cyan-500/25 shadow-xl shadow-cyan-500/10'
                      : meta.accent
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                      <AreaIcon className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
                        {meta.badge}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/45 font-bold">
                          ACTIVA
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white font-bold text-xs sm:text-sm leading-snug line-clamp-2">
                      {item.project.name}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-400">
                      <span className="text-cyan-300">{item.datasetsCount} datasets</span>
                      <span>·</span>
                      <span>{item.datasetRows ? `${item.datasetRows.toLocaleString()} filas` : 'Sin filas'}</span>
                      <span>·</span>
                      <span className="text-indigo-300">{item.targetCol || 'target'}</span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                    {item.modelsCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-mono font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {item.bestAccuracy !== null
                          ? `${metricLabel}: ${(item.bestAccuracy * 100).toFixed(1)}%`
                          : 'Modelo Keras Listo'}
                      </span>
                    ) : (
                      <span className="text-amber-400 font-mono">Pendiente entrenar</span>
                    )}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        onSelectProject?.(item.project)
                        onNavigate(item.modelsCount > 0 ? 'inference' : 'training')
                      }}
                      className="inline-flex items-center gap-1 text-cyan-300 hover:text-white font-bold transition-colors"
                    >
                      <span>{item.modelsCount > 0 ? 'Inferencia' : 'Entrenar'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <DashboardNeuralCanvas
        projectId={currentProject?.id}
        projectName={currentProject?.name}
        onNavigate={onNavigate}
      />

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-5">
            <EngineDiagnosticCard data={data} onNavigateAdmin={() => onNavigate('settings')} />
            <div className="nl-cyber-panel rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Actividad Reciente Real</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate('audit')}
                  className="text-[11px] font-semibold text-cyan-300 hover:text-white"
                >
                  Bitácora →
                </button>
              </div>
              <div className="space-y-2">
                {(data.recent_activity || []).length === 0 ? (
                  <p className="text-xs text-slate-500">Sin eventos auditados aún.</p>
                ) : (
                  (data.recent_activity || []).slice(0, 5).map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/75 border border-slate-800/80 text-xs hover:border-slate-700 transition-colors"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-bold border truncate max-w-[112px] ${ACTION_BADGE_CLS[ev.action] ?? 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                          {ev.action.replace(/_/g, ' ')}
                        </span>
                        <p className="text-[10.5px] text-slate-400 truncate">{ev.actor_name}</p>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-300 shrink-0">
                        {new Date(ev.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <RecentJobsTable
            jobs={data.recent_jobs}
            onNavigateTraining={() => onNavigate('training')}
            onNavigateEvaluation={() => onNavigate('evaluation')}
          />
        </div>
      )}

      {showCrossFusionModal && (
        <CrossAreaFusionModal
          onClose={() => setShowCrossFusionModal(false)}
          onSuccess={async res => {
            setShowCrossFusionModal(false)
            await loadData()
            const master = await api.getProject(res.project.id).catch(() => ({
              id: res.project.id,
              name: res.project.name,
            }))
            onSelectProject?.(master)
            onNavigate(res.job_id ? 'training' : 'datasets')
          }}
        />
      )}
    </div>
  )
}
