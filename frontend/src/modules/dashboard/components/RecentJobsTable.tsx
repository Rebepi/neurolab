import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Layers,
  Play,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { InfoTip, SystemTooltip } from '../../../components/InfoTip'
import type { DashboardOverview } from '../../../types'
import { useToast } from '../../../components/toast/ToastContext'

type StatusFilter = 'ALL' | 'COMPLETED' | 'ACTIVE' | 'FAILED'

interface RecentJobRow {
  id: string
  project_name: string
  arch_name?: string
  status: string
  progress?: number
  current_epoch?: number
  total_epochs?: number
  loss?: number | null
  accuracy?: number | null
  created_at?: string
  started_at?: string | null
  ended_at?: string | null
}

const STATUS_META: Record<string, { label: string; pillClass: string; dotClass: string }> = {
  RUNNING: {
    label: 'EN CURSO',
    pillClass: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/35',
    dotClass: 'bg-indigo-400 animate-ping',
  },
  PREPARING: {
    label: 'PREPARANDO',
    pillClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35',
    dotClass: 'bg-cyan-400 animate-ping',
  },
  QUEUED: {
    label: 'EN COLA',
    pillClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/35',
    dotClass: 'bg-amber-400',
  },
  COMPLETED: {
    label: 'COMPLETED',
    pillClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35',
    dotClass: 'bg-emerald-400',
  },
  FAILED: {
    label: 'ERROR',
    pillClass: 'bg-rose-500/15 text-rose-300 border border-rose-500/35',
    dotClass: 'bg-rose-400',
  },
  CANCELLED: {
    label: 'CANCELADO',
    pillClass: 'bg-slate-700/40 text-slate-400 border border-slate-600/40',
    dotClass: 'bg-slate-400',
  },
}

function formatDuration(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  return `${mins}m ${rem}s`
}

function formatShortDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface RecentJobsTableProps {
  jobs: DashboardOverview['recent_jobs']
  onNavigateTraining: () => void
  onNavigateEvaluation: () => void
}

