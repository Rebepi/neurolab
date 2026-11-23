import { useState } from 'react'
import {
  ArrowRight,
  Clock,
  Copy,
  Eye,
  Pause,
  Play,
  RefreshCw,
  Search,
  SearchX,
  Square,
  Terminal,
  X,
} from 'lucide-react'
import type { TrainingJob } from '../../../types'
import { SystemTooltip } from '../../../components/InfoTip'
import { PaginationBar } from '../../../components/PaginationBar'
import { SystemSelect } from '../../../components/SystemSelect'
import { useToast } from '../../../components/toast/ToastContext'
import { STATUS_BADGE, STATUS_LABEL } from '../constants'
import { TrainingJobDetailModal } from './TrainingJobDetailModal'

interface TrainingHistoryTableProps {
  jobs: TrainingJob[]
  loading: boolean
  cancelling: string | null
  onMonitor: (jobId: string) => void
  onCancel: (jobId: string, reason?: string) => void
  onPause?: (jobId: string) => void
  onResume?: (jobId: string) => void
  onRetry: (jobId: string) => void
  onGoToEvaluation?: () => void
}

const ACTIVE_STATUSES = ['RUNNING', 'PREPARING', 'PAUSED', 'QUEUED']
const LIVE_STATUSES = ['RUNNING', 'PREPARING']

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'RUNNING', label: 'En ejecución' },
  { value: 'PAUSED', label: 'Pausado' },
  { value: 'QUEUED', label: 'En cola' },
  { value: 'FAILED', label: 'Fallido' },
  { value: 'CANCELLED', label: 'Cancelado' },
]

const TABLE_HEADERS = [
  'ID',
  'Arquitectura',
  'Dataset',
  'Estado',
  'Progreso',
  'Época',
  'Loss',
  'Accuracy',
  'Inicio',
  'Acciones',
]

function getAccuracyTone(acc: number): string {
  if (acc >= 0.85) return 'text-emerald-300'
  if (acc >= 0.7) return 'text-cyan-300'
  return 'text-amber-300'
}

function getAccuracyBar(acc: number): string {
  if (acc >= 0.85) return 'from-emerald-400 to-teal-400'
  if (acc >= 0.7) return 'from-cyan-400 to-sky-400'
  return 'from-amber-400 to-orange-400'
}

