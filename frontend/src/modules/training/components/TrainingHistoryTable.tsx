import { useState } from 'react'
import { Clock, Loader2, Play, RefreshCw, Square, Terminal } from 'lucide-react'
import type { TrainingJob } from '../../../types'
import { SystemTooltip } from '../../../components/InfoTip'
import { PaginationBar } from '../../../components/PaginationBar'
import { STATUS_BADGE, STATUS_LABEL } from '../constants'

interface TrainingHistoryTableProps {
  jobs: TrainingJob[]
  loading: boolean
  cancelling: string | null
  onMonitor: (jobId: string) => void
  onCancel: (jobId: string) => void
  onRetry: (jobId: string) => void
}

export function TrainingHistoryTable({
  jobs,
  loading,
  cancelling,
  onMonitor,
  onCancel,
  onRetry,
}: TrainingHistoryTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)

  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedJobs = jobs.slice((safePage - 1) * pageSize, safePage * pageSize)
  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Historial de Entrenamientos
          {jobs.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded-full">
              {jobs.length}
            </span>
          )}
        </h3>
      </div>

      {loading ? (
        <div className="p-5 text-center text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
          Cargando...
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-10 text-center">
          <Play className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Aún no hay entrenamientos en este proyecto</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/40">
                <tr>
                  {['ID', 'Arquitectura', 'Dataset', 'Estado', 'Progreso', 'Época', 'Loss', 'Accuracy', 'Inicio', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {paginatedJobs.map(job => (
                <tr
                  key={job.id}
                  className={`hover:bg-slate-800/20 transition-colors ${
                    ['RUNNING', 'PREPARING'].includes(job.status) ? 'ring-inset ring-1 ring-indigo-500/20' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-slate-400">{job.id.slice(0, 12)}...</td>
                  <td className="px-4 py-3 text-slate-300 max-w-24 truncate">{job.arch_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-24 truncate">{job.dataset_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-xs font-medium ${
                        STATUS_BADGE[job.status] || 'bg-slate-700 text-slate-400 border-slate-600'
                      } ${['RUNNING', 'PREPARING'].includes(job.status) ? 'animate-pulse' : ''}`}
                    >
                      {STATUS_LABEL[job.status] || job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-indigo-500 rounded-full transition-all duration-500 ${
                            ['RUNNING', 'PREPARING'].includes(job.status) ? 'nl-progress-shimmer' : ''
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-slate-400">{job.progress.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {job.current_epoch}/{job.total_epochs}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">{job.loss?.toFixed(4) ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {job.accuracy ? (job.accuracy * 100).toFixed(2) + '%' : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
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
                    <div className="flex items-center gap-1">
                      {['RUNNING', 'PREPARING', 'QUEUED'].includes(job.status) && (
                        <SystemTooltip label="Monitorear consola y métricas SSE en vivo" side="top">
                          <button
                            onClick={() => onMonitor(job.id)}
                            className="p-1 rounded text-indigo-400 hover:bg-indigo-900/30 transition-colors"
                            aria-label="Monitorear"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                          </button>
                        </SystemTooltip>
                      )}
                      {['RUNNING', 'PREPARING'].includes(job.status) && (
                        <SystemTooltip label="Cancelar entrenamiento en curso" side="top">
                          <button
                            onClick={() => onCancel(job.id)}
                            disabled={cancelling === job.id}
                            className="p-1 rounded text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-50"
                            aria-label="Cancelar"
                          >
                            {cancelling === job.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Square className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </SystemTooltip>
                      )}
                      {['FAILED', 'CANCELLED'].includes(job.status) && (
                        <SystemTooltip label="Reintentar ejecución con los mismos parámetros" side="top">
                          <button
                            onClick={() => onRetry(job.id)}
                            className="p-1 rounded text-amber-400 hover:bg-amber-900/30 transition-colors"
                            aria-label="Reintentar"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </SystemTooltip>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <PaginationBar
            currentPage={safePage}
            totalItems={jobs.length}
            pageSize={pageSize}
            pageSizeOptions={[5, 8, 15, 30]}
            onPageChange={setCurrentPage}
            onPageSizeChange={size => {
              setPageSize(size)
              setCurrentPage(1)
            }}
            itemLabel="entrenamientos"
          />
        </>
      )}
    </div>
  )
}