export function RecentJobsTable({
  jobs,
  onNavigateTraining,
  onNavigateEvaluation,
}: RecentJobsTableProps) {
  const toast = useToast()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const typedJobs = jobs as RecentJobRow[]
  const completedCount = typedJobs.filter(j => j.status === 'COMPLETED').length
  const activeCount = typedJobs.filter(j => ['RUNNING', 'PREPARING', 'QUEUED'].includes(j.status)).length
  const failedCount = typedJobs.filter(j => ['FAILED', 'CANCELLED'].includes(j.status)).length

  const filteredJobs = typedJobs.filter(job => {
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'COMPLETED' && job.status === 'COMPLETED') ||
      (statusFilter === 'ACTIVE' && ['RUNNING', 'PREPARING', 'QUEUED'].includes(job.status)) ||
      (statusFilter === 'FAILED' && ['FAILED', 'CANCELLED'].includes(job.status))

    const q = query.trim().toLowerCase()
    const matchesQuery =
      !q ||
      job.project_name?.toLowerCase().includes(q) ||
      job.id.toLowerCase().includes(q) ||
      (job.arch_name ?? '').toLowerCase().includes(q)

    return matchesStatus && matchesQuery
  })

  const accValues = typedJobs.map(j => j.accuracy).filter((v): v is number => typeof v === 'number')
  const lossValues = typedJobs.map(j => j.loss).filter((v): v is number => typeof v === 'number')
  const bestAcc = accValues.length > 0 ? Math.max(...accValues) : null
  const bestLoss = lossValues.length > 0 ? Math.min(...lossValues) : null

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
    toast.info('ID de corrida copiado', id)
  }

  return (
    <div
      className="lg:col-span-8 nl-surface animate-card-reveal rounded-2xl p-5 flex flex-col justify-between gap-4"
      style={{ animationDelay: '240ms' }}
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <span>Bitácora de Ejecuciones de Entrenamiento</span>
                <InfoTip
                  title="Bitácora de Ejecuciones"
                  text="Historial reciente de trabajos entrenados con TensorFlow/Keras mostrando estado, progreso de épocas, pérdida y exactitud."
                  size="xs"
                />
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Trabajos ejecutados sobre TensorFlow/Keras con métricas verificadas y trazabilidad por corrida
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateTraining}
            className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-950/75 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-indigo-400 text-xs font-bold flex items-center gap-1.5 transition-all group shrink-0"
          >
            <span>Ver Cola Completa</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {typedJobs.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-950/55 border border-slate-800/80 rounded-xl p-2">
            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  { id: 'ALL', label: `Todas (${typedJobs.length})` },
                  { id: 'COMPLETED', label: `Completadas (${completedCount})` },
                  { id: 'ACTIVE', label: `Activas (${activeCount})` },
                  { id: 'FAILED', label: `Error (${failedCount})` },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    statusFilter === tab.id
                      ? 'nl-accent-bg shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filtrar proyecto, ID o red..."
                className="w-full bg-slate-900/75 border border-slate-800 focus:border-indigo-500/60 rounded-lg pl-8 pr-2.5 py-1 text-[11px] text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {typedJobs.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/45 rounded-2xl border border-slate-800">
            <Activity className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-300 text-sm font-semibold">Sin ejecuciones registradas</p>
            <p className="text-slate-500 text-xs mt-1">Inicia un experimento en el pipeline para registrar métricas</p>
            <button
              onClick={onNavigateTraining}
              className="nl-btn-shimmer mt-4 px-4 py-2 nl-accent-bg rounded-xl text-xs font-bold transition-opacity inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              Iniciar Primer Entrenamiento
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-2">
            <p className="text-xs text-slate-400">Ninguna ejecución coincide con los filtros actuales.</p>
            <button
              type="button"
              onClick={() => { setStatusFilter('ALL'); setQuery('') }}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold"
            >
              Restablecer filtros
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800/85 bg-slate-950/55 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800/90 bg-slate-900/75 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="text-left font-bold py-2.5 pl-4 pr-3">Proyecto / Corrida</th>
                    <th className="text-left font-bold py-2.5 pr-3">Arquitectura</th>
                    <th className="text-left font-bold py-2.5 pr-3">Estado</th>
                    <th className="text-left font-bold py-2.5 pr-3">Progreso</th>
                    <th className="text-left font-bold py-2.5 pr-3">Exactitud / Loss</th>
                    <th className="text-right font-bold py-2.5 pl-3 pr-4">Inspección</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredJobs.map(job => {
                    const meta = STATUS_META[job.status] || {
                      label: job.status,
                      pillClass: 'bg-slate-800 text-slate-400 border border-slate-700',
                      dotClass: 'bg-slate-400',
                    }
                    const pct = Math.min(100, Math.max(0, Number(job.progress ?? 0)))
                    const duration = formatDuration(job.started_at, job.ended_at)
                    const isDone = job.status === 'COMPLETED'
                    const isErr = job.status === 'FAILED' || job.status === 'CANCELLED'

                    return (
                      <tr
                        key={job.id}
                        className="hover:bg-slate-800/35 transition-colors group"
                      >
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                                isDone
                                  ? 'bg-emerald-400 shadow-xs shadow-emerald-400/60'
                                  : isErr
                                  ? 'bg-rose-400'
                                  : 'bg-indigo-400 animate-pulse'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-white font-bold truncate max-w-44 group-hover:text-indigo-200 transition-colors">
                                {job.project_name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                <SystemTooltip label="Copiar ID completo de la ejecución" side="top">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyId(job.id)}
                                    className="font-mono text-slate-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
                                  >
                                    <span>{job.id.slice(0, 12)}</span>
                                    {copiedId === job.id ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5 opacity-70" />
                                    )}
                                  </button>
                                </SystemTooltip>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-500 inline-flex items-center gap-1 whitespace-nowrap">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatShortDate(job.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 pr-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-200 font-medium text-[11px]">
                            <Layers className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="truncate max-w-36">{job.arch_name || 'Red Multicapa'}</span>
                          </span>
                        </td>

                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${meta.pillClass}`}>
                            {isDone ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ) : isErr ? (
                              <XCircle className="w-3 h-3 text-rose-400" />
                            ) : (
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                            )}
                            <span>{meta.label}</span>
                          </span>
                        </td>

                        <td className="py-3 pr-3">
                          <div className="space-y-1 min-w-28">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-slate-300 font-semibold">
                                {job.current_epoch ?? 0}/{job.total_epochs ?? 0} ép.
                              </span>
                              <span className="text-slate-400">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full nl-accent-bg nl-progress-shimmer rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            {duration && (
                              <p className="text-[10px] font-mono text-slate-500">Duración: {duration}</p>
                            )}
                          </div>
                        </td>

                        <td className="py-3 pr-3 font-mono">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold">
                              {job.accuracy != null ? (
                                <span className="text-emerald-400">{(job.accuracy * 100).toFixed(1)}%</span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </p>
                            <p className="text-[10px] text-amber-400/90">
                              Loss: {job.loss != null ? job.loss.toFixed(4) : '—'}
                            </p>
                          </div>
                        </td>

                        <td className="py-3 pl-3 pr-4 text-right">
                          <button
                            onClick={onNavigateEvaluation}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 text-white text-[11px] font-semibold transition-all shadow-xs"
                          >
                            <BarChart2 className="w-3 h-3 text-indigo-400" />
                            <span>Métricas</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {typedJobs.length > 0 && (
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950/75 border border-slate-800 text-slate-300 inline-flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Mejor Exactitud:{' '}
              <strong className="text-emerald-400">
                {bestAcc != null ? `${(bestAcc * 100).toFixed(2)}%` : '—'}
              </strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950/75 border border-slate-800 text-slate-300 inline-flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-amber-400" />
              Menor Pérdida:{' '}
              <strong className="text-amber-400">
                {bestLoss != null ? bestLoss.toFixed(4) : '—'}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onNavigateTraining}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Nueva ejecución TensorFlow →</span>
          </button>
        </div>
      )}
    </div>
  )
}