export function TrainingHistoryTable({
  jobs,
  loading,
  cancelling,
  onMonitor,
  onCancel,
  onPause,
  onResume,
  onRetry,
  onGoToEvaluation,
}: TrainingHistoryTableProps) {
  const toast = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [detailJob, setDetailJob] = useState<TrainingJob | null>(null)
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  function handleCopyId(jobId: string) {
    navigator.clipboard.writeText(jobId)
    toast.success('ID copiado', jobId)
  }

  const query = search.trim().toLowerCase()
  const filteredJobs = jobs.filter(job => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'RUNNING') {
        if (!LIVE_STATUSES.includes(job.status)) return false
      } else if (job.status !== statusFilter) {
        return false
      }
    }
    if (!query) return true
    const haystack = `${job.id} ${job.arch_name ?? ''} ${job.dataset_name ?? ''}`.toLowerCase()
    return haystack.includes(query)
  })

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedJobs = filteredJobs.slice((safePage - 1) * pageSize, safePage * pageSize)
  const hasFilters = query.length > 0 || statusFilter !== 'ALL'

  function clearFilters() {
    setSearch('')
    setStatusFilter('ALL')
    setCurrentPage(1)
  }

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      <div className="nl-cyber-panel animate-card-reveal rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Buscar ID, arquitectura o dataset..."
              aria-label="Buscar entrenamientos"
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/75 border border-slate-800 focus:border-cyan-500/50 outline-none text-xs text-slate-200 placeholder:text-slate-500 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setCurrentPage(1)
                }}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="w-48">
            <SystemSelect
              value={statusFilter}
              onChange={val => {
                setStatusFilter(val)
                setCurrentPage(1)
              }}
              size="xs"
              ariaLabel="Filtrar por estado"
              options={STATUS_FILTER_OPTIONS}
            />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-200 transition-colors"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          )}
        </div>

        <span className="px-2.5 py-1 rounded-full bg-slate-950/75 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-nowrap">
          <strong className="text-cyan-300">{filteredJobs.length}</strong> de {jobs.length} corridas
        </span>
      </div>

      <div className="nl-cyber-panel animate-card-reveal rounded-2xl overflow-hidden relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400/75 via-indigo-400/70 to-violet-500/75" />

        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-800/80">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-300 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <h3 className="text-white font-bold text-sm leading-tight">Historial de Entrenamientos</h3>
        </div>

        {loading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="nl-skeleton h-11 rounded-xl" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mx-auto">
              <Play className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-200">Aún no hay entrenamientos</p>
            <p className="text-xs text-slate-500">
              Pulsa «Nuevo Entrenamiento» para lanzar tu primera corrida con Keras.
            </p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mx-auto">
              <SearchX className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-200">Sin resultados</p>
            <p className="text-xs text-slate-500">Ningún entrenamiento coincide con los filtros actuales.</p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-200 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-800/80 bg-slate-900/60">
                <tr>
                  {TABLE_HEADERS.map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {paginatedJobs.map(job => {
                  const isLive = LIVE_STATUSES.includes(job.status)
                  const progress = Math.max(0, Math.min(100, job.progress))
                  return (
                    <tr
                      key={job.id}
                      className={`transition-colors hover:bg-slate-800/25 ${
                        isLive ? 'bg-indigo-500/5 shadow-[inset_3px_0_0_0_rgba(129,140,248,0.75)]' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <SystemTooltip label={job.id} title="ID de la corrida" side="top">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800 font-mono text-[11px] text-slate-300">
                            {job.id.slice(0, 12)}…
                          </span>
                        </SystemTooltip>
                      </td>
                      <td className="px-4 py-3">
                        <SystemTooltip label={job.arch_name || 'Sin nombre'} title="Arquitectura" side="top">
                          <span className="block max-w-[180px] truncate text-slate-200 font-medium">
                            {job.arch_name || '—'}
                          </span>
                        </SystemTooltip>
                      </td>
                      <td className="px-4 py-3">
                        <SystemTooltip label={job.dataset_name || 'Sin nombre'} title="Dataset" side="top">
                          <span className="block max-w-[180px] truncate text-slate-400">
                            {job.dataset_name || '—'}
                          </span>
                        </SystemTooltip>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
                            STATUS_BADGE[job.status] || 'bg-slate-700 text-slate-400 border-slate-600'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full bg-current ${isLive ? 'animate-pulse' : ''}`}
                          />
                          {STATUS_LABEL[job.status] || job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-violet-500 rounded-full transition-all duration-500 ${
                                isLive ? 'nl-progress-shimmer' : ''
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-300 w-9">
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                        {job.current_epoch}
                        <span className="text-slate-500">/{job.total_epochs}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">{job.loss?.toFixed(4) ?? '—'}</td>
                      <td className="px-4 py-3">
                        {typeof job.accuracy === 'number' && job.accuracy > 0 ? (
                          <div className="space-y-1 w-20">
                            <span className={`font-mono font-bold text-[12px] ${getAccuracyTone(job.accuracy)}`}>
                              {(job.accuracy * 100).toFixed(2)}%
                            </span>
                            <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r ${getAccuracyBar(job.accuracy)}`}
                                style={{ width: `${Math.min(100, job.accuracy * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {job.started_at
                          ? new Date(job.started_at).toLocaleString('es', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <SystemTooltip label="Ver configuración, métricas y registro de la corrida" side="top">
                            <button
                              type="button"
                              onClick={() => setDetailJob(job)}
                              className="w-7 h-7 rounded-lg border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 flex items-center justify-center transition-colors"
                              aria-label="Ver detalle"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </SystemTooltip>
                          {job.status === 'COMPLETED' && onGoToEvaluation && (
                            <SystemTooltip label="Ir a la evaluación de este modelo" side="top">
                              <button
                                type="button"
                                onClick={onGoToEvaluation}
                                className="w-7 h-7 rounded-lg border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-300 flex items-center justify-center transition-colors"
                                aria-label="Ir a evaluación"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </SystemTooltip>
                          )}
                          <SystemTooltip label="Copiar ID de la corrida" side="top">
                            <button
                              type="button"
                              onClick={() => handleCopyId(job.id)}
                              className="w-7 h-7 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-300 flex items-center justify-center transition-colors"
                              aria-label="Copiar ID"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </SystemTooltip>
                          {ACTIVE_STATUSES.includes(job.status) && (
                            <SystemTooltip label="Monitorear consola y métricas SSE en vivo" side="top">
                              <button
                                type="button"
                                onClick={() => onMonitor(job.id)}
                                className="w-7 h-7 rounded-lg border border-indigo-500/35 bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 flex items-center justify-center transition-colors"
                                aria-label="Monitorear"
                              >
                                <Terminal className="w-3.5 h-3.5" />
                              </button>
                            </SystemTooltip>
                          )}
                          {LIVE_STATUSES.includes(job.status) && onPause && (
                            <SystemTooltip label="Pausar entrenamiento" side="top">
                              <button
                                type="button"
                                onClick={() => onPause(job.id)}
                                className="w-7 h-7 rounded-lg border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 flex items-center justify-center transition-colors"
                                aria-label="Pausar"
                              >
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            </SystemTooltip>
                          )}
                          {job.status === 'PAUSED' && onResume && (
                            <SystemTooltip label="Reanudar entrenamiento" side="top">
                              <button
                                type="button"
                                onClick={() => onResume(job.id)}
                                className="w-7 h-7 rounded-lg border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-300 flex items-center justify-center transition-colors"
                                aria-label="Reanudar"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            </SystemTooltip>
                          )}
                          {ACTIVE_STATUSES.includes(job.status) && (
                            <SystemTooltip label="Cancelar entrenamiento en curso" side="top">
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelTargetId(job.id)
                                  setCancelReason('')
                                }}
                                disabled={cancelling === job.id}
                                className="w-7 h-7 rounded-lg border border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 flex items-center justify-center transition-colors disabled:opacity-50"
                                aria-label="Cancelar"
                              >
                                {cancelling === job.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Square className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </SystemTooltip>
                          )}
                          {['FAILED', 'CANCELLED'].includes(job.status) && (
                            <SystemTooltip label="Reintentar ejecución con los mismos parámetros" side="top">
                              <button
                                type="button"
                                onClick={() => onRetry(job.id)}
                                className="w-7 h-7 rounded-lg border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 flex items-center justify-center transition-colors"
                                aria-label="Reintentar"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </SystemTooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filteredJobs.length > 0 && (
        <div className="nl-cyber-panel rounded-2xl overflow-hidden mt-auto">
          <PaginationBar
            currentPage={safePage}
            totalItems={filteredJobs.length}
            pageSize={pageSize}
            pageSizeOptions={[5, 8, 15, 30]}
            onPageChange={setCurrentPage}
            onPageSizeChange={size => {
              setPageSize(size)
              setCurrentPage(1)
            }}
            itemLabel="entrenamientos"
          />
        </div>
      )}

      {detailJob && (
        <TrainingJobDetailModal
          job={detailJob}
          onClose={() => setDetailJob(null)}
          onCopyId={handleCopyId}
          onGoToEvaluation={onGoToEvaluation}
        />
      )}

      {cancelTargetId && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <div className="nl-cyber-panel rounded-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Cancelar Entrenamiento</h3>
            <p className="text-xs text-slate-400">
              Indica opcionalmente el motivo de cancelación para la bitácora de auditoría:
            </p>
            <input
              type="text"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Ej: Ajuste de hiperparámetros o convergencia lenta"
              className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTargetId(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = cancelTargetId
                  const reason = cancelReason.trim() || undefined
                  setCancelTargetId(null)
                  onCancel(id, reason)
                }}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
